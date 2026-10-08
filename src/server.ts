import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

import { MetaWebhookPayload, WhatsAppInboundMessage } from './types/index.js';
import { processWithClaude } from './agent/claude.js';
import { whatsappClient } from './whatsapp/client.js';
import { windowManager } from './whatsapp/windowManager.js';
import { escalationManager } from './escalation/manager.js';
import { calendarEngine } from './calendar/engine.js';
import { reminderScheduler } from './calendar/scheduler.js';
import { webhookLogger } from './logger/webhookLogger.js';
import { handleFlowDataExchange, FlowEndpointRequest, bookingFlowJSON } from './flows/bookingFlow.js';
import { servicesCatalog, defaultBusinessProfile } from './config/businessData.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'claude_whatsapp_secret_verify_token_2026';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

// Register WebSocket logger connection
wss.on('connection', ws => {
  webhookLogger.registerClient(ws);
});

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Verify webhook signature if APP_SECRET is configured
function verifySignature(req: any): boolean {
  if (!APP_SECRET) return true;
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', APP_SECRET);
  const digest = `sha256=${hmac.update(req.rawBody || '').digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// -------------------------------------------------------------
// Official Meta WhatsApp Webhook Handlers
// -------------------------------------------------------------

// 1. GET /webhook: Meta Hub Verification handshake
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const startTime = Date.now();
  console.log(`[WEBHOOK VERIFY] mode=${mode}, token=${token}`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    webhookLogger.log({
      direction: 'inbound',
      type: 'verification',
      httpStatus: 200,
      durationMs: Date.now() - startTime,
      payload: req.query,
      response: { challenge }
    });
    return res.status(200).send(challenge);
  }

  webhookLogger.log({
    direction: 'inbound',
    type: 'verification',
    httpStatus: 403,
    durationMs: Date.now() - startTime,
    payload: req.query,
    response: 'Verification token mismatch',
    error: 'hub.verify_token did not match WHATSAPP_VERIFY_TOKEN'
  });
  return res.sendStatus(403);
});

// 2. POST /webhook: Inbound messages & delivery status updates
app.post('/webhook', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // Immediate 200 OK acknowledgment required by Meta
  res.status(200).send('EVENT_RECEIVED');

  if (!verifySignature(req)) {
    console.warn('[WEBHOOK] Invalid HMAC signature detected.');
    webhookLogger.log({
      direction: 'inbound',
      type: 'error',
      httpStatus: 401,
      durationMs: Date.now() - startTime,
      payload: req.body,
      response: null,
      error: 'Invalid X-Hub-Signature-256'
    });
    return;
  }

  const payload: MetaWebhookPayload = req.body;
  if (payload.object !== 'whatsapp_business_account') {
    return;
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const val = change.value;
      if (!val) continue;

      // A) Handle Message Status Updates (sent, delivered, read, failed)
      if (val.statuses && val.statuses.length > 0) {
        for (const statusUpdate of val.statuses) {
          const durationMs = Date.now() - startTime;
          webhookLogger.log({
            direction: 'inbound',
            type: 'status',
            httpStatus: 200,
            durationMs,
            payload: statusUpdate,
            response: { processed: true }
          });

          escalationManager.updateMessageStatus(
            statusUpdate.recipient_id,
            statusUpdate.id,
            statusUpdate.status
          );
        }
      }

      // B) Handle Inbound Messages
      if (val.messages && val.messages.length > 0) {
        for (const msg of val.messages) {
          await handleInboundMessage(msg, val.contacts?.[0]?.profile?.name);
        }
      }
    }
  }
});

async function handleInboundMessage(msg: WhatsAppInboundMessage, contactName?: string) {
  const startTime = Date.now();
  const customerPhone = msg.from;
  const customerName = contactName || `User (${customerPhone.slice(-4)})`;

  // 1. Record customer inbound: Opens/refreshes the official Meta 24-hour service window
  windowManager.recordCustomerInbound(customerPhone);

  // 2. Mark message as read on Meta
  whatsappClient.markAsRead(msg.id).catch(() => {});

  // 3. Extract text content or interactive selection
  let userText = '';
  if (msg.type === 'text' && msg.text) {
    userText = msg.text.body;
  } else if (msg.type === 'interactive' && msg.interactive) {
    if (msg.interactive.button_reply) {
      userText = msg.interactive.button_reply.title;
    } else if (msg.interactive.list_reply) {
      userText = msg.interactive.list_reply.title;
    } else if (msg.interactive.nfm_reply) {
      // Flow completed response!
      try {
        const flowData = JSON.parse(msg.interactive.nfm_reply.response_json || '{}');
        userText = `[Submitted Flow Booking]: ${JSON.stringify(flowData)}`;
        if (flowData.service_id && flowData.date && flowData.time_slot) {
          calendarEngine.bookAppointment({
            customerName: flowData.name || customerName,
            customerPhone,
            serviceId: flowData.service_id,
            date: flowData.date,
            timeSlot: flowData.time_slot,
            notes: flowData.notes
          });
        }
      } catch {
        userText = '[Completed WhatsApp Booking Flow]';
      }
    }
  } else if (msg.type === 'button' && msg.button) {
    userText = msg.button.text;
  } else {
    userText = `[Received ${msg.type} message]`;
  }

  // 4. Record to chat thread
  escalationManager.addMessageToThread(customerPhone, {
    from: 'customer',
    senderName: customerName,
    text: userText,
    status: 'read',
    metadata: { whatsappMessageId: msg.id }
  });

  // 5. Check Human Escalation Mode: If human operator took over, bot stops replying
  if (escalationManager.isHumanMode(customerPhone)) {
    webhookLogger.log({
      direction: 'inbound',
      type: 'message',
      httpStatus: 200,
      durationMs: Date.now() - startTime,
      payload: msg,
      response: { botReplied: false, reason: 'Human takeover active' }
    });
    return;
  }

  // 6. Ask Claude what to say, with full business context & calendar tools
  try {
    const thread = escalationManager.getThread(customerPhone);
    const history = (thread?.messages || []).slice(-8).map(m => ({
      role: (m.from === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text
    }));

    const { reply, toolsUsed, reasoningTrace } = await processWithClaude({
      incomingText: userText,
      customerPhone,
      customerName,
      conversationHistory: history
    });

    // 7. Send Claude's response back on your WhatsApp number
    const sendRes = await whatsappClient.sendText({
      to: customerPhone,
      body: reply
    });

    const durationMs = Date.now() - startTime;
    webhookLogger.log({
      direction: 'inbound',
      type: 'message',
      httpStatus: 200,
      durationMs,
      payload: msg,
      response: { reply, toolsUsed, sendResult: sendRes },
      claudeReasoning: reasoningTrace,
      toolsUsed
    });
  } catch (err: any) {
    console.error('[AGENT PROCESS ERROR]:', err);
    webhookLogger.log({
      direction: 'inbound',
      type: 'error',
      httpStatus: 500,
      durationMs: Date.now() - startTime,
      payload: msg,
      response: null,
      error: err.message
    });
  }
}

// -------------------------------------------------------------
// WhatsApp Flows Native Endpoint
// -------------------------------------------------------------
app.post('/flow-endpoint', (req: Request, res: Response) => {
  const reqBody: FlowEndpointRequest = req.body;
  const customerPhone = (req.headers['x-wa-customer-phone'] as string) || '+14155550192';

  const startTime = Date.now();
  const flowResponse = handleFlowDataExchange(reqBody, customerPhone);
  const durationMs = Date.now() - startTime;

  webhookLogger.log({
    direction: 'inbound',
    type: 'flow',
    httpStatus: 200,
    durationMs,
    payload: reqBody,
    response: flowResponse
  });

  return res.status(200).json(flowResponse);
});

// -------------------------------------------------------------
// Dashboard & Sandbox REST API Endpoints
// -------------------------------------------------------------

// System Status
app.get('/api/status', (_req: Request, res: Response) => {
  const clientStatus = whatsappClient.getStatus();
  const threads = escalationManager.getAllThreads();
  const tickets = escalationManager.getAllTickets();
  const openEscalations = tickets.filter(t => t.status === 'open').length;

  res.json({
    status: 'online',
    whatsapp: clientStatus,
    claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10),
    activeConversationsCount: threads.length,
    openEscalationsCount: openEscalations,
    appointmentsCount: calendarEngine.getAllAppointments().length
  });
});

// Webhook Logs
app.get('/api/logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(webhookLogger.getLogs(limit));
});

app.delete('/api/logs', (_req: Request, res: Response) => {
  webhookLogger.clearLogs();
  res.json({ success: true });
});

// Conversations
app.get('/api/conversations', (_req: Request, res: Response) => {
  const threads = escalationManager.getAllThreads().map(th => {
    const windowStatus = windowManager.getWindowStatus(th.customerPhone);
    return {
      ...th,
      windowStatus
    };
  });
  res.json(threads);
});

// Human Takeover & Resume Bot
app.post('/api/conversations/:phone/takeover', (req: Request, res: Response) => {
  const phone = req.params.phone;
  const operatorName = req.body.operatorName || 'Support Lead';
  const success = escalationManager.takeOverConversation(phone, operatorName);
  res.json({ success });
});

app.post('/api/conversations/:phone/resume', (req: Request, res: Response) => {
  const phone = req.params.phone;
  const success = escalationManager.resumeBot(phone);
  res.json({ success });
});

// Operator manual reply via WhatsApp
app.post('/api/conversations/:phone/send', async (req: Request, res: Response) => {
  const phone = req.params.phone;
  const text = req.body.text;
  if (!text) return res.status(400).json({ error: 'Message text required' });

  try {
    await whatsappClient.sendText({ to: phone, body: text });
    escalationManager.addMessageToThread(phone, {
      from: 'human_agent',
      senderName: req.body.operatorName || 'Human Agent',
      text,
      status: 'sent'
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Escalations
app.get('/api/escalations', (_req: Request, res: Response) => {
  res.json(escalationManager.getAllTickets());
});

// Appointments & Calendar
app.get('/api/appointments', (_req: Request, res: Response) => {
  res.json(calendarEngine.getAllAppointments());
});

app.get('/api/calendar/availability', (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  res.json(calendarEngine.getAvailableSlots(date));
});

app.post('/api/appointments', (req: Request, res: Response) => {
  const result = calendarEngine.bookAppointment(req.body);
  res.json(result);
});

app.post('/api/appointments/:id/cancel', (req: Request, res: Response) => {
  const id = req.params.id;
  const result = calendarEngine.cancelAppointment(id, req.body.reason);
  res.json(result);
});

app.post('/api/appointments/:id/reschedule', (req: Request, res: Response) => {
  const id = req.params.id;
  const result = calendarEngine.rescheduleAppointment(id, req.body.newDate, req.body.newTimeSlot);
  res.json(result);
});

// Reminder & Follow-Up Triggers
app.post('/api/reminders/trigger', async (_req: Request, res: Response) => {
  const result = await reminderScheduler.checkAndSendReminders();
  res.json({ success: true, ...result });
});

app.post('/api/reminders/follow-up', async (req: Request, res: Response) => {
  const { customerPhone, customerName } = req.body;
  if (!customerPhone) return res.status(400).json({ error: 'customerPhone required' });
  const result = await reminderScheduler.sendFollowUpQuote(customerPhone, customerName || 'Client');
  res.json({ success: true, result });
});

// Templates Gallery
app.get('/api/templates', (_req: Request, res: Response) => {
  res.json([
    {
      name: 'appointment_reminder_v1',
      category: 'UTILITY',
      language: 'en_US',
      status: 'APPROVED',
      header: 'Appointment Reminder 📅',
      bodyText: 'Good morning {{1}}! Reminder: Your session for "{{2}}" is scheduled for {{3}} at {{4}}. If you need to reschedule, reply here.',
      buttons: ['Confirm', 'Reschedule']
    },
    {
      name: 'follow_up_quote_v1',
      category: 'UTILITY',
      language: 'en_US',
      status: 'APPROVED',
      header: 'Following Up',
      bodyText: 'Hi {{1}}! Just following up on our chat from a few days ago regarding your AI automation inquiry. Did you have any questions?',
      buttons: ['View Options', 'Schedule Call']
    },
    {
      name: 're_engagement_v1',
      category: 'MARKETING',
      language: 'en_US',
      status: 'APPROVED',
      header: 'New AI Agent Features 🚀',
      bodyText: 'Hello {{1}}, we have introduced WhatsApp Flow forms and 24/7 calendar booking on our official line. Reply to explore!',
      buttons: ['Learn More', 'Opt Out']
    }
  ]);
});

// Settings & Config
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({
    businessProfile: defaultBusinessProfile,
    services: servicesCatalog,
    flowJSON: bookingFlowJSON,
    clientConfig: {
      hasToken: Boolean(process.env.WHATSAPP_TOKEN),
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      verifyToken: VERIFY_TOKEN,
      simulationMode: process.env.SIMULATION_MODE === 'true',
      hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY)
    }
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const { whatsappToken, phoneNumberId, simulationMode } = req.body;
  if (whatsappToken !== undefined || phoneNumberId !== undefined || simulationMode !== undefined) {
    whatsappClient.updateCredentials(
      whatsappToken || '',
      phoneNumberId || '',
      simulationMode
    );
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// Sandbox Simulator Endpoint
// Simulates an inbound customer message directly into the pipeline
// -------------------------------------------------------------
app.post('/api/simulate-inbound', async (req: Request, res: Response) => {
  const { phone, text, name, type, interactiveData } = req.body;
  const customerPhone = phone || '+14155550192';
  const customerName = name || 'Sandbox Tester';

  const simulatedMsgId = `sim_msg_${Date.now()}`;
  const inboundMsg: WhatsAppInboundMessage = {
    from: customerPhone,
    id: simulatedMsgId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: (type as any) || 'text',
    text: type === 'text' || !type ? { body: text || 'Hello' } : undefined,
    interactive: interactiveData
  };

  await handleInboundMessage(inboundMsg, customerName);
  res.json({ success: true, messageId: simulatedMsgId });
});

// Serve frontend static build in production
const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
app.use(express.static(clientDistPath));
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path.startsWith('/flow-endpoint')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Claude WhatsApp Agent API</title><meta charset="utf-8"/></head>
          <body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#c9d1d9;">
            <h2>🤖 Claude WhatsApp Agent Server Running</h2>
            <p>API Server is listening on port ${PORT}.</p>
            <p>To view the full Builder Dashboard, run <code>npm run client</code> or build with <code>npm run build:client</code>.</p>
          </body>
        </html>
      `);
    }
  });
});

// Start scheduler and server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Claude WhatsApp Agent Server listening on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🔑 Verify Token: ${VERIFY_TOKEN}`);
  console.log(`🤖 Claude Model: ${process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'}`);
  console.log(`======================================================\n`);

  reminderScheduler.start();
});
