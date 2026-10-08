import fs from 'fs';
import path from 'path';
import { CustomerWindowStatus } from '../types/index.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WINDOWS_FILE = path.join(DATA_DIR, 'windows.json');
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class WindowManager {
  private windows: Map<string, number> = new Map(); // phone -> lastCustomerMessageTimestamp

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(WINDOWS_FILE)) {
        const raw = fs.readFileSync(WINDOWS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [phone, ts] of Object.entries(data)) {
          this.windows.set(phone, Number(ts));
        }
      }
    } catch (err) {
      console.error('Failed to load window storage:', err);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const obj: Record<string, number> = {};
      for (const [phone, ts] of this.windows.entries()) {
        obj[phone] = ts;
      }
      fs.writeFileSync(WINDOWS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving windows:', err);
    }
  }

  public recordCustomerInbound(phone: string): void {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    this.windows.set(cleanPhone, Date.now());
    this.save();
  }

  public getWindowStatus(phone: string): CustomerWindowStatus {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const lastCustomerMessageAt = this.windows.get(cleanPhone) || 0;
    const now = Date.now();
    const windowExpiresAt = lastCustomerMessageAt + TWENTY_FOUR_HOURS_MS;
    const isOpen = lastCustomerMessageAt > 0 && now < windowExpiresAt;
    const remainingMs = Math.max(0, windowExpiresAt - now);
    const remainingMinutes = Math.floor(remainingMs / (60 * 1000));

    return {
      customerPhone: phone,
      lastCustomerMessageAt,
      windowExpiresAt,
      isOpen,
      remainingMinutes
    };
  }

  public isFreeformAllowed(phone: string): boolean {
    return this.getWindowStatus(phone).isOpen;
  }
}

export const windowManager = new WindowManager();
