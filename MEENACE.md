# MEENACE.md: agent handbook

Read this before changing Meenace. It explains what Meenace is, how it is wired, what it may and may not do, and how to extend it without breaking the live deployment.

## 1. What Meenace is

Meenace is **Yash's private WhatsApp assistant for Kalvion**. Yash sends a WhatsApp message to Meenace's business number; Meenace answers with **Gemini**, calling tools that read live data from **Kalvion**.

- **One user.** Meenace talks only to the owner (`OWNER_PHONE`). Messages from any other number are logged as `ignored` and get **no reply at all**. There are no customers, no support desk, no human hand-off.
- **Kalvion** (separate repo: `github.com/YashKalra27/Kalvion`, locally `~/Desktop/Kalvion`) is Yash's self-hosted trading desk for Indian index options: a NIFTY options database and backtest engine, an Upstox account dashboard, control of the `proto1`-`proto9` trading bots on EC2, and an IPO desk. Its own docs: `README.md` and `docs/ARCHITECTURE.md` in that repo.
- **Meenace's role in the ecosystem:** the phone-side window into Kalvion. Today it is **read-only**: market data, account, positions, orders, bots' state, backtest jobs, IPOs. Capabilities are added "as and when the need arises" (section 7).

History: this repo started as a generic "Claude WhatsApp agent" demo (fictional business, bookings, WhatsApp Flows, human takeover, a React dashboard). All of that was removed on 2026-11-11. If you find old references, they are stale.

## 2. Architecture

```
Yash's WhatsApp ──► Meta WhatsApp Cloud API ──► POST /webhook (Meenace on Render)
                                                     │
                                       owner check (OWNER_PHONE) ── not owner → ignore
                                                     │
                                      /new, /help  ──┤
                                                     ▼
                                     Gemini (tool-calling loop, ≤ 5 rounds)
                                                     │
                                      tools/ ── kalvion_* ──► Kalvion backend /api/*
                                                     │         (Bearer KALVION_API_TOKEN)
                                                     ▼
                                   reply ──► Meta Graph API /messages ──► Yash
```

- **Runtime:** Node 22, TypeScript run directly with `tsx`, Express 4, ES modules (`"type": "module"`, imports end in `.js`).
- **Model:** `@google/genai` SDK, default model `gemini-3.5-flash-lite` (override with `GEMINI_MODEL`).
- **Hosting:** Render free web service `Meenace-Whatsapp-AI-Agent`, Docker, auto-deploys from `main` of `github.com/YashKalra27/Meenace-Whatsapp-AI-Agent`. URL `https://meenace-whatsapp-ai-agent.onrender.com`.
- **State:** JSON files under `DATA_DIR` (default `./data`): `conversations.json`, `windows.json`, `webhook_logs.json`. **Render's free disk is wiped on every deploy and restart**, so all state is disposable. Never store anything there that must survive.

## 3. File map

| Path | Role |
|---|---|
| `src/server.ts` | Webhook (Meta verification + inbound), owner gate, `/new` and `/help`, admin API |
| `src/agent/prompt.ts` | **Meenace's persona and rules** (the system prompt). Edit this to change behaviour |
| `src/agent/gemini.ts` | Gemini tool-calling loop, quota/error replies |
| `src/tools/types.ts` | `AgentTool` interface: `declaration` (what Gemini sees) + `run(args)` |
| `src/tools/index.ts` | Tool registry (`agentTools`) and `executeTool` |
| `src/tools/core.ts` | `get_current_time_ist` and the IST/NSE-session helper `istNow()` |
| `src/tools/kalvion.ts` | Kalvion HTTP client (`kalvionGet`) and the `kalvion_*` tools |
| `src/conversation/store.ts` | Per-phone chat history (last 50 kept, last 10 sent to Gemini) |
| `src/whatsapp/client.ts` | Meta Graph API: `sendText` (auto-splits at 4096 chars), `sendTemplate`, `markAsRead` |
| `src/whatsapp/windowManager.ts` | Tracks Meta's 24-hour customer-service window per number |
| `src/logger/webhookLogger.ts` | Request log (inbound, outbound, tools used, errors), last 500 |
| `test/runAllTests.ts` | 30 checks, including a fake Kalvion HTTP server |

