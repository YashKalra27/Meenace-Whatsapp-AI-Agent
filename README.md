# WhatsApp AI Agent

An autonomous WhatsApp assistant on the official **Meta WhatsApp Cloud API**, powered by **Google Gemini** with tool calling. The WhatsApp chat is the only interface: customers message your business number and the agent answers, checks the calendar, books appointments, and hands the chat to a human when needed.

The bundled business profile ("Apex AI Solutions") is demo data in [`src/config/businessData.ts`](src/config/businessData.ts).

## What the agent can do

| Tool | Purpose |
|---|---|
| `get_services_catalog` | Services, prices and durations |
| `check_calendar_availability` | Open slots for a date, respecting business hours |
| `book_appointment` / `reschedule_appointment` / `cancel_appointment` / `lookup_appointments` | Calendar management with conflict prevention |
| `send_booking_flow` | Sends the in-chat WhatsApp Flow booking form |
| `escalate_to_human` | Opens a ticket and pauses bot replies for that chat |

It also tracks Meta's 24-hour customer-service window (template messages only outside it) and sends morning-of appointment reminders.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in the values
npm test               # 29 unit and integration checks
npm start              # http://localhost:3000
```

Without `GEMINI_API_KEY` the agent answers with scripted fallback replies. With `SIMULATION_MODE=true` nothing is sent to WhatsApp.

## Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite` |
| `WHATSAPP_TOKEN` | System user access token |
| `WHATSAPP_PHONE_NUMBER_ID` | ID of the registered business number |
| `WHATSAPP_VERIFY_TOKEN` | Secret phrase Meta sends when verifying the webhook |
| `WHATSAPP_APP_SECRET` | Optional; enables webhook signature checks. Must match the app exactly |
| `SIMULATION_MODE` | `false` to send real WhatsApp messages |
| `ADMIN_TOKEN` | Bearer token for the `/api/*` admin endpoints; they are disabled when empty |

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/webhook` | Meta verification handshake |
| `POST` | `/webhook` | Inbound messages and delivery statuses |
| `POST` | `/flow-endpoint` | WhatsApp Flows data exchange |
| `GET` | `/` | Health check |
| `*` | `/api/*` | Admin API (logs, conversations, human takeover, appointments, reminders), requires `Authorization: Bearer $ADMIN_TOKEN` |

## Going live

See [SETUP_GUIDE.md](SETUP_GUIDE.md). In short: register the number on the Cloud API, point the app's webhook at `https://<your-host>/webhook` with your verify token, subscribe the WhatsApp account to the app, and set the environment variables above on your host.
