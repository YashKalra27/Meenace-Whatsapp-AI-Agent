import fs from 'fs';
import path from 'path';
import { WebhookLog } from '../types/index.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const LOGS_FILE = path.join(DATA_DIR, 'webhook_logs.json');
const MAX_LOGS = 500;

export class WebhookLogger {
  private logs: WebhookLog[] = [];

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(LOGS_FILE)) {
        const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
        this.logs = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LOGS_FILE, JSON.stringify(this.logs.slice(0, MAX_LOGS), null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save webhook logs:', err);
    }
  }

  public log(entry: Omit<WebhookLog, 'id' | 'timestamp'>): WebhookLog {
    const fullLog: WebhookLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry
    };

    this.logs.unshift(fullLog);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }
    this.save();

    return fullLog;
  }

  public getLogs(limit = 100): WebhookLog[] {
    return this.logs.slice(0, limit);
  }

  public clearLogs(): void {
    this.logs = [];
    this.save();
  }
}

export const webhookLogger = new WebhookLogger();
