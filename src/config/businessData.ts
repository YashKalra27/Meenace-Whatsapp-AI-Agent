import { BusinessProfile, ServiceItem } from '../types/index.js';

export const servicesCatalog: ServiceItem[] = [
  {
    id: 'srv-strategy',
    name: 'AI Automation Strategy Session',
    description: '1-on-1 strategic roadmap review, architecture blueprint, feasibility check, and ROI calculation.',
    durationMinutes: 45,
    priceUSD: 199,
    category: 'Consultation'
  },
  {
    id: 'srv-whatsapp-bot',
    name: 'Custom WhatsApp AI Agent Implementation',
    description: 'Complete setup of official Meta WhatsApp Cloud API with Claude 3.5 Sonnet, calendar tools, CRM hooks & Flows.',
    durationMinutes: 60,
    priceUSD: 1499,
    category: 'Implementation'
  },
  {
    id: 'srv-workflow-audit',
    name: 'Process & Security Workflow Audit',
    description: 'In-depth diagnostic of your existing customer service pipelines, latency bottlenecks, and Meta API compliance review.',
    durationMinutes: 60,
    priceUSD: 499,
    category: 'Audit'
  },
  {
    id: 'srv-retainer',
    name: 'Monthly Agent Optimization & Retainer',
    description: 'Ongoing prompt engineering, tool maintenance, SLA monitoring, and template performance fine-tuning.',
    durationMinutes: 30,
    priceUSD: 850,
    category: 'Retainer'
  }
];

export const defaultBusinessProfile: BusinessProfile = {
  businessName: 'Apex AI Solutions',
  description: 'Specialists in deploying production-grade AI agents with dedicated phone numbers on the official WhatsApp Cloud API.',
  phone: '+1 (415) 890-2244',
  email: 'team@apex-ai.solutions',
  address: '500 Howard Street, Suite 400, San Francisco, CA 94105',
  timezone: 'America/Los_Angeles (PST/PDT)',
  website: 'https://apex-ai.solutions',
  businessHours: {
    monday: { open: '09:00', close: '18:00', isClosed: false },
    tuesday: { open: '09:00', close: '18:00', isClosed: false },
    wednesday: { open: '09:00', close: '18:00', isClosed: false },
    thursday: { open: '09:00', close: '18:00', isClosed: false },
    friday: { open: '09:00', close: '17:00', isClosed: false },
    saturday: { open: '10:00', close: '14:00', isClosed: false },
    sunday: { open: '00:00', close: '00:00', isClosed: true }
  },
  policies: {
    cancellationPolicy: 'Appointments may be cancelled or rescheduled up to 24 hours in advance with a full refund or free reschedule credit. Cancellations within 24 hours are subject to a 50% rescheduling fee.',
    reschedulePolicy: 'Rescheduling is free and can be done anytime prior to the 24-hour cutoff window before your appointment.',
    refundPolicy: 'Full money-back guarantee if you are not completely satisfied with our strategy consultation within 7 days.',
    aiDisclosurePolicy: 'We are completely transparent that this WhatsApp line is powered by an autonomous Claude AI agent. When asked, always honestly confirm you are an automated AI assistant.',
    escalationPolicy: 'If a customer requests a human, expresses dissatisfaction, has custom contract inquiries, or requires manual review, immediate escalation occurs and pauses the bot.'
  },
  faqs: [
    {
      question: 'Do I need a new phone or SIM card for my agent?',
      answer: 'No! With the official WhatsApp Cloud API, you can use a fresh Hosted Number (issued in ~2 mins without any SIM), your existing business SIM (verified once), or sync with the WhatsApp Business app.'
    },
    {
      question: 'Will my WhatsApp number get banned for automation?',
      answer: 'No, because we use the official Meta WhatsApp Cloud API directly. Unofficial scrapers or browser-automation tools get banned, but official Cloud API accounts are fully approved and sanctioned by Meta.'
    },
    {
      question: 'What is the 24-hour customer service window?',
      answer: 'When a customer messages your number, Meta opens a 24-hour freeform messaging window where your agent can send regular responses freely. Outside the 24 hours, only pre-approved WhatsApp templates (like reminders or follow-ups) can be sent.'
    },
    {
      question: 'Can I speak with a real human?',
      answer: 'Yes! At any point, say "talk to a human" or "speak to an agent", and our system immediately escalates the chat to our founding team and pauses bot automation.'
    },
    {
      question: 'What are WhatsApp Flows?',
      answer: 'WhatsApp Flows are native in-chat mini-apps that allow customers to select services, pick dates, and submit booking forms directly inside WhatsApp without leaving the conversation.'
    }
  ]
};
