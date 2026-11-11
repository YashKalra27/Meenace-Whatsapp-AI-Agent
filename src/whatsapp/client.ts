import dotenv from 'dotenv';
import { WhatsAppSendTextParams, WhatsAppSendTemplateParams } from '../types/index.js';
import { webhookLogger } from '../logger/webhookLogger.js';

dotenv.config();

// WhatsApp rejects text bodies longer than 4096 characters
const MAX_TEXT_LENGTH = 4096;

export function splitForWhatsApp(text: string, limit = MAX_TEXT_LENGTH): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    // Prefer breaking at a paragraph, then a line, then a space
    let cut = rest.lastIndexOf('\n\n', limit);
    if (cut < limit / 2) cut = rest.lastIndexOf('\n', limit);
    if (cut < limit / 2) cut = rest.lastIndexOf(' ', limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export class WhatsAppClient {
  private token: string;
  private phoneNumberId: string;
  private apiVersion = 'v21.0';
  private isSimulation: boolean;

  constructor() {
    this.token = process.env.WHATSAPP_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.isSimulation = process.env.SIMULATION_MODE === 'true' || !this.token || !this.phoneNumberId;
  }

  public getStatus() {
    return {
      isSimulation: this.isSimulation,
      hasToken: Boolean(this.token && this.token.length > 10),
      phoneNumberId: this.phoneNumberId || 'simulated-phone-id',
      apiVersion: this.apiVersion
    };
  }

  private getApiUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  private async executeSend(payload: Record<string, any>, messageType: 'message' | 'template'): Promise<any> {
    const startTime = Date.now();

    if (this.isSimulation) {
      const simResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: payload.to, wa_id: payload.to }],
        messages: [{ id: `wamid.sim${Date.now()}` }]
      };
      webhookLogger.log({
        direction: 'outbound',
        type: messageType,
        httpStatus: 200,
        durationMs: Date.now() - startTime,
        payload,
        response: simResponse
      });
      return simResponse;
    }

    try {
      const res = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      webhookLogger.log({
        direction: 'outbound',
        type: messageType,
        httpStatus: res.status,
        durationMs: Date.now() - startTime,
        payload,
        response: data,
        error: !res.ok ? JSON.stringify(data) : undefined
      });

      if (!res.ok) {
        throw new Error(`Meta API error (${res.status}): ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      webhookLogger.log({
        direction: 'outbound',
        type: 'error',
        httpStatus: 500,
        durationMs: Date.now() - startTime,
        payload,
        response: null,
        error: err.message
      });
      throw err;
    }
  }

  // Free-form text: only delivered inside the 24-hour window after the recipient's last message
  public async sendText(params: WhatsAppSendTextParams): Promise<any[]> {
    const to = params.to.replace(/[^0-9]/g, '');
    const results = [];
    for (const body of splitForWhatsApp(params.body)) {
      results.push(await this.executeSend({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: Boolean(params.previewUrl), body }
      }, 'message'));
    }
    return results;
  }

  // Pre-approved template: the only way to message the owner outside the 24-hour window
  public async sendTemplate(params: WhatsAppSendTemplateParams): Promise<any> {
    return this.executeSend({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.to.replace(/[^0-9]/g, ''),
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components: params.components || []
      }
    }, 'template');
  }

  public async markAsRead(messageId: string): Promise<void> {
    if (this.isSimulation) return;
    try {
      await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId })
      });
    } catch (e) {
      console.warn('Failed to mark message as read:', e);
    }
  }
}

export const whatsappClient = new WhatsAppClient();