## 4. Configuration (Render → Environment)

| Variable | Required | Meaning |
|---|---|---|
| `OWNER_PHONE` | **yes** | Owner's WhatsApp number, digits with country code (`91…`). Unset = Meenace ignores everyone |
| `OWNER_NAME` | no | Name used in the persona. Default `Yash` |
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `GEMINI_MODEL` | no | Default `gemini-3.5-flash-lite` |
| `WHATSAPP_TOKEN` | yes | Permanent System User token (Meta Business Settings → System Users) |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | ID of Meenace's registered number (find it with `whatsapp_biz_phone_numbers`) |
| `WHATSAPP_VERIFY_TOKEN` | yes | Secret phrase Meta echoes when verifying the webhook. Must match the app's webhook config |
| `WHATSAPP_APP_SECRET` | no | Enables `X-Hub-Signature-256` checks. **A wrong value silently drops every inbound message** |
| `SIMULATION_MODE` | no | `true` = log outbound messages instead of sending. Live is `false` |
| `ADMIN_TOKEN` | no | Bearer for `/api/*`. Unset = admin API disabled |
| `KALVION_URL` | for Kalvion | Public HTTPS base URL of Kalvion's backend, e.g. `https://kalvion.example.com` |
| `KALVION_API_TOKEN` | for Kalvion | Must equal `KALVION_API_TOKEN` in Kalvion's `.env` |
| `DATA_DIR` | no | Where JSON state lives. Default `./data` |

Never commit real values. `.env` is git-ignored; `.env.example` lists every variable.

## 5. Kalvion integration contract

**Auth.** Kalvion's FastAPI middleware (`backend/kalvion/main.py`, `auth_gate`) accepts `Authorization: Bearer <KALVION_API_TOKEN>` and treats it as **the owner**. Owner-only prefixes: `/api/account/`, `/api/upstox/`, `/api/remote/`, `/api/ipo/`. Meenace therefore sees exactly what Yash sees in Kalvion's UI.

**Reachability: the open problem.** Kalvion's backend normally runs on Yash's laptop at `127.0.0.1:8000`. Render cannot reach that. Until Kalvion has a public HTTPS address, every `kalvion_*` tool returns *"Kalvion is not connected"* and Meenace says so. Options, in order of preference:
1. **Cloudflare Tunnel** (`cloudflared`) from wherever Kalvion runs to a hostname; set `KALVION_API_TOKEN` in Kalvion (it then refuses unauthenticated calls) and put the URL + token on Render.
2. Run Kalvion on the EC2 box behind HTTPS, with `KALVION_API_TOKEN` set.
3. Move Meenace next to Kalvion (same machine) and use `http://127.0.0.1:8000`, with Meta's webhook reaching it through a tunnel.

Kalvion's own rule applies: *bind to 127.0.0.1 unless `KALVION_API_TOKEN` is set; this process holds the Upstox token and can control the trading bots.*

