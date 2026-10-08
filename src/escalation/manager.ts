import fs from 'fs';
import path from 'path';
import { ConversationThread, EscalationTicket, ChatMessage } from '../types/index.js';
import { webhookLogger } from '../logger/webhookLogger.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const THREADS_FILE = path.join(DATA_DIR, 'threads.json');
const TICKETS_FILE = path.join(DATA_DIR, 'escalation_tickets.json');

export class EscalationManager {
  private threads: Map<string, ConversationThread> = new Map();
  private tickets: EscalationTicket[] = [];

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(THREADS_FILE)) {
        const raw = fs.readFileSync(THREADS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [phone, th] of Object.entries(data)) {
          this.threads.set(phone, th as ConversationThread);
        }
      }

      if (fs.existsSync(TICKETS_FILE)) {
        const raw = fs.readFileSync(TICKETS_FILE, 'utf-8');
        this.tickets = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load escalation storage:', err);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const threadsObj: Record<string, ConversationThread> = {};
      for (const [phone, th] of this.threads.entries()) {
        threadsObj[phone] = th;
      }
      fs.writeFileSync(THREADS_FILE, JSON.stringify(threadsObj, null, 2), 'utf-8');
      fs.writeFileSync(TICKETS_FILE, JSON.stringify(this.tickets, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save escalation data:', err);
    }
  }

  public getOrCreateThread(phone: string, customerName = 'Customer'): ConversationThread {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let thread = this.threads.get(cleanPhone);
    if (!thread) {
      thread = {
        customerPhone: phone,
        customerName: customerName || `Client (${phone.slice(-4)})`,
        mode: 'bot',
        escalated: false,
        lastActivity: Date.now(),
        messages: [],
        unreadByHuman: 0
      };
      this.threads.set(cleanPhone, thread);
      this.save();
    } else if (customerName && customerName !== 'Customer' && thread.customerName.startsWith('Client (')) {
      thread.customerName = customerName;
      this.save();
    }
    return thread;
  }

  public getThread(phone: string): ConversationThread | undefined {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return this.threads.get(cleanPhone);
  }

  public getAllThreads(): ConversationThread[] {
    return Array.from(this.threads.values()).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  public addMessageToThread(phone: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const thread = this.getOrCreateThread(phone);
    const fullMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...message
    };

    thread.messages.push(fullMsg);
    thread.lastActivity = Date.now();
    if (message.from === 'customer' && thread.mode === 'human_takeover') {
      thread.unreadByHuman += 1;
    }
    this.save();

    webhookLogger.broadcast({
      type: 'THREAD_MESSAGE',
      data: { phone, message: fullMsg, thread }
    });

    return fullMsg;
  }

  public updateMessageStatus(phone: string, messageId: string, status: 'sent' | 'delivered' | 'read' | 'failed'): void {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const thread = this.threads.get(cleanPhone);
    if (thread) {
      const msg = thread.messages.find(m => m.id === messageId || m.metadata?.whatsappMessageId === messageId);
      if (msg) {
        msg.status = status;
        this.save();
        webhookLogger.broadcast({
          type: 'MESSAGE_STATUS_UPDATE',
          data: { phone, messageId, status }
        });
      }
    }
  }

  public escalate(params: {
    customerPhone: string;
    customerName?: string;
    reason: string;
    urgency?: 'low' | 'medium' | 'high' | 'urgent';
    summary?: string;
  }): EscalationTicket {
    const thread = this.getOrCreateThread(params.customerPhone, params.customerName);
    thread.mode = 'human_takeover';
    thread.escalated = true;

    const ticket: EscalationTicket = {
      id: `tkt-${Date.now().toString().slice(-6)}`,
      customerPhone: params.customerPhone,
      customerName: thread.customerName,
      reason: params.reason,
      urgency: params.urgency || 'medium',
      summary: params.summary || 'Customer requested live human intervention.',
      status: 'open',
      createdAt: Date.now()
    };

    thread.escalationId = ticket.id;
    this.tickets.unshift(ticket);
    this.save();

    // Log system event message into the chat
    this.addMessageToThread(params.customerPhone, {
      from: 'system',
      text: `🔔 Conversation escalated to Human Operator. Reason: ${params.reason} [Urgency: ${ticket.urgency.toUpperCase()}]. Bot automated replies paused.`,
      status: 'read'
    });

    webhookLogger.broadcast({
      type: 'ESCALATION_CREATED',
      data: { ticket, thread }
    });

    console.log(`[ESCALATION] Phone: ${params.customerPhone} | Reason: ${params.reason} | Urgency: ${ticket.urgency}`);
    return ticket;
  }

  public takeOverConversation(phone: string, operatorName = 'Support Lead'): boolean {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const thread = this.threads.get(cleanPhone);
    if (!thread) return false;

    thread.mode = 'human_takeover';
    thread.unreadByHuman = 0;
    this.save();

    this.addMessageToThread(phone, {
      from: 'system',
      text: `👤 Human Agent (${operatorName}) took over the conversation. Automated responses paused.`
    });

    webhookLogger.broadcast({
      type: 'HUMAN_TAKEOVER',
      data: { phone, operatorName, thread }
    });

    return true;
  }

  public resumeBot(phone: string): boolean {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const thread = this.threads.get(cleanPhone);
    if (!thread) return false;

    thread.mode = 'bot';
    thread.escalated = false;
    this.save();

    // Mark any related ticket resolved
    if (thread.escalationId) {
      const ticket = this.tickets.find(t => t.id === thread.escalationId);
      if (ticket) {
        ticket.status = 'resolved';
        ticket.resolvedAt = Date.now();
      }
    }

    this.addMessageToThread(phone, {
      from: 'system',
      text: `🤖 Claude AI automation resumed for this conversation.`
    });

    webhookLogger.broadcast({
      type: 'BOT_RESUMED',
      data: { phone, thread }
    });

    return true;
  }

  public getAllTickets(): EscalationTicket[] {
    return [...this.tickets];
  }

  public isHumanMode(phone: string): boolean {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const thread = this.threads.get(cleanPhone);
    return thread?.mode === 'human_takeover';
  }
}

export const escalationManager = new EscalationManager();
