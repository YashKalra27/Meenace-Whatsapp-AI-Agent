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
  type: 'text' | 'interactive' | 'button' | 'image' | 'audio' | 'document' | 'location';
  text?: {
    body: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply' | 'nfm_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
    nfm_reply?: {
      response_json: string;
      body: string;
      name: string;
    };
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
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
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

export interface WhatsAppSendButtonsParams {
  to: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: Array<{
    id: string;
    title: string;
  }>;
}

export interface WhatsAppSendListParams {
  to: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface WhatsAppSendFlowParams {
  to: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  flowId: string;
  flowCta: string;
  flowToken?: string;
  screen?: string;
  data?: Record<string, any>;
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

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceUSD: number;
  category: 'Consultation' | 'Implementation' | 'Audit' | 'Retainer';
}

export interface BusinessProfile {
  businessName: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  website: string;
  businessHours: Record<string, { open: string; close: string; isClosed: boolean }>;
  policies: {
    cancellationPolicy: string;
    reschedulePolicy: string;
    refundPolicy: string;
    aiDisclosurePolicy: string;
    escalationPolicy: string;
  };
  faqs: Array<{ question: string; answer: string }>;
}

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM"
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';
  createdAt: number;
  updatedAt: number;
  notes?: string;
  reminderSent: boolean;
  reminderSentAt?: number;
}

export interface EscalationTicket {
  id: string;
  customerPhone: string;
  customerName: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  summary: string;
  status: 'open' | 'claimed' | 'resolved';
  createdAt: number;
  claimedBy?: string;
  resolvedAt?: number;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  from: 'customer' | 'assistant' | 'human_agent' | 'system';
  senderName?: string;
  text: string;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  type?: 'text' | 'interactive_button' | 'interactive_list' | 'flow' | 'template';
  metadata?: Record<string, any>;
}

export interface ConversationThread {
  customerPhone: string;
  customerName: string;
  mode: 'bot' | 'human_takeover';
  escalated: boolean;
  escalationId?: string;
  lastActivity: number;
  messages: ChatMessage[];
  unreadByHuman: number;
}

export interface WebhookLog {
  id: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  type: 'message' | 'status' | 'flow' | 'verification' | 'template' | 'error';
  httpStatus: number;
  durationMs: number;
  payload: any;
  response: any;
  error?: string;
  claudeReasoning?: string;
  toolsUsed?: string[];
}
