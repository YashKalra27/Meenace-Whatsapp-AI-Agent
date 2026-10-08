import fs from 'fs';
import path from 'path';
import { Appointment, ServiceItem } from '../types/index.js';
import { servicesCatalog, defaultBusinessProfile } from '../config/businessData.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');

export class CalendarEngine {
  private appointments: Appointment[] = [];

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(APPOINTMENTS_FILE)) {
        const raw = fs.readFileSync(APPOINTMENTS_FILE, 'utf-8');
        this.appointments = JSON.parse(raw);
      } else {
        // Seed with sample initial appointments
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        this.appointments = [
          {
            id: 'apt-101',
            customerName: 'Sarah Jenkins',
            customerPhone: '+14155550192',
            serviceId: 'srv-strategy',
            serviceName: 'AI Automation Strategy Session',
            date: today,
            timeSlot: '11:00 AM',
            status: 'confirmed',
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 86400000,
            notes: 'Looking to automate lead intake on WhatsApp for real estate agency.',
            reminderSent: false
          },
          {
            id: 'apt-102',
            customerName: 'David Chen',
            customerPhone: '+14155550188',
            serviceId: 'srv-whatsapp-bot',
            serviceName: 'Custom WhatsApp AI Agent Implementation',
            date: tomorrow,
            timeSlot: '02:00 PM',
            status: 'confirmed',
            createdAt: Date.now() - 43200000,
            updatedAt: Date.now() - 43200000,
            notes: 'E-commerce store support bot integration.',
            reminderSent: false
          }
        ];
        this.save();
      }
    } catch (err) {
      console.error('Failed to load appointments storage, starting in-memory:', err);
      this.appointments = [];
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(this.appointments, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving appointments:', err);
    }
  }

  public getAllAppointments(): Appointment[] {
    return [...this.appointments].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.timeSlot.localeCompare(b.timeSlot);
    });
  }

  public getAppointmentById(id: string): Appointment | undefined {
    return this.appointments.find(a => a.id === id);
  }

  public getAppointmentsByPhone(phone: string): Appointment[] {
    const clean = phone.replace(/[^0-9]/g, '');
    return this.appointments.filter(a => a.customerPhone.replace(/[^0-9]/g, '') === clean);
  }

  public getAvailableSlots(dateStr: string, _serviceId?: string): { date: string; slots: string[]; isClosed: boolean; reason?: string } {
    const targetDate = new Date(dateStr + 'T00:00:00');
    if (isNaN(targetDate.getTime())) {
      return { date: dateStr, slots: [], isClosed: true, reason: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[targetDate.getDay()];
    const hours = defaultBusinessProfile.businessHours[dayName];

    if (!hours || hours.isClosed) {
      return { date: dateStr, slots: [], isClosed: true, reason: `We are closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.` };
    }

    // Generate potential slots between open and close
    const allSlots = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

    // Booked slots for this date
    const bookedSlots = this.appointments
      .filter(a => a.date === dateStr && a.status === 'confirmed')
      .map(a => a.timeSlot);

    const available = allSlots.filter(s => !bookedSlots.includes(s));

    return {
      date: dateStr,
      slots: available,
      isClosed: false
    };
  }

  public bookAppointment(params: {
    customerName: string;
    customerPhone: string;
    serviceId: string;
    date: string;
    timeSlot: string;
    notes?: string;
  }): { success: boolean; appointment?: Appointment; error?: string } {
    const service = servicesCatalog.find(s => s.id === params.serviceId || s.name.toLowerCase().includes(params.serviceId.toLowerCase()));
    if (!service) {
      return { success: false, error: `Service '${params.serviceId}' not found. Please choose a valid service.` };
    }

    const availability = this.getAvailableSlots(params.date);
    if (availability.isClosed) {
      return { success: false, error: availability.reason || 'We are closed on this date.' };
    }

    if (!availability.slots.includes(params.timeSlot)) {
      return {
        success: false,
        error: `Slot ${params.timeSlot} on ${params.date} is already booked or unavailable. Available slots: ${availability.slots.join(', ')}`
      };
    }

    const newAppointment: Appointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      serviceId: service.id,
      serviceName: service.name,
      date: params.date,
      timeSlot: params.timeSlot,
      status: 'confirmed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: params.notes || '',
      reminderSent: false
    };

    this.appointments.push(newAppointment);
    this.save();

    return { success: true, appointment: newAppointment };
  }

  public rescheduleAppointment(appointmentId: string, newDate: string, newTimeSlot: string): { success: boolean; appointment?: Appointment; error?: string } {
    const apt = this.appointments.find(a => a.id === appointmentId);
    if (!apt) {
      return { success: false, error: `Appointment ${appointmentId} was not found.` };
    }

    const availability = this.getAvailableSlots(newDate);
    if (availability.isClosed) {
      return { success: false, error: availability.reason || 'Closed on that date.' };
    }

    if (!availability.slots.includes(newTimeSlot) && !(apt.date === newDate && apt.timeSlot === newTimeSlot)) {
      return { success: false, error: `Slot ${newTimeSlot} on ${newDate} is not available.` };
    }

    apt.date = newDate;
    apt.timeSlot = newTimeSlot;
    apt.status = 'rescheduled';
    apt.updatedAt = Date.now();
    apt.reminderSent = false;
    this.save();

    return { success: true, appointment: apt };
  }

  public cancelAppointment(appointmentId: string, reason?: string): { success: boolean; appointment?: Appointment; error?: string } {
    const apt = this.appointments.find(a => a.id === appointmentId);
    if (!apt) {
      return { success: false, error: `Appointment ${appointmentId} was not found.` };
    }

    apt.status = 'cancelled';
    apt.updatedAt = Date.now();
    if (reason) {
      apt.notes = `${apt.notes ? apt.notes + ' | ' : ''}Cancellation reason: ${reason}`;
    }
    this.save();

    return { success: true, appointment: apt };
  }

  public getDueMorningReminders(): Appointment[] {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments.filter(a => a.date === today && a.status === 'confirmed' && !a.reminderSent);
  }

  public markReminderSent(appointmentId: string): void {
    const apt = this.appointments.find(a => a.id === appointmentId);
    if (apt) {
      apt.reminderSent = true;
      apt.reminderSentAt = Date.now();
      this.save();
    }
  }
}

export const calendarEngine = new CalendarEngine();
