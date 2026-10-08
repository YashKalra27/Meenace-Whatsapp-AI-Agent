# 🤖 Claude WhatsApp AI Agent Platform

> **Autonomous AI WhatsApp Assistant powered by Claude 3.5 Sonnet, Official WhatsApp Cloud API (v21.0), WhatsApp Flows, Calendar Booking, and Human Escalation.**  
> *Based on the AI Automation Architecture Guide by [@aiwithanushka](https://twitter.com/aiwithanushka).*

---

## 🌟 Key Architecture & Capabilities

1. **Dedicated Number on Official Cloud API (No Banning Risks)**:
   - Operates on the official Meta WhatsApp Cloud API (`Graph API v21.0`).
   - Supports all 3 onboarding routes: **Hosted Numbers** (~2 min setup, no SIM/codes), **Your Own SIM** (verified once), and **WhatsApp Business App sync**.
   - Compliant with Meta policies: No browser scrapers, modded clients, or session hijackers that trigger account bans.

2. **Claude 3.5 Sonnet Agentic Tool Loop**:
   - Integrated with `@anthropic-ai/sdk` with autonomous tool calling.
   - **Calendar Availability**: `check_calendar_availability` checks business hours and open slots in real time.
   - **Appointment Booking**: `book_appointment` books consultations with conflict prevention.
   - **WhatsApp Flows**: `send_booking_flow` triggers native in-chat interactive mini-app booking forms.
   - **Human Escalation**: `escalate_to_human` detects when customer requests a person or asks out-of-scope questions, pauses bot replies, and alerts operators.
   - **AI Identity Disclosure**: Truthfully confirms AI identity when asked, never pretending to be human.
   - **Built-in Intelligent Sandbox Reasoner**: Seamlessly simulates full tool use and reasoning out of the box even before adding paid API keys!

3. **WhatsApp Flows (Native Mini-Apps Inside Chat)**:
   - Interactive in-chat booking screens (`SERVICE_SELECTION`, `DATE_TIME`, `CONFIRMATION`).
   - Full data exchange endpoint (`POST /flow-endpoint`) returning dynamic time slots.
   - Follows the core rule: *"Keep chat for conversation, the Flow for the transaction."*

4. **24-Hour Customer Care Window & Template Policy Engine**:
   - Meta Cloud API Rule: Freeform responses are allowed only within 24 hours of a customer inbound.
   - Outside the 24-hour window, the engine routes through pre-approved WhatsApp templates (`appointment_reminder_v1`, `follow_up_quote_v1`, `re_engagement_v1`).
   - Real-time window countdown badge per customer thread.

5. **Automated Reminders & Follow-Ups**:
   - Cron scheduler dispatches WhatsApp template reminders the morning of appointments (at 8:00 AM).
   - Day 3 follow-up quote chaser re-engages prospective leads automatically.

6. **Full Builder & Observability Dashboard**:
   - **WhatsApp Sandbox Device Simulator**: Mobile device frame with real-time double checkmarks (sent, delivered, read) and in-chat WhatsApp Flow modal simulation.
   - **Live Webhook & Request Inspector**: Logs every incoming webhook and outgoing call with duration (ms), payload, Claude reasoning trace, tools used, and HTTP status.
   - **Conversations & Human Takeover Desk**: Operator takeover toggle, manual response composer, ticket manager.
   - **Calendar & Appointments Manager**: Slot inspector, manual cancel/reschedule, morning reminder dispatcher test.
   - **Templates & Policy Center**: Template parameter substitution preview and live tester.
   - **Business Context & API Config**: Edit service tiers, pricing, operating hours, policies, and Meta credentials.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd /Users/yash/Desktop/claude-whatsapp-agent
npm install
cd client && npm install
```

### 2. Run Comprehensive Test Suite

Verify all 26 unit and integration test assertions:

```bash
npm test
```

### 3. Start Development Server

```bash
npm start
```

Open your browser to: **`http://localhost:3000`**

---

## 🛠 Project Structure

```
claude-whatsapp-agent/
├── package.json               # Backend & root dependencies (Express, Anthropic, WS, TSX)
├── tsconfig.json              # TypeScript NodeNext configuration
├── .env.example               # Environment variables template
├── .env                       # Local environment configuration
├── src/
│   ├── server.ts              # Express server, Webhook verification, API endpoints & WebSocket
│   ├── types/
│   │   └── index.ts           # Strong TypeScript interfaces for Meta API, Claude, Calendar, & Logs
│   ├── agent/
│   │   └── claude.ts          # Claude 3.5 Sonnet engine, tool use definitions, and fallback reasoner
│   ├── whatsapp/
│   │   ├── client.ts          # Meta Graph API v21.0 client (text, interactive, flows, templates)
│   │   └── windowManager.ts   # 24-hour customer service window tracking & policy enforcement
│   ├── flows/
│   │   └── bookingFlow.ts     # WhatsApp Flow JSON schema and dynamic data exchange handler
│   ├── calendar/
│   │   ├── engine.ts          # Calendar slots, booking conflict prevention, cancellation, reschedule
│   │   └── scheduler.ts       # Morning-of reminder cron & Day 3 quote follow-up dispatcher
│   ├── escalation/
│   │   └── manager.ts         # Human escalation state machine, tickets & takeover desk
│   ├── logger/
│   │   └── webhookLogger.ts   # Request/response logger with live WebSocket broadcast
│   └── config/
│       └── businessData.ts    # Business profile, services catalog, pricing tiers, hours & policies
├── client/                    # Modern Vite + React frontend dashboard
│   ├── index.html             # Google Fonts (Outfit, DM Sans, JetBrains Mono)
│   ├── src/
│   │   ├── index.css          # Vanilla CSS design system (dark mode, glassmorphism, WhatsApp mockup)
│   │   ├── App.tsx            # Main layout, navigation tabs, metrics banner, live status
│   │   └── components/
│   │       ├── WhatsAppSimulator.tsx  # Interactive WhatsApp phone device simulator & Flow popup
│   │       ├── WebhookInspector.tsx   # Live request/response stream, latency, and JSON inspector
│   │       ├── ConversationDesk.tsx   # Customer threads, 24h window badges, human takeover
│   │       ├── AppointmentsView.tsx   # Calendar bookings, live slot checker, reminder trigger
│   │       ├── TemplatesView.tsx      # Meta pre-approved templates catalog & parameter preview
│   │       ├── KnowledgeConfig.tsx    # Services, pricing tiers, hours, and Meta API credentials
│   │       └── GuideView.tsx          # Interactive architecture guide by @aiwithanushka
└── test/
    └── runAllTests.ts         # 26 automated unit & integration tests
```

---

## 📡 Webhook Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/webhook` | Meta Hub Verification Handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| `POST` | `/webhook` | Inbound WhatsApp messages, interactive replies, and delivery statuses (`sent`, `delivered`, `read`) |
| `POST` | `/flow-endpoint` | WhatsApp Flows dynamic data exchange (`ping`, `INIT`, `data_exchange`) |
| `GET` | `/api/status` | System health check, active threads, open escalations, WhatsApp connection status |
| `GET` | `/api/logs` | Real-time Webhook logs with duration, payload, and Claude reasoning trace |
| `GET` | `/api/conversations` | Active conversation threads with 24-hour service window countdown |
| `POST` | `/api/conversations/:phone/takeover` | Human operator takes over chat; pauses Claude automation |
| `POST` | `/api/conversations/:phone/resume` | Releases conversation back to Claude AI automation |
| `POST` | `/api/reminders/trigger` | Dispatches morning appointment reminder templates |
| `POST` | `/api/simulate-inbound` | Simulates inbound customer message into the live webhook pipeline |

---

## 🔒 Going Live on Meta Cloud API

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a **Business** App.
2. Add the **WhatsApp** product.
3. Expose your server using Cloudflare Tunnel or Ngrok:
   ```bash
   ngrok http 3000
   ```
4. Set Webhook URL to: `https://your-ngrok-domain.ngrok-free.app/webhook`
5. Set Verify Token to: `claude_whatsapp_secret_verify_token_2026`
6. Subscribe to webhook fields: `messages`.
7. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in `.env` or in the dashboard **Config & Keys** tab.
8. Switch Operation Mode to **Live Meta Cloud API**!
