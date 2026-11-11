import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';

import { MetaWebhookPayload, WhatsAppInboundMessage } from './types/index.js';
import { processWithAgent, geminiModel } from './agent/gemini.js';
import { whatsappClient } from './whatsapp/client.js';
import { windowManager } from './whatsapp/windowManager.js';
import { conversationStore } from './conversation/store.js';
import { webhookLogger } from './logger/webhookLogger.js';
import { agentTools } from './tools/index.js';
import { kalvionConfigured } from './tools/kalvion.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Meenace answers only this number (digits only, country code first, e.g. 919876543210)
const OWNER_PHONE = (process.env.OWNER_PHONE || '').replace(/[^0-9]/g, '');
const OWNER_NAME = process.env.OWNER_NAME || 'Yash';
// Messages of history sent to Gemini with each new message
const HISTORY_MESSAGES = 10;

const HELP_TEXT = `*Meenace commands*
• /new — start a fresh conversation (forget the chat so far)
• /help — this list

Anything else is answered by Meenace using Kalvion's live data.`;

app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Admin API requires "Authorization: Bearer <ADMIN_TOKEN>"; disabled when ADMIN_TOKEN is unset
function requireAdmin(req: Request, res: Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const supplied = Buffer.from(header.replace(/^Bearer /, ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  if (!ADMIN_TOKEN || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Verify webhook signature if APP_SECRET is configured
function verifySignature(req: any): boolean {
  if (!APP_SECRET) return true;
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', APP_SECRET);
  const digest = `sha256=${hmac.update(req.rawBody || '').digest('hex')}`;
  return signature.length === digest.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
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

  if (VERIFY_TOKEN && mode === 'subscribe' && token === VERIFY_TOKEN) {
    webhookLogger.log({
      direction: 'inbound',
      type: 'verification',
      httpStatus: 200,
      durationMs: Date.now() - startTime,
      payload: { mode },
      response: { challenge }
    });
    return res.status(200).send(challenge);
  }

  webhookLogger.log({
    direction: 'inbound',
    type: 'verification',
    httpStatus: 403,
    durationMs: Date.now() - startTime,
    payload: { mode },
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
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const val = change.value;
      if (!val) continue;

      for (const statusUpdate of val.statuses || []) {
        webhookLogger.log({
          direction: 'inbound',
          type: 'status',
          httpStatus: 200,
          durationMs: Date.now() - startTime,
          payload: statusUpdate,
          response: { processed: true }
        });
      }

      for (const msg of val.messages || []) {
        await handleInboundMessage(msg);
      }
    }
  }
});

function extractText(msg: WhatsAppInboundMessage): string {
  if (msg.type === 'text' && msg.text) return msg.text.body;
  if (msg.type === 'interactive' && msg.interactive) {
    return msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || '';
  }
  if (msg.type === 'button' && msg.button) return msg.button.text;
  return '';
}

export async function handleInboundMessage(msg: WhatsAppInboundMessage) {
  const startTime = Date.now();
  const senderPhone = msg.from.replace(/[^0-9]/g, '');

  // Owner-only: anyone else gets no reply at all, so the bot reveals nothing
  if (!OWNER_PHONE || senderPhone !== OWNER_PHONE) {
    webhookLogger.log({
      direction: 'inbound',
      type: 'ignored',
      httpStatus: 200,
      durationMs: Date.now() - startTime,
      payload: { from: senderPhone, type: msg.type },
      response: { reason: OWNER_PHONE ? 'Sender is not the owner' : 'OWNER_PHONE is not set' }
    });
    return;
  }

  // Opens/refreshes the 24-hour window in which free-form replies are allowed
  windowManager.recordCustomerInbound(senderPhone);
  whatsappClient.markAsRead(msg.id).catch(() => {});

  const text = extractText(msg).trim();

  try {
    if (!text) {
      await whatsappClient.sendText({ to: senderPhone, body: `I can only read text messages for now (you sent ${msg.type}).` });
      return;
    }

    const command = text.toLowerCase();
    if (command === '/new' || command === '/help') {
      if (command === '/new') conversationStore.clear(senderPhone);
      await whatsappClient.sendText({
        to: senderPhone,
        body: command === '/new' ? '🧹 Fresh start. What do you need?' : HELP_TEXT
      });
      webhookLogger.log({
        direction: 'inbound',
        type: 'command',
        httpStatus: 200,
        durationMs: Date.now() - startTime,
        payload: { command },
        response: { handled: true }
      });
      return;
    }

    const history = conversationStore.recent(senderPhone, HISTORY_MESSAGES).map(m => ({
      role: m.role,
      content: m.text
    }));
    conversationStore.append(senderPhone, 'user', text);

    const { reply, toolsUsed, reasoningTrace } = await processWithAgent({
      incomingText: text,
      ownerName: OWNER_NAME,
      conversationHistory: history
    });

    conversationStore.append(senderPhone, 'assistant', reply);
    const sendResult = await whatsappClient.sendText({ to: senderPhone, body: reply });

    webhookLogger.log({
      direction: 'inbound',
      type: 'message',
      httpStatus: 200,
      durationMs: Date.now() - startTime,
      payload: { from: senderPhone, text },
      response: { reply, sendResult },
      agentReasoning: reasoningTrace,
      toolsUsed
    });
  } catch (err: any) {
    console.error('[AGENT PROCESS ERROR]:', err);
    webhookLogger.log({
      direction: 'inbound',
      type: 'error',
      httpStatus: 500,
      durationMs: Date.now() - startTime,
      payload: { from: senderPhone, text },
      response: null,
      error: err.message
    });
  }
}

// -------------------------------------------------------------
// Admin REST API Endpoints
// -------------------------------------------------------------

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'online', service: 'Meenace' });
});

app.use('/api', requireAdmin);

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    whatsapp: whatsappClient.getStatus(),
    ownerConfigured: Boolean(OWNER_PHONE),
    ownerWindow: OWNER_PHONE ? windowManager.getWindowStatus(OWNER_PHONE) : null,
    geminiModel,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    kalvionConnected: kalvionConfigured(),
    tools: agentTools.map(t => t.declaration.name)
  });
});

app.get('/api/logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(webhookLogger.getLogs(limit));
});

app.delete('/api/logs', (_req: Request, res: Response) => {
  webhookLogger.clearLogs();
  res.json({ success: true });
});

app.get('/api/conversations', (_req: Request, res: Response) => {
  res.json(conversationStore.all());
});

// Runs the agent on a text and returns the reply without sending anything to WhatsApp
app.post('/api/agent', async (req: Request, res: Response) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  const result = await processWithAgent({ incomingText: text, ownerName: OWNER_NAME });
  res.json(result);
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Meenace listening on port ${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`🤖 Gemini Model: ${geminiModel}`);
    console.log(`📈 Kalvion: ${kalvionConfigured() ? 'connected' : 'not configured'}`);
    if (!OWNER_PHONE) console.log('⚠️  OWNER_PHONE is not set: every message will be ignored');
    if (!VERIFY_TOKEN) console.log('⚠️  WHATSAPP_VERIFY_TOKEN is not set: Meta webhook verification will fail');
    if (!ADMIN_TOKEN) console.log('🔒 Admin API disabled (set ADMIN_TOKEN to enable)');
    console.log(`======================================================\n`);
  });
}