**Endpoints Meenace uses today** (all `GET`, all under Kalvion's `/api`):

| Tool | Endpoint |
|---|---|
| `kalvion_market_status` | `/api/market/status` |
| `kalvion_market_indices` | `/api/market/indices` |
| `kalvion_search_instruments` | `/api/instruments/search?q=&limit=` |
| `kalvion_quotes` | `/api/market/quotes?keys=` (comma-separated Upstox instrument keys) |
| `kalvion_watchlist` | `/api/watchlist` |
| `kalvion_account_summary` | `/api/account/summary` (Upstox serves funds 05:30-24:00 IST only) |
| `kalvion_holdings` / `_positions` / `_orders` | `/api/account/holdings`, `/positions`, `/orders` |
| `kalvion_bot_hosts` | `/api/remote/hosts` |
| `kalvion_bots` | `/api/remote/{host}/bots` (proxied to kalvion-agent `GET /v1/bots`) |
| `kalvion_backtest_jobs` | `/api/jobs?limit=` |
| `kalvion_ipo_list` / `_applications` / `_allotments` | `/api/ipo/list`, `/applications`, `/allotments` |

Other Kalvion endpoints worth knowing for new tools: `/api/market/candles?key&interval&days`, `/api/options/expiries`, `/api/options/contracts?expiry=`, `/api/builder/chain`, `/api/market/live-chain`, `POST /api/backtests`, `POST /api/sweeps`, `/api/jobs/{id}`, `/api/ipo/sauda`. The EC2 agent (via `/api/remote/{host}/…` → `/v1/…`): `bots/{name}`, `bots/{name}/logs`, `bots/{name}/config`, `bots/{name}/tradebook`, `audit`, and the **mutating** `bots/{name}/{start|stop|restart}`, `kill-switch`, `bots/{name}/config` (PUT), `bots/{name}/code` (PUT), `bots/{name}/rollback`, `token/refresh`, `git/pull`.

If you change a Kalvion route, update the matching tool here and this table.

## 6. Rules Meenace must keep

These are product decisions, not style. Keep them unless Yash explicitly changes them.

1. **Owner only.** Never reply to, or reveal anything to, a number other than `OWNER_PHONE`.
2. **Real data only.** Every figure in a reply comes from a tool result in that turn. No estimates, no recalled prices. (Kalvion itself has the same rule: real Upstox data only.)
3. **Read-only until a confirmation flow exists.** Meenace must not place, modify or cancel orders, start/stop bots, edit configs or upload code. See section 7 before adding any of that.
4. **WhatsApp style.** Short, `*bold*` for key figures, bullets, no tables or headings, ₹ with Indian digit grouping, IST times.
5. **Honest about being an AI** (Gemini) when asked.
6. **Fail politely.** Quota exhausted (HTTP 429) → the fixed quota message; other Gemini errors → "trouble thinking, resend"; no Gemini key → "not connected". Never fall back to invented answers.

## 7. Extending Meenace

### Add a read-only tool
1. Write an `AgentTool` in `src/tools/kalvion.ts` (or a new `src/tools/<area>.ts`): a `declaration` with a snake_case `name`, a description that says *when* to use it, and a JSON Schema in `parametersJsonSchema`; and a `run(args)` returning plain JSON. Return `{ error }` rather than throwing.
2. Register it in `src/tools/index.ts`.
3. Add a check in `test/runAllTests.ts` (the fake Kalvion server records the URL and auth header).
4. Mention it in the prompt only if the model needs a rule about it; the declaration usually suffices.

### Add a write action (bots, orders, configs): required pattern
Real money is involved (Kalvion: `DRY_RUN = False` needs `allow_live_trading` on the server *and* a typed confirmation). A WhatsApp message can be mistyped, and an LLM can misread intent. So:
1. The tool **never executes directly**. It creates a pending action (what, target, parameters) with a short random code and a 2-minute expiry, and Meenace replies with an exact summary: *"Stop proto3 on ec2-mumbai? Reply `CONFIRM 4821` within 2 minutes."*
2. `server.ts` handles `CONFIRM <code>` **outside the model**: it matches the code, checks the expiry and the owner, executes once, and reports the real result.
3. Never let live-trading switches (`DRY_RUN`, `allow_live_trading`), code upload or `kill-switch` go through without that step. Log every executed action.

### Proactive messages (alerts, daily summaries)
Meta allows free-form messages only within **24 hours of the owner's last message** (`windowManager.isFreeformAllowed`). Outside it, only an **approved template** can be sent (`whatsappClient.sendTemplate`). Templates are created and approved in WhatsApp Manager or with the WhatsApp Business Tools MCP (`whatsapp_biz_create_template`); use the `UTILITY` category for alerts. No templates exist yet. A trigger needs a scheduler or an inbound call (e.g. Kalvion `POST`ing to a new authenticated Meenace endpoint). Render free instances sleep after ~15 min idle, so in-process timers there are unreliable.

### Change the persona
Edit `src/agent/prompt.ts`. Keep the rules of section 6.

## 8. Meta / WhatsApp setup (already done)

- Business **"Yash Kalra"** (verified). App **"Meenace"** (development mode, not published). WhatsApp account "Meenace" with one registered number, subscribed to the app. Look up IDs with the WhatsApp Business Tools MCP rather than hard-coding them.
- Webhook: `https://meenace-whatsapp-ai-agent.onrender.com/webhook`, field `messages`, verify token = `WHATSAPP_VERIFY_TOKEN` on Render.
- **Not done (Yash's choice, 2026-11-11):** publishing the app and adding a payment method. Messages work today without them; if inbound events stop or replies are "sent" but never arrive, these are the first suspects.
- **WhatsApp Business Tools MCP** (`https://mcp.facebook.com/whatsapp_business_tools`, server name `whatsapp_business_tools`, user scope in Claude Code) can list numbers, check onboarding status (`whatsapp_biz_onboarding_status`), manage templates and send messages. Its rules: call `whatsapp_biz_businesses` first and let the user pick; confirm before any write. Claude Code's auto-mode classifier has blocked `whatsapp_biz_configure_webhooks` and `whatsapp_biz_publish_app` before; ask Yash to do those in the dashboard or allow them.

## 9. Gemini limits

- Free tier: small daily caps per Google project (Flash-Lite has the most headroom), and Google **may use free-tier prompts and replies to improve its products**. Kalvion data in prompts includes Yash's holdings and positions; a paid key avoids that.
- Each tool round is one request: a message that uses one tool costs two requests.
- `MAX_TOOL_ROUNDS = 5` in `gemini.ts` is a loop guard, not a rate limit.
- Gemini 3.x returns thought signatures with function calls; the loop sends the model's turn back unchanged so they are preserved. Keep it that way.

## 10. Operating and testing

```bash
npm install
npm test            # 30 checks, temp DATA_DIR, no network except a local fake Kalvion
npm run typecheck
npm start           # needs .env; SIMULATION_MODE=true logs instead of sending
```

Admin API (needs `ADMIN_TOKEN`): `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://meenace-whatsapp-ai-agent.onrender.com/api/<x>`

| Endpoint | Use |
|---|---|
| `GET /api/status` | Config health: WhatsApp live/simulated, owner set, Gemini key, Kalvion connected, tool list |
| `GET /api/logs?limit=50` | What came in, what went out, tools used, errors. First stop for any "it didn't reply" |
| `GET /api/conversations` | Stored history |
| `POST /api/agent {"text": "..."}` | Run the agent and get the reply **without** sending a WhatsApp message (costs Gemini quota) |

WhatsApp commands from the owner: `/new` (forget the conversation), `/help`.

**Debugging "no reply":** `GET /api/logs`. No inbound entry → Meta isn't delivering (webhook URL/verify token, account subscription, app unpublished). `ignored` → sender isn't `OWNER_PHONE`. Inbound with an error reply → Gemini (quota/key). Outbound 4xx → Meta token or 24-hour window.

## 11. Conventions

- Commit each tested change and push to `main` straight away; Render deploys it. Author is **YashKalra27** only. **No AI co-author trailers.** Never force-push.
- Match the existing code style: two-space indent, single quotes, sparse comments that explain *why*.
- Keep secrets out of the repo, logs and replies (the logger records message text but no tokens).
- Before committing: `npm run typecheck && npm test`.
