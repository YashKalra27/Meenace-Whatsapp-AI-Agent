import dotenv from 'dotenv';
import {
  WhatsAppSendTextParams,
  WhatsAppSendButtonsParams,
  WhatsAppSendListParams,
  WhatsAppSendFlowParams,
  WhatsAppSendTemplateParams
} from '../types/index.js';
import { webhookLogger } from '../logger/webhookLogger.js';
import { escalationManager } from '../escalation/manager.js';

dotenv.config();

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

  public updateCredentials(token: string, phoneNumberId: string, simulationMode?: boolean) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    if (simulationMode !== undefined) {
      this.isSimulation = simulationMode;
    } else {
      this.isSimulation = !this.token || !this.phoneNumberId;
    }
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

  private async executeSend(payload: Record<string, any>, recipientPhone: string, messageType: string): Promise<any> {
    const startTime = Date.now();
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');

    if (this.isSimulation) {
      const simulatedMsgId = `wamid.HBgL${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const durationMs = Date.now() - startTime + Math.floor(Math.random() * 40 + 20);

      const simResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: cleanPhone, wa_id: cleanPhone }],
        messages: [{ id: simulatedMsgId }]
      };

      webhookLogger.log({
        direction: 'outbound',
        type: messageType as any,
        httpStatus: 200,
        durationMs,
        payload,
        response: simResponse
      });

      // Automatically simulate delivery and read events after realistic delays
      setTimeout(() => {
        escalationManager.updateMessageStatus(recipientPhone, simulatedMsgId, 'delivered');
        webhookLogger.broadcast({
          type: 'STATUS_UPDATE',
          data: { id: simulatedMsgId, status: 'delivered', recipient_id: cleanPhone }
        });
      }, 700);

      setTimeout(() => {
        escalationManager.updateMessageStatus(recipientPhone, simulatedMsgId, 'read');
        webhookLogger.broadcast({
          type: 'STATUS_UPDATE',
          data: { id: simulatedMsgId, status: 'read', recipient_id: cleanPhone }
        });
      }, 1800);

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

      const durationMs = Date.now() - startTime;
      const data = await res.json();

      webhookLogger.log({
        direction: 'outbound',
        type: messageType as any,
        httpStatus: res.status,
        durationMs,
        payload,
        response: data,
        error: !res.ok ? JSON.stringify(data) : undefined
      });

      if (!res.ok) {
        throw new Error(`Meta API error (${res.status}): ${JSON.stringify(data)}`);
      }

      return data;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      webhookLogger.log({
        direction: 'outbound',
        type: 'error',
        httpStatus: 500,
        durationMs,
        payload,
        response: null,
        error: err.message
      });
      throw err;
    }
  }

  public async sendText(params: WhatsAppSendTextParams): Promise<any> {
    const cleanPhone = params.to.replace(/[^0-9]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: Boolean(params.previewUrl),
        body: params.body
      }
    };

    const res = await this.executeSend(payload, params.to, 'message');
    const msgId = res?.messages?.[0]?.id;

    escalationManager.addMessageToThread(params.to, {
      from: 'assistant',
      text: params.body,
      status: 'sent',
      type: 'text',
      metadata: { whatsappMessageId: msgId }
    });

    return res;
  }

  public async sendButtons(params: WhatsAppSendButtonsParams): Promise<any> {
    const cleanPhone = params.to.replace(/[^0-9]/g, '');
    const buttons = params.buttons.slice(0, 3).map(b => ({
      type: 'reply',
      reply: {
        id: b.id,
        title: b.title.slice(0, 20)
      }
    }));

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: params.bodyText },
        action: { buttons }
      }
    };

    if (params.headerText) payload.interactive.header = { type: 'text', text: params.headerText };
    if (params.footerText) payload.interactive.footer = { text: params.footerText };

    const res = await this.executeSend(payload, params.to, 'message');
    const msgId = res?.messages?.[0]?.id;

    escalationManager.addMessageToThread(params.to, {
      from: 'assistant',
      text: `${params.bodyText}\n\n[Buttons: ${params.buttons.map(b => b.title).join(' | ')}]`,
      status: 'sent',
      type: 'interactive_button',
      metadata: { whatsappMessageId: msgId, buttons: params.buttons }
    });

    return res;
  }

  public async sendList(params: WhatsAppSendListParams): Promise<any> {
    const cleanPhone = params.to.replace(/[^0-9]/g, '');
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: params.bodyText },
        action: {
          button: params.buttonText,
          sections: params.sections
        }
      }
    };

    if (params.headerText) payload.interactive.header = { type: 'text', text: params.headerText };
    if (params.footerText) payload.interactive.footer = { text: params.footerText };

    const res = await this.executeSend(payload, params.to, 'message');
    const msgId = res?.messages?.[0]?.id;

    escalationManager.addMessageToThread(params.to, {
      from: 'assistant',
      text: `${params.bodyText}\n[Select from list: ${params.buttonText}]`,
      status: 'sent',
      type: 'interactive_list',
      metadata: { whatsappMessageId: msgId }
    });

    return res;
  }

  public async sendFlow(params: WhatsAppSendFlowParams): Promise<any> {
    const cleanPhone = params.to.replace(/[^0-9]/g, '');
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: params.bodyText },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: params.flowToken || `tok_${Date.now()}`,
            flow_id: params.flowId,
            flow_cta: params.flowCta,
            flow_action: 'navigate',
            flow_action_payload: {
              screen: params.screen || 'SERVICE_SELECTION',
              data: params.data || {}
            }
          }
        }
      }
    };

    if (params.headerText) payload.interactive.header = { type: 'text', text: params.headerText };
    if (params.footerText) payload.interactive.footer = { text: params.footerText };

    const res = await this.executeSend(payload, params.to, 'flow');
    const msgId = res?.messages?.[0]?.id;

    escalationManager.addMessageToThread(params.to, {
      from: 'assistant',
      text: `${params.bodyText}\n📱 [Interactive WhatsApp Flow: ${params.flowCta}]`,
      status: 'sent',
      type: 'flow',
      metadata: { whatsappMessageId: msgId, flowId: params.flowId }
    });

    return res;
  }

  public async sendTemplate(params: WhatsAppSendTemplateParams): Promise<any> {
    const cleanPhone = params.to.replace(/[^0-9]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components: params.components || []
      }
    };

    const res = await this.executeSend(payload, params.to, 'template');
    const msgId = res?.messages?.[0]?.id;

    escalationManager.addMessageToThread(params.to, {
      from: 'assistant',
      text: `📋 [Pre-approved Template: ${params.templateName}]`,
      status: 'sent',
      type: 'template',
      metadata: { whatsappMessageId: msgId, template: params.templateName }
    });

    return res;
  }

  public async markAsRead(messageId: string): Promise<any> {
    if (this.isSimulation) return { success: true };

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    try {
      await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Failed to mark message as read:', e);
    }
  }
}

export const whatsappClient = new WhatsAppClient();
