export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<WhatsAppInboundMessage>;
        statuses?: Array<WhatsAppStatusUpdate>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: {
    text: string;
    payload: string;
  };
}

export interface WhatsAppStatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
}

export interface WhatsAppSendTextParams {
  to: string;
  body: string;
  previewUrl?: boolean;
}

export interface WhatsAppSendTemplateParams {
  to: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    sub_type?: string;
    index?: string;
    parameters: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image';
      text?: string;
      [key: string]: any;
    }>;
  }>;
}

export interface CustomerWindowStatus {
  customerPhone: string;
  lastCustomerMessageAt: number;
  windowExpiresAt: number;
  isOpen: boolean;
  remainingMinutes: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface WebhookLog {
  id: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  type: 'message' | 'status' | 'verification' | 'template' | 'command' | 'ignored' | 'error';
  httpStatus: number;
  durationMs: number;
  payload: any;
  response: any;
  error?: string;
  agentReasoning?: string;
  toolsUsed?: string[];
}
