import { calendarEngine } from './engine.js';
import { whatsappClient } from '../whatsapp/client.js';
import { webhookLogger } from '../logger/webhookLogger.js';
import { escalationManager } from '../escalation/manager.js';

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[SCHEDULER] Morning appointment reminder & follow-up scheduler started.');

    // Check every 60 seconds
    this.timer = setInterval(() => {
      this.checkAndSendReminders();
    }, 60 * 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public async checkAndSendReminders(): Promise<{ sentCount: number; appointments: any[] }> {
    const dueAppointments = calendarEngine.getDueMorningReminders();
    const sentList: any[] = [];

    for (const apt of dueAppointments) {
      try {
        console.log(`[SCHEDULER] Dispatching morning reminder for appointment ${apt.id} to ${apt.customerPhone}`);

        const reminderBody = `Good morning ${apt.customerName}! 📅 Reminder: Your session for "${apt.serviceName}" is scheduled for today at ${apt.timeSlot}. If you need to reschedule or have questions, simply reply here!`;

        // Outside 24h window or for automated morning reminder, Meta requires template or interactive
        await whatsappClient.sendTemplate({
          to: apt.customerPhone,
          templateName: 'appointment_reminder_v1',
          languageCode: 'en_US',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: apt.customerName },
                { type: 'text', text: apt.serviceName },
                { type: 'text', text: 'Today' },
                { type: 'text', text: apt.timeSlot }
              ]
            }
          ]
        });

        // Also add readable notification to thread
        escalationManager.addMessageToThread(apt.customerPhone, {
          from: 'assistant',
          text: reminderBody,
          status: 'sent',
          type: 'template'
        });

        calendarEngine.markReminderSent(apt.id);
        sentList.push(apt);

        webhookLogger.log({
          direction: 'outbound',
          type: 'template',
          httpStatus: 200,
          durationMs: 45,
          payload: { appointmentId: apt.id, recipient: apt.customerPhone },
          response: { status: 'reminder_dispatched', time: new Date().toISOString() }
        });
      } catch (err: any) {
        console.error(`[SCHEDULER] Error sending reminder for ${apt.id}:`, err);
      }
    }

    return { sentCount: sentList.length, appointments: sentList };
  }

  public async sendFollowUpQuote(customerPhone: string, customerName: string): Promise<any> {
    const followUpBody = `Hi ${customerName}! Just following up on our chat from a few days ago regarding your AI automation inquiry. Did you have any further questions or would you like to review available appointment times?`;

    const res = await whatsappClient.sendTemplate({
      to: customerPhone,
      templateName: 'follow_up_quote_v1',
      languageCode: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: customerName }]
        }
      ]
    });

    escalationManager.addMessageToThread(customerPhone, {
      from: 'assistant',
      text: followUpBody,
      status: 'sent',
      type: 'template'
    });

    webhookLogger.log({
      direction: 'outbound',
      type: 'template',
      httpStatus: 200,
      durationMs: 30,
      payload: { recipient: customerPhone, type: 'follow_up_quote_day_3' },
      response: { status: 'follow_up_sent' }
    });

    return res;
  }
}

export const reminderScheduler = new ReminderScheduler();
