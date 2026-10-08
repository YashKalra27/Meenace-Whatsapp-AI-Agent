import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { servicesCatalog, defaultBusinessProfile } from '../config/businessData.js';
import { calendarEngine } from '../calendar/engine.js';
import { escalationManager } from '../escalation/manager.js';
import { whatsappClient } from '../whatsapp/client.js';
import { BOOKING_FLOW_ID } from '../flows/bookingFlow.js';

dotenv.config();

const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

export const agentTools: Anthropic.Tool[] = [
  {
    name: 'check_calendar_availability',
    description: 'Check available appointment time slots for a given date (YYYY-MM-DD). Returns open slots and whether the business is closed on that day.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'The date to check in YYYY-MM-DD format (e.g., 2026-10-10).'
        },
        service_id: {
          type: 'string',
          description: 'Optional ID of the service (e.g., srv-strategy, srv-whatsapp-bot).'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'book_appointment',
    description: 'Book and confirm a new appointment for the customer once date, slot, and service are chosen.',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: {
          type: 'string',
          description: 'Full name of the customer.'
        },
        customer_phone: {
          type: 'string',
          description: 'WhatsApp phone number of the customer (e.g. +14155550192).'
        },
        service_id: {
          type: 'string',
          description: 'ID of the service (e.g. srv-strategy, srv-whatsapp-bot, srv-workflow-audit).'
        },
        date: {
          type: 'string',
          description: 'Appointment date in YYYY-MM-DD format.'
        },
        time_slot: {
          type: 'string',
          description: 'Time slot selected (e.g., "10:00 AM", "02:00 PM").'
        },
        notes: {
          type: 'string',
          description: 'Optional context, notes, or project goals provided by customer.'
        }
      },
      required: ['customer_name', 'customer_phone', 'service_id', 'date', 'time_slot']
    }
  },
  {
    name: 'send_booking_flow',
    description: 'Send an interactive native WhatsApp Flow form for appointment booking. Use this when the customer wants a fast, structured 1-click booking experience rather than back-and-forth chat.',
    input_schema: {
      type: 'object',
      properties: {
        customer_phone: {
          type: 'string',
          description: 'The recipient customer phone number.'
        },
        prompt_message: {
          type: 'string',
          description: 'Friendly message introducing the interactive booking form.'
        }
      },
      required: ['customer_phone']
    }
  },
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new date and time slot.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'The ID of the existing appointment (e.g. apt-101).'
        },
        new_date: {
          type: 'string',
          description: 'The new appointment date in YYYY-MM-DD format.'
        },
        new_time_slot: {
          type: 'string',
          description: 'The new time slot.'
        }
      },
      required: ['appointment_id', 'new_date', 'new_time_slot']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment and record the customer reason.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'The ID of the appointment to cancel.'
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation.'
        }
      },
      required: ['appointment_id']
    }
  },
  {
    name: 'lookup_appointments',
    description: 'Look up existing appointments for a customer phone number.',
    input_schema: {
      type: 'object',
      properties: {
        customer_phone: {
          type: 'string',
          description: 'The customer phone number to search.'
        }
      },
      required: ['customer_phone']
    }
  },
  {
    name: 'get_services_catalog',
    description: 'Retrieve the list of all available services, prices, durations, and descriptions.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate the conversation to a human manager/operator. Use whenever the customer requests a human, has complex questions outside your scope, is unhappy, or requires manual review.',
    input_schema: {
      type: 'object',
      properties: {
        customer_phone: {
          type: 'string',
          description: 'The customer phone number.'
        },
        customer_name: {
          type: 'string',
          description: 'Name of the customer if known.'
        },
        reason: {
          type: 'string',
          description: 'Clear reason for the escalation.'
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Urgency level of this escalation.'
        },
        summary: {
          type: 'string',
          description: 'Brief summary of the customer request and conversation.'
        }
      },
      required: ['customer_phone', 'reason', 'summary']
    }
  }
];

