# 📋 Complete Setup & Deployment Guide
## "Give Claude a WhatsApp Number" — Step-by-Step

---

### Step 1: Pick a Dedicated Number
As detailed in the guide by [@aiwithanushka](https://twitter.com/aiwithanushka), there are three routes to provision a number:

| Option | Setup Time | Verification | Ideal Use Case |
|---|---|---|---|
| **Hosted Number** | ~2 minutes | None (issued directly) | Testing, staging, prototype bots |
| **Your Own SIM** | ~5 minutes | One-time SMS / voice call | Real business number clients recognize |
| **WhatsApp Business App** | Immediate | In-app QR sync | Teams already using the Business mobile app |

> ⚠️ **Critical Rule**: Never use your personal phone number for automated bots. Separate the line from your life! Build only on the official Meta WhatsApp Cloud API — modded clients or scrapers get phone numbers banned permanently.

---

### Step 2: Configure Meta WhatsApp Cloud API

1. Visit [Meta for Developers](https://developers.facebook.com/) and register or log in.
2. Click **Create App** &rarr; Select **Other** &rarr; Select **Business** &rarr; Name your app (e.g. `Claude WhatsApp Agent`).
3. Under **Add products to your app**, locate **WhatsApp** and click **Set up**.
4. In the left navigation, go to **WhatsApp &rarr; API Setup**:
   - Note your **Phone number ID**.
   - Note your **WhatsApp Business Account ID (WABA)**.
   - For temporary testing, copy the **Temporary access token** (valid 24h).
5. For permanent production access:
   - Navigate to [Meta Business Manager](https://business.facebook.com/) &rarr; **Business Settings**.
   - Go to **System Users** &rarr; Click **Add**.
   - Assign the **Employee** role &rarr; Generate Token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.
   - Copy this permanent token into your `.env` as `WHATSAPP_TOKEN`.

---

### Step 3: Connect the Webhook

Meta delivers all inbound customer messages and delivery receipts via webhook HTTP POST requests.

1. Expose port 3000 to the public internet using Ngrok or Cloudflare Tunnel:
   ```bash
   ngrok http 3000
   ```
2. Copy your public HTTPS URL (e.g. `https://xyz123.ngrok-free.app`).
3. In Meta App Dashboard, navigate to **WhatsApp &rarr; Configuration &rarr; Webhook**:
   - Click **Edit**.
   - **Callback URL**: `https://xyz123.ngrok-free.app/webhook`
   - **Verify Token**: `claude_whatsapp_secret_verify_token_2026` (or the token specified in `.env`)
   - Click **Verify and Save**.
4. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages` (delivers incoming texts, button clicks, flow completions, and delivery statuses).

---

### Step 4: Add Claude API Key

1. Go to [Anthropic Console](https://console.anthropic.com/) and generate an API key.
2. In your `.env` file (or via the **Config & Keys** tab in the dashboard), set:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   CLAUDE_MODEL=claude-3-5-sonnet-20241022
   SIMULATION_MODE=false
   ```
3. When `SIMULATION_MODE=false`, the server automatically calls Claude 3.5 Sonnet directly with the agentic tool calling loop for real conversations!

---

### Step 5: WhatsApp Flows (Mini-Apps in Chat)

WhatsApp Flows render native form screens directly inside WhatsApp:

1. In Meta App Dashboard, go to **WhatsApp &rarr; Flows**.
2. Click **Create Flow** &rarr; Select **Appointment Booking** template or import `flow_appointment_booking_v1`.
3. Set your Flow Endpoint to: `https://xyz123.ngrok-free.app/flow-endpoint`.
4. The server handles `ping`, `INIT`, and `data_exchange` dynamically, querying `calendarEngine` for real-time open slots!

---

### Step 6: Pre-Approve WhatsApp Templates

Outside the 24-hour customer service window, only pre-approved WhatsApp templates can be sent.

1. In Meta Business Manager, go to **WhatsApp Manager &rarr; Message Templates**.
2. Click **Create Template**:
   - **Template 1: Appointment Reminder**
     - Category: `UTILITY`
     - Name: `appointment_reminder_v1`
     - Language: `English (US)`
     - Body: `Good morning {{1}}! Reminder: Your session for "{{2}}" is scheduled for {{3}} at {{4}}. If you need to reschedule or have questions, reply here!`
     - Buttons: Quick Replies `Confirm` and `Reschedule`.
   - **Template 2: Follow-Up Quote**
     - Category: `UTILITY`
     - Name: `follow_up_quote_v1`
     - Body: `Hi {{1}}! Just following up on our chat from a few days ago regarding your AI automation inquiry. Did you have any further questions or would you like to review available appointment times?`
3. Templates in the `UTILITY` category are typically approved by Meta within minutes.

---

### Step 7: Launch & Debugging Checklist

Before opening your number to real customers:
- [x] Tested inbound text and verified Claude replies in < 2 seconds.
- [x] Verified calendar availability check and booking conflict prevention.
- [x] Verified human escalation pauses bot replies and logs urgent ticket.
- [x] Verified morning-of reminder cron scheduler triggers at 8:00 AM.
- [x] Verified Webhook Inspector logs incoming payload with HTTP 200 OK.
- [x] Verified 24-hour service window tracker enforces template requirements when expired.
