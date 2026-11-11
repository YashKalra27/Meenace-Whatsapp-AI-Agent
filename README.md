# Meenace

Meenace is a private WhatsApp assistant for **[Kalvion](https://github.com/YashKalra27/Kalvion)**, a self-hosted trading desk for Indian index options. The owner messages Meenace on WhatsApp, and Meenace answers with **Google Gemini**, using tools that read live data from Kalvion: market indices and quotes, the Upstox account (funds, holdings, positions, orders), the state of the EC2 trading bots, backtest jobs and the IPO desk.

- **Owner only.** Messages from any other number are ignored.
- **Read-only.** Meenace reports; it doesn't trade or control bots.
- Runs on the official **Meta WhatsApp Cloud API**.

**Agents and contributors: read [MEENACE.md](MEENACE.md) first.** It covers the architecture, configuration, the Kalvion integration contract, the rules Meenace must keep, and how to add capabilities safely.

## Quick start

```bash
npm install
cp .env.example .env   # fill in the values (MEENACE.md §4)
npm test               # 30 checks
npm start              # http://localhost:3000
```

WhatsApp commands: `/new` starts a fresh conversation, `/help` lists commands.