function buildSystemPrompt(): string {
  const catalogStr = servicesCatalog.map(s => 
    `• ${s.name} (${s.id}): $${s.priceUSD} | Duration: ${s.durationMinutes} mins | Category: ${s.category}\n  Description: ${s.description}`
  ).join('\n');

  const faqsStr = defaultBusinessProfile.faqs.map(f => 
    `Q: ${f.question}\nA: ${f.answer}`
  ).join('\n\n');

  return `You are Claude, an autonomous WhatsApp AI Assistant for "${defaultBusinessProfile.businessName}".
Your line operates on the official WhatsApp Cloud API. You help customers 24/7 by answering questions about our services, checking calendar availability, booking appointments, and confirming reservations.

CRITICAL OPERATING RULES:
1. TRANSPARENT AI IDENTITY: If asked whether you are a human or a bot, ALWAYS honestly acknowledge you are an autonomous AI assistant powered by Claude. Never pretend to be a human person.
2. ESCALATE WHEN UNSURE: If a customer requests a real human, expresses dissatisfaction, or asks anything you cannot confidently answer with the context below, immediately call the "escalate_to_human" tool and inform them our leadership team has been notified.
3. CONVERSATIONAL & CONCISE: WhatsApp messages must be friendly, clear, and concise. Avoid walls of text. Use bullet points and WhatsApp markdown (*bold* for emphasis).
4. APPOINTMENT BOOKING:
   - When a user asks to book or check times, use "check_calendar_availability" to get live slots.
   - You can also offer the interactive WhatsApp Flow booking form ("send_booking_flow") if they want a clean in-chat form.
   - When booking via chat, collect their name, service, date, and preferred slot, then call "book_appointment".
5. BUSINESS HOURS & POLICIES:
   - Monday-Friday: 9:00 AM - 6:00 PM (Fri until 5:00 PM)
   - Saturday: 10:00 AM - 2:00 PM
   - Sunday: Closed
   - Cancellation/Rescheduling: Free up to 24 hours prior to appointment. Within 24 hours, 50% rescheduling fee.

CURRENT SERVICES CATALOG:
${catalogStr}

FREQUENTLY ASKED QUESTIONS:
${faqsStr}

Today is ${new Date().toISOString().split('T')[0]}. Current time is ${new Date().toLocaleTimeString('en-US')}.`;
}

export async function executeTool(name: string, input: any): Promise<any> {
  switch (name) {
    case 'check_calendar_availability':
      return calendarEngine.getAvailableSlots(input.date, input.service_id);

    case 'book_appointment':
      return calendarEngine.bookAppointment({
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        serviceId: input.service_id,
        date: input.date,
        timeSlot: input.time_slot,
        notes: input.notes
      });

    case 'send_booking_flow': {
      await whatsappClient.sendFlow({
        to: input.customer_phone,
        headerText: '📅 Direct Scheduling',
        bodyText: input.prompt_message || 'Please tap below to open our interactive booking form directly in WhatsApp:',
        footerText: 'Powered by Claude & WhatsApp Cloud API',
        flowId: BOOKING_FLOW_ID,
        flowCta: 'Open Booking Form',
        screen: 'SERVICE_SELECTION'
      });
      return { success: true, message: 'WhatsApp Flow sent to customer phone.' };
    }

    case 'reschedule_appointment':
      return calendarEngine.rescheduleAppointment(input.appointment_id, input.new_date, input.new_time_slot);

    case 'cancel_appointment':
      return calendarEngine.cancelAppointment(input.appointment_id, input.reason);

    case 'lookup_appointments':
      return calendarEngine.getAppointmentsByPhone(input.customer_phone);

    case 'get_services_catalog':
      return servicesCatalog;

    case 'escalate_to_human':
      return escalationManager.escalate({
        customerPhone: input.customer_phone,
        customerName: input.customer_name,
        reason: input.reason,
        urgency: input.urgency || 'medium',
        summary: input.summary
      });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function processWithClaude(params: {
  incomingText: string;
  customerPhone: string;
  customerName?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ reply: string; toolsUsed: string[]; reasoningTrace?: string }> {
  const { incomingText, customerPhone, customerName } = params;
  const toolsUsed: string[] = [];

  // Check if live Anthropic API key is available
  if (anthropic && anthropicApiKey) {
    try {
      const messages: Anthropic.MessageParam[] = (params.conversationHistory || []).map(m => ({
        role: m.role,
        content: m.content
      }));

      messages.push({
        role: 'user',
        content: `[Sender: ${customerName || 'Customer'} (${customerPhone})]: ${incomingText}`
      });

      let response = await anthropic.messages.create({
        model: claudeModel,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        tools: agentTools,
        messages
      });

      // Handle tool call iterations
      while (response.stop_reason === 'tool_use') {
        const toolUseBlock = response.content.find(c => c.type === 'tool_use') as Anthropic.ToolUseBlock;
        if (!toolUseBlock) break;

        toolsUsed.push(toolUseBlock.name);
        const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input);

        messages.push({
          role: 'assistant',
          content: response.content
        });

        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(toolResult)
            }
          ]
        });

        response = await anthropic.messages.create({
          model: claudeModel,
          max_tokens: 1024,
          system: buildSystemPrompt(),
          tools: agentTools,
          messages
        });
      }

      const textBlock = response.content.find(c => c.type === 'text') as Anthropic.TextBlock;
      const reply = textBlock ? textBlock.text : 'I have processed your request.';
      return { reply, toolsUsed };
    } catch (apiError: any) {
      console.warn('[CLAUDE API ERROR] Falling back to intelligent engine:', apiError.message);
    }
  }

  // Fallback / Sandbox Intelligent Reasoner
  return executeIntelligentFallback(incomingText, customerPhone, customerName);
}

