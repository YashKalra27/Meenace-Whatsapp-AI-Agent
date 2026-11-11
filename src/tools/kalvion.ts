import { AgentTool } from './types.js';

// Kalvion's backend accepts KALVION_API_TOKEN as a bearer and treats it as the owner,
// so these calls see the same data as the owner signed in to Kalvion's own UI.
const REQUEST_TIMEOUT_MS = 15000;
// Keeps a large reply (full order book, IPO list) from flooding the model's context
const MAX_RESULT_CHARS = 12000;

export function kalvionConfigured(): boolean {
  return Boolean(process.env.KALVION_URL && process.env.KALVION_API_TOKEN);
}

export async function kalvionGet(apiPath: string, query: Record<string, string | number | undefined> = {}): Promise<unknown> {
  const baseUrl = (process.env.KALVION_URL || '').replace(/\/+$/, '');
  const token = process.env.KALVION_API_TOKEN || '';
  if (!baseUrl || !token) {
    return { error: 'Kalvion is not connected to Meenace yet (KALVION_URL and KALVION_API_TOKEN are not set).' };
  }

  const url = new URL(baseUrl + apiPath);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const body = await res.text();
    if (!res.ok) {
      return { error: `Kalvion answered HTTP ${res.status}`, detail: body.slice(0, 500) };
    }
    if (body.length > MAX_RESULT_CHARS) {
      return { truncated: true, note: `Showing the first ${MAX_RESULT_CHARS} characters of the JSON reply.`, data: body.slice(0, MAX_RESULT_CHARS) };
    }
    return JSON.parse(body);
  } catch (err: any) {
    return { error: `Could not reach Kalvion: ${err.message}` };
  }
}

const noParams = { type: 'object', properties: {} };

// Read-only by design. Anything that changes state (bots, orders, config) needs an
// explicit confirmation flow first; see MEENACE.md before adding one.
export const kalvionTools: AgentTool[] = [
  {
    declaration: {
      name: 'kalvion_market_status',
      description: 'Whether the Indian market is open right now, according to Kalvion and Upstox.',
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/market/status')
  },
  {
    declaration: {
      name: 'kalvion_market_indices',
      description: 'Live levels and day change for NIFTY, SENSEX, BANKNIFTY, MIDCPNIFTY, FINNIFTY and India VIX.',
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/market/indices')
  },
  {
    declaration: {
      name: 'kalvion_search_instruments',
      description:
        'Search NSE stocks, indices and futures by name or symbol. Returns Upstox instrument keys, which kalvion_quotes needs.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or symbol, e.g. "RELIANCE" or "HDFC Bank".' },
          limit: { type: 'number', description: 'Maximum results, 1-50. Defaults to 10.' }
        },
        required: ['query']
      }
    },
    run: args => kalvionGet('/api/instruments/search', { q: args.query, limit: args.limit ?? 10 })
  },
  {
    declaration: {
      name: 'kalvion_quotes',
      description: 'Live quotes for one or more Upstox instrument keys (find keys with kalvion_search_instruments).',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          keys: { type: 'string', description: 'Comma-separated instrument keys, e.g. "NSE_EQ|INE002A01018".' }
        },
        required: ['keys']
      }
    },
    run: args => kalvionGet('/api/market/quotes', { keys: args.keys })
  },
  {
    declaration: {
      name: 'kalvion_watchlist',
      description: "The owner's Kalvion watchlist.",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/watchlist')
  },
  {
    declaration: {
      name: 'kalvion_account_summary',
      description: "The owner's Upstox profile and funds (funds are served only 05:30-24:00 IST).",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/account/summary')
  },
  {
    declaration: {
      name: 'kalvion_holdings',
      description: "The owner's Upstox holdings with P&L.",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/account/holdings')
  },
  {
    declaration: {
      name: 'kalvion_positions',
      description: "The owner's open Upstox positions (intraday and F&O) with P&L.",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/account/positions')
  },
  {
    declaration: {
      name: 'kalvion_orders',
      description: "Today's Upstox order book and trades.",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/account/orders')
  },
  {
    declaration: {
      name: 'kalvion_bot_hosts',
      description: 'The EC2 hosts running kalvion-agent that Kalvion is configured to control.',
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/remote/hosts')
  },
  {
    declaration: {
      name: 'kalvion_bots',
      description:
        'State of every trading bot (proto1..proto9) on one EC2 host: running or stopped, dry-run or live. Get host names from kalvion_bot_hosts.',
      parametersJsonSchema: {
        type: 'object',
        properties: { host: { type: 'string', description: 'Host name from kalvion_bot_hosts.' } },
        required: ['host']
      }
    },
    run: args => kalvionGet(`/api/remote/${encodeURIComponent(String(args.host))}/bots`)
  },
  {
    declaration: {
      name: 'kalvion_backtest_jobs',
      description: 'Recent backtest and optimizer jobs with their status and headline results.',
      parametersJsonSchema: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Maximum jobs. Defaults to 10.' } }
      }
    },
    run: args => kalvionGet('/api/jobs', { limit: args.limit ?? 10 })
  },
  {
    declaration: {
      name: 'kalvion_ipo_list',
      description: 'Current and upcoming IPOs from the IPO desk: dates, price band, GMP and subscription.',
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/ipo/list')
  },
  {
    declaration: {
      name: 'kalvion_ipo_applications',
      description: "The owner's IPO applications recorded on the IPO desk.",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/ipo/applications')
  },
  {
    declaration: {
      name: 'kalvion_ipo_allotments',
      description: "The owner's IPO allotment results.",
      parametersJsonSchema: noParams
    },
    run: () => kalvionGet('/api/ipo/allotments')
  }
];
