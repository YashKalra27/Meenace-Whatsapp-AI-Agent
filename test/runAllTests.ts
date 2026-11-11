import http from 'http';
import { AddressInfo } from 'net';

// Configure before the modules load: they read the environment at import time
const OWNER = '919800000001';
process.env.NODE_ENV = 'test';
process.env.OWNER_PHONE = `+${OWNER}`;
process.env.SIMULATION_MODE = 'true';
process.env.GEMINI_API_KEY = '';
delete process.env.KALVION_URL;
delete process.env.KALVION_API_TOKEN;

const { windowManager } = await import('../src/whatsapp/windowManager.js');
const { splitForWhatsApp } = await import('../src/whatsapp/client.js');
const { conversationStore } = await import('../src/conversation/store.js');
const { agentTools, executeTool } = await import('../src/tools/index.js');
const { kalvionGet } = await import('../src/tools/kalvion.js');
const { istNow } = await import('../src/tools/core.js');
const { processWithAgent, NOT_CONFIGURED_REPLY } = await import('../src/agent/gemini.js');
const { handleInboundMessage } = await import('../src/server.js');
const { webhookLogger } = await import('../src/logger/webhookLogger.js');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${testName} ${extra}`);
  }
}

// -------------------------------------------------------------------------
console.log('\n📋 Suite 1: 24-Hour Meta Service Window');
windowManager.recordCustomerInbound(OWNER);
const window = windowManager.getWindowStatus(OWNER);
assert(window.isOpen, 'Inbound message opens the 24h window');
assert(window.remainingMinutes > 1430, 'Window lasts about 24 hours');

// -------------------------------------------------------------------------
console.log('\n📋 Suite 2: Conversation Store');
conversationStore.append(OWNER, 'user', 'first');
conversationStore.append(OWNER, 'assistant', 'second');
assert(conversationStore.recent(`+${OWNER}`, 10).length === 2, 'History is keyed by digits, whatever the formatting');
assert(conversationStore.recent(OWNER, 1)[0].text === 'second', 'recent() returns the latest messages');
for (let i = 0; i < 60; i++) conversationStore.append(OWNER, 'user', `m${i}`);
assert(conversationStore.recent(OWNER, 100).length === 50, 'History is capped at 50 messages');
conversationStore.clear(OWNER);
assert(conversationStore.recent(OWNER, 10).length === 0, 'clear() forgets the conversation');

// -------------------------------------------------------------------------
console.log('\n📋 Suite 3: WhatsApp Message Splitting');
assert(splitForWhatsApp('short').length === 1, 'Short text stays one message');
const long = Array.from({ length: 300 }, (_, i) => `Line ${i} with some text to fill it out`).join('\n');
const chunks = splitForWhatsApp(long);
assert(chunks.length > 1 && chunks.every(c => c.length <= 4096), `Long text splits under 4096 chars (${chunks.length} parts)`);
assert(chunks.join('\n') === long, 'Splitting on line breaks loses nothing');

// -------------------------------------------------------------------------
console.log('\n📋 Suite 4: Tool Registry & IST Clock');
const names = agentTools.map(t => t.declaration.name || '');
assert(new Set(names).size === names.length, `Tool names are unique (${names.length} tools)`);
assert(names.every(n => /^[a-z0-9_]+$/.test(n)), 'Tool names are snake_case');
const unknown: any = await executeTool('no_such_tool', {});
assert(typeof unknown?.error === 'string', 'Unknown tool returns an error instead of throwing');
const wedMorning = istNow(new Date('2026-11-11T05:00:00Z'));
assert(wedMorning.time === '10:30' && wedMorning.weekday === 'Wednesday', 'UTC converts to IST');
assert(wedMorning.nseRegularSessionOpen, 'Session open at 10:30 IST on a weekday');
assert(!istNow(new Date('2026-11-14T05:00:00Z')).nseRegularSessionOpen, 'Session closed on Saturday');
assert(!istNow(new Date('2026-11-11T10:05:00Z')).nseRegularSessionOpen, 'Session closed after 15:30 IST');

// -------------------------------------------------------------------------
console.log('\n📋 Suite 5: Kalvion Client');
const notConnected: any = await kalvionGet('/api/market/indices');
assert(/not connected/.test(notConnected?.error || ''), 'Clear error when Kalvion is not configured');

const seen: Array<{ url: string; auth?: string }> = [];
const fakeKalvion = http.createServer((req, res) => {
  seen.push({ url: req.url || '', auth: req.headers.authorization });
  if (req.url?.startsWith('/api/account/positions')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end('{"detail":"Upstox token expired"}');
  }
  if (req.url?.startsWith('/api/ipo/list')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ipos: 'x'.repeat(20000) }));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify([{ name: 'NIFTY 50', ltp: 25000 }]));
});
await new Promise<void>(resolve => fakeKalvion.listen(0, '127.0.0.1', resolve));
process.env.KALVION_URL = `http://127.0.0.1:${(fakeKalvion.address() as AddressInfo).port}/`;
process.env.KALVION_API_TOKEN = 'test-token';