async function executeIntelligentFallback(
  text: string,
  customerPhone: string,
  customerName = 'Customer'
): Promise<{ reply: string; toolsUsed: string[]; reasoningTrace?: string }> {
  const lower = text.toLowerCase();
  const toolsUsed: string[] = [];
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // 1. Identity Question ("Are you an AI? / Who are you? / Are you human?")
  if (
    lower.includes('who are you') ||
    lower.includes('are you ai') ||
    lower.includes('are you an ai') ||
    lower.includes('are you a bot') ||
    lower.includes('are you real') ||
    lower.includes('are you human') ||
    lower.includes('are you a human') ||
    lower.includes('is this an ai')
  ) {
    return {
      reply: `Hi! I am *Claude*, an autonomous AI assistant for *${defaultBusinessProfile.businessName}* operating on the official WhatsApp Cloud API. 🤖\n\nI can answer questions about our services, check live calendar availability, book appointments, and send reminders. How can I help you today?`,
      toolsUsed: [],
      reasoningTrace: 'Answered AI identity inquiry with mandatory transparency disclosure.'
    };
  }

  // 2. Human Escalation Request
  if (
    lower.includes('speak with a human') ||
    lower.includes('talk to a human') ||
    lower.includes('speak to a person') ||
    lower.includes('talk to someone') ||
    lower.includes('human agent') ||
    lower.includes('human manager') ||
    lower.includes('speak with a representative') ||
    lower.includes('complaint') ||
    (lower.includes('human') && (lower.includes('want') || lower.includes('need') || lower.includes('demand') || lower.includes('connect'))) ||
    lower.includes('manager')
  ) {
    toolsUsed.push('escalate_to_human');
    await executeTool('escalate_to_human', {
      customer_phone: customerPhone,
      customer_name: customerName,
      reason: 'Customer explicitly asked to speak with a human team member.',
      urgency: 'high',
      summary: `Customer text: "${text}"`
    });

    return {
      reply: `I understand completely! I have escalated your request to our senior leadership team right now. 🔔\n\nA human specialist will review your chat and reply on this WhatsApp line shortly. Bot automated responses are paused for this conversation.`,
      toolsUsed,
      reasoningTrace: 'Triggered human escalation flow. Paused bot replies, created ticket tkt-..., and alerted operator.'
    };
  }

  // 3. Services & Pricing Inquiry
  if (
    lower.includes('service') ||
    lower.includes('price') ||
    lower.includes('cost') ||
    lower.includes('package') ||
    lower.includes('what do you do') ||
    lower.includes('offer')
  ) {
    toolsUsed.push('get_services_catalog');
    const catalog = await executeTool('get_services_catalog', {});
    const items = catalog.map((s: any) => `*${s.name}* — $${s.priceUSD}\n⏱ ${s.durationMinutes} mins · ${s.description}`).join('\n\n');

    return {
      reply: `Here are our current AI automation and deployment services:\n\n${items}\n\nWould you like to check available slots for a consultation, or open our interactive booking form?`,
      toolsUsed,
      reasoningTrace: 'Retrieved services catalog and presented formatted pricing tiers.'
    };
  }

  // 4. WhatsApp Flow / Interactive Form Request
  if (lower.includes('flow') || lower.includes('form') || lower.includes('interactive') || lower.includes('mini-app')) {
    toolsUsed.push('send_booking_flow');
    await executeTool('send_booking_flow', {
      customer_phone: customerPhone,
      prompt_message: 'Tap the button below to launch our native in-chat booking form:'
    });

    return {
      reply: `I've sent our native WhatsApp booking form above! 📋 You can select your desired service, date, and preferred time slot in just a couple of taps.`,
      toolsUsed,
      reasoningTrace: 'Dispatched interactive WhatsApp Flow (mini-app) form.'
    };
  }

  // 5. Booking Inquiry or Calendar Availability
  if (
    lower.includes('book') ||
    lower.includes('schedule') ||
    lower.includes('calendar') ||
    lower.includes('availability') ||
    lower.includes('available') ||
    lower.includes('appointment') ||
    lower.includes('tomorrow') ||
    lower.includes('today')
  ) {
    const targetDate = lower.includes('today') ? today : tomorrow;
    toolsUsed.push('check_calendar_availability');
    const availability = await executeTool('check_calendar_availability', { date: targetDate });

    if (lower.includes('confirm') || lower.includes('book me') || lower.includes('10:00') || lower.includes('11:00') || lower.includes('2:00') || lower.includes('02:00')) {
      const slot = lower.includes('11:00') ? '11:00 AM' : lower.includes('02:00') || lower.includes('2:00') ? '02:00 PM' : '10:00 AM';
      toolsUsed.push('book_appointment');
      const booking = await executeTool('book_appointment', {
        customer_name: customerName !== 'Customer' ? customerName : 'WhatsApp Client',
        customer_phone: customerPhone,
        service_id: 'srv-strategy',
        date: targetDate,
        time_slot: slot,
        notes: `Booked via WhatsApp: "${text}"`
      });

      if (booking.success) {
        return {
          reply: `🎉 *Appointment Confirmed!*\n\n• *Service:* ${booking.appointment.serviceName}\n• *Date:* ${booking.appointment.date}\n• *Time:* ${booking.appointment.timeSlot}\n• *Booking ID:* ${booking.appointment.id}\n\nYou'll receive an automated reminder on WhatsApp the morning of your session. If you ever need to reschedule, just message us here!`,
          toolsUsed,
          reasoningTrace: `Executed calendar booking tool for ${slot} on ${targetDate}.`
        };
      }
    }

    const slotList = availability.slots.length > 0 ? availability.slots.map((s: string) => `• ${s}`).join('\n') : 'No open slots on this date.';

    return {
      reply: `📅 For *${targetDate}*, we have the following slots open:\n\n${slotList}\n\nTo book, simply reply with your preferred time slot and full name, or reply "flow" to open the interactive booking form!`,
      toolsUsed,
      reasoningTrace: `Checked availability for date ${targetDate}. Returned ${availability.slots.length} available slots.`
    };
  }

  // 6. Cancellation Request
  if (lower.includes('cancel')) {
    toolsUsed.push('lookup_appointments');
    const userApts = await executeTool('lookup_appointments', { customer_phone: customerPhone });
    const confirmed = userApts.find((a: any) => a.status === 'confirmed');

    if (confirmed) {
      toolsUsed.push('cancel_appointment');
      await executeTool('cancel_appointment', {
        appointment_id: confirmed.id,
        reason: text
      });
      return {
        reply: `Your appointment *${confirmed.id}* for *${confirmed.serviceName}* on ${confirmed.date} at ${confirmed.timeSlot} has been cancelled as requested. You are welcome to rebook anytime!`,
        toolsUsed,
        reasoningTrace: `Looked up and cancelled appointment ${confirmed.id}.`
      };
    } else {
      return {
        reply: `I searched our calendar records for ${customerPhone} but did not find an active confirmed appointment to cancel. Would you like me to connect you with our team?`,
        toolsUsed,
        reasoningTrace: 'Lookup returned no active bookings for cancellation.'
      };
    }
  }

  // 7. Hours, Policies & Location
  if (lower.includes('hours') || lower.includes('open') || lower.includes('when') || lower.includes('location') || lower.includes('address')) {
    return {
      reply: `🕒 *Business Hours:*\n• Monday – Friday: 9:00 AM – 6:00 PM PST\n• Saturday: 10:00 AM – 2:00 PM PST\n• Sunday: Closed\n\n📍 *Office:* ${defaultBusinessProfile.address}\n🌐 *Website:* ${defaultBusinessProfile.website}`,
      toolsUsed: [],
      reasoningTrace: 'Provided business hours and office details.'
    };
  }

  // Default friendly response
  return {
    reply: `Hello! 👋 Thanks for messaging *${defaultBusinessProfile.businessName}*.\n\nI am your AI assistant on this WhatsApp line. Here is how I can assist:\n1. 📅 *Check Availability & Book Appointments*\n2. 💼 *View AI Services & Pricing*\n3. 📋 *Open Interactive Booking Form*\n4. 👤 *Speak with a Human Representative*\n\nHow can I help you today?`,
    toolsUsed: [],
    reasoningTrace: 'General greeting and capability overview.'
  };
}
