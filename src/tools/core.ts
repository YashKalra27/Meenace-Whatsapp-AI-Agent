import { AgentTool } from './types.js';

// NSE regular session, Monday to Friday. Exchange holidays are not known here.
const SESSION_OPEN_MINUTES = 9 * 60 + 15;
const SESSION_CLOSE_MINUTES = 15 * 60 + 30;

export function istNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now).map(p => [p.type, p.value])
  );
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = parts.weekday;
  const isWeekday = weekday !== 'Saturday' && weekday !== 'Sunday';
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday,
    nseRegularSessionOpen: isWeekday && minutes >= SESSION_OPEN_MINUTES && minutes < SESSION_CLOSE_MINUTES
  };
}

export const coreTools: AgentTool[] = [
  {
    declaration: {
      name: 'get_current_time_ist',
      description:
        'Current date, time and weekday in India (IST), and whether the NSE regular session (Mon-Fri 09:15-15:30 IST) is open by the clock. Exchange holidays are not accounted for; use kalvion_market_status for the authoritative market state.',
      parametersJsonSchema: { type: 'object', properties: {} }
    },
    run: async () => istNow()
  }
];
