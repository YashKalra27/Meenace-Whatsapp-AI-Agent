import fs from 'fs';
import path from 'path';
import { ConversationMessage } from '../types/index.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MAX_MESSAGES_PER_PHONE = 50;

// Per-phone chat history, kept so Gemini sees the recent conversation
export class ConversationStore {
  private threads: Record<string, ConversationMessage[]> = {};

  constructor() {
    try {
      if (fs.existsSync(CONVERSATIONS_FILE)) {
        this.threads = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }

  private save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(this.threads, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save conversations:', err);
    }
  }

  private key(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  public append(phone: string, role: ConversationMessage['role'], text: string): void {
    const key = this.key(phone);
    const thread = this.threads[key] || [];
    thread.push({ role, text, timestamp: Date.now() });
    this.threads[key] = thread.slice(-MAX_MESSAGES_PER_PHONE);
    this.save();
  }

  public recent(phone: string, count: number): ConversationMessage[] {
    return (this.threads[this.key(phone)] || []).slice(-count);
  }

  public clear(phone: string): void {
    delete this.threads[this.key(phone)];
    this.save();
  }

  public all(): Record<string, ConversationMessage[]> {
    return this.threads;
  }
}

export const conversationStore = new ConversationStore();
