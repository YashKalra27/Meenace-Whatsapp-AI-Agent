import React from 'react';
import { BookOpen, CheckCircle, ShieldAlert, Cpu, Smartphone, Send, HelpCircle, Layers, Check, ExternalLink } from 'lucide-react';

export const GuideView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', textAlign: 'center', background: 'linear-gradient(180deg, rgba(37,211,102,0.1) 0%, rgba(18,22,31,0.9) 100%)', borderColor: 'rgba(37,211,102,0.3)' }}>
        <span className="badge badge-warning" style={{ marginBottom: '1rem', padding: '4px 12px', fontSize: '0.8rem' }}>
          AI AUTOMATION ARCHITECTURE GUIDE
        </span>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Give Claude a <span style={{ color: '#25d366' }}>WhatsApp Number</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#cbd5e1', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6 }}>
          Its own line, on the official WhatsApp Cloud API. Send, receive, book appointments, and follow up, without touching your phone.
        </p>
        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          Based on the guide by <strong>@aiwithanushka</strong> · Fully implemented in this platform
        </div>
      </div>

      {/* START HERE */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <span className="badge badge-warning">START HERE</span>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            The Missing Piece
          </h2>
        </div>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
          Claude connectors let it read and reply inside your existing accounts. What they do not give it is a <strong>line of its own</strong>. Until your agent has its own number, it cannot greet a customer at midnight, chase a quote on day three, or confirm a booking while you sleep.
        </p>
        <div style={{ background: 'rgba(37,211,102,0.08)', borderLeft: '4px solid #25d366', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong style={{ color: '#34d399' }}>A number changes the category:</strong>
          <span style={{ color: '#f8fafc', marginLeft: '6px' }}>
            It stops being an assistant you talk to, and becomes something that talks to other people on your behalf.
          </span>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid #ef4444', padding: '1rem', borderRadius: '4px' }}>
          <strong style={{ color: '#f87171' }}>Build on the official Cloud API:</strong>
          <span style={{ color: '#f8fafc', marginLeft: '6px' }}>
            Route everything through Meta directly or an official Business Partner. Tools that log in as you or drive a modified client get numbers banned permanently. Once a business number is gone, it is gone.
          </span>
        </div>
      </div>

      {/* STEP 1: Pick a Number */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <span className="badge badge-info">STEP 1</span>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            Pick a Number
          </h2>
        </div>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>
          Three routes. Start hosted while you are testing, and move to your own number when it matters.
        </p>

        <div className="data-table-container" style={{ marginBottom: '1.25rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Option</th>
                <th>What you get</th>
                <th>Setup Time</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Hosted Number</strong></td>
                <td>A fresh dedicated number issued to you</td>
                <td>~2 min, no SIM or codes</td>
                <td><span className="badge badge-success">Testing & New Agents</span></td>
              </tr>
              <tr>
                <td><strong>Your Own SIM</strong></td>
                <td>Any number, any country</td>
                <td>One-time SMS/voice verification</td>
                <td><span className="badge badge-info">A number clients already know</span></td>
              </tr>
              <tr>
                <td><strong>Business App</strong></td>
                <td>Keep the app, messages sync</td>
                <td>No migration required</td>
                <td><span className="badge badge-purple">Teams already using the app</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul style={{ paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.8 }}>
          <li><strong>Testing?</strong> Take the hosted number. You can be sending in minutes and throw it away later.</li>
          <li><strong>Real business?</strong> Use the number your customers already have. Trust matters more than speed.</li>
          <li><strong>Never use your personal number</strong> for an automated agent. Separate the line from your life.</li>
        </ul>
      </div>

      {/* STEP 2 & 3: Claude Integration & Webhook Loop */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <span className="badge badge-success">STEPS 2 & 3</span>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            The Webhook & Agentic Loop
          </h2>
        </div>

        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '1rem' }}>
          Inbound messages arrive as an HTTP POST to your server. That handler is where Claude gets involved with tools and context:
        </p>

        <pre className="code-box" style={{ marginBottom: '1.25rem', color: '#38bdf8' }}>
{`// 1. Inbound WhatsApp message arrives at your webhook
app.post('/webhook', async (req, res) => {
  const msg = req.body.message;
  
  // 2. Ask Claude what to say, with your business context & tools
  const reply = await claude(msg.text, businessContext);
  
  // 3. Send it back on your dedicated WhatsApp number
  await client.messages.sendText({
    to: msg.from,
    body: reply
  });
  
  res.sendStatus(200);
});`}
        </pre>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <strong style={{ color: '#fff' }}>That is the entire loop:</strong>
          <span style={{ color: '#cbd5e1', marginLeft: '6px' }}>
            message in, Claude reasons, message out. Everything else you build (calendars, CRM, catalogs) is just tools you give Claude inside step two!
          </span>
        </div>
      </div>

      {/* BONUS: WhatsApp Flows */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <span className="badge badge-purple">BONUS</span>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            WhatsApp Flows (Mini-Apps Inside the Chat)
          </h2>
        </div>

        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
          WhatsApp Flows let you render an actual form in the conversation: bookings, catalogs, lead capture. No app to install, no link to an external website.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ color: '#34d399', fontSize: '0.9rem', marginBottom: '4px' }}>Rule 1: More than two fields</h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Use a Flow when there are more than two fields. Chat is bad at collecting five answers in a row.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ color: '#60a5fa', fontSize: '0.9rem', marginBottom: '4px' }}>Rule 2: Split Duties</h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Keep chat for the natural conversation, the Flow for the structured transaction.
            </p>
          </div>
        </div>
      </div>

      {/* READ THIS TWICE: The Rules That Keep You Live */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <span className="badge badge-danger">READ THIS TWICE</span>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            The Rules That Keep You Live
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <CheckCircle color="#10b981" size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div><strong>Get Opt-In:</strong> You may only message people who agreed to hear from you.</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <CheckCircle color="#10b981" size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div><strong>The 24-Hour Window:</strong> Within 24 hours of a customer's message you can reply freely. Outside it, only pre-approved template messages.</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <CheckCircle color="#10b981" size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div><strong>Templates Need Approval:</strong> Write your reminders and follow-ups early and submit them before you need them.</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <CheckCircle color="#10b981" size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div><strong>Always Offer a Human:</strong> Every agent needs a clean escalation path, and people should be able to reach one easily.</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
            <CheckCircle color="#10b981" size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div><strong>Say It Is an Assistant:</strong> Not a disclaimer on every message, but never pretend to be a person when asked.</div>
          </div>
        </div>
      </div>

      {/* Launch Checklist */}
      <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.06), rgba(18,22,31,0.95))' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#25d366', fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>
          🚀 Launch Checklist
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
            <Check size={16} color="#25d366" /> You can send and receive on the number, tested from phone.
          </div>
          <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
            <Check size={16} color="#25d366" /> The agent has real pricing, services, policies, and FAQs.
          </div>
          <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
            <Check size={16} color="#25d366" /> Human escalation works and is easy to trigger.
          </div>
          <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
            <Check size={16} color="#25d366" /> Reminder and follow-up templates are submitted.
          </div>
          <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
            <Check size={16} color="#25d366" /> Webhook logs are visible, so you will notice failures.
          </div>
          <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1' }}>
            <Check size={16} color="#25d366" /> Nothing asks for WhatsApp password or uses modded client.
          </div>
        </div>
      </div>
    </div>
  );
};