const indices: any = await executeTool('kalvion_market_indices', {});
assert(indices?.[0]?.ltp === 25000, 'Tool returns Kalvion JSON');
assert(seen[0]?.auth === 'Bearer test-token', 'Sends KALVION_API_TOKEN as a bearer');
await executeTool('kalvion_search_instruments', { query: 'HDFC Bank' });
assert(seen[1]?.url === '/api/instruments/search?q=HDFC+Bank&limit=10', 'Builds query parameters', seen[1]?.url);
await executeTool('kalvion_bots', { host: 'ec2/mumbai' });
assert(seen[2]?.url === '/api/remote/ec2%2Fmumbai/bots', 'Encodes the host name in the path', seen[2]?.url);
const failedCall: any = await executeTool('kalvion_positions', {});
assert(/HTTP 503/.test(failedCall?.error || '') && /expired/.test(failedCall?.detail || ''), 'HTTP errors come back with Kalvion\'s detail');
const big: any = await executeTool('kalvion_ipo_list', {});
assert(big?.truncated === true && big.data.length === 12000, 'Large replies are truncated for the model');
fakeKalvion.close();
delete process.env.KALVION_URL;
delete process.env.KALVION_API_TOKEN;

// -------------------------------------------------------------------------
console.log('\n📋 Suite 6: Agent Without a Gemini Key');
const noKey = await processWithAgent({ incomingText: 'hi', ownerName: 'Yash' });
assert(noKey.reply === NOT_CONFIGURED_REPLY, 'Says Gemini is not configured instead of guessing');

// -------------------------------------------------------------------------
console.log('\n📋 Suite 7: Owner-Only Webhook Handling');
const inbound = (from: string, body: string) => ({ from, id: `wamid.${Math.random()}`, timestamp: '1', type: 'text', text: { body } });

webhookLogger.clearLogs();
await handleInboundMessage(inbound('919811111111', 'show my positions'));
let logs = webhookLogger.getLogs(10);
assert(logs.length === 1 && logs[0].type === 'ignored', 'A stranger is ignored');
assert(!logs.some(l => l.direction === 'outbound'), 'Nothing is sent to a stranger');

webhookLogger.clearLogs();
await handleInboundMessage(inbound(OWNER, 'hello'));
logs = webhookLogger.getLogs(10);
const sent = logs.find(l => l.direction === 'outbound');
assert(sent?.payload?.to === OWNER, 'The owner gets a reply');
assert(conversationStore.recent(OWNER, 10).length === 2, 'The exchange is saved to history');

await handleInboundMessage(inbound(OWNER, '/new'));
assert(conversationStore.recent(OWNER, 10).length === 0, '/new clears the history');

webhookLogger.clearLogs();
await handleInboundMessage(inbound(OWNER, '/help'));
logs = webhookLogger.getLogs(10);
assert(/\/new/.test(logs.find(l => l.direction === 'outbound')?.payload?.text?.body || ''), '/help lists the commands');

// -------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

process.exit(failed > 0 ? 1 : 0);
