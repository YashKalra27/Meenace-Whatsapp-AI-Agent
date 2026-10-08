import React, { useState } from 'react';
import { FileCode, Send, ShieldCheck, AlertCircle, CheckCircle2, Info, ExternalLink } from 'lucide-react';

interface TemplateItem {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  status: string;
  header?: string;
  bodyText: string;
  buttons: string[];
}

export const TemplatesView: React.FC = () => {
  const [recipientPhone, setRecipientPhone] = useState('+14155550192');
  const [customerName, setCustomerName] = useState('Alex Rivers');
  const [serviceName, setServiceName] = useState('AI Automation Strategy Session');
  const [selectedTemplate, setSelectedTemplate] = useState('appointment_reminder_v1');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const templates: TemplateItem[] = [
    {
      name: 'appointment_reminder_v1',
      category: 'UTILITY',
      language: 'en_US',
      status: 'APPROVED',
      header: 'Appointment Reminder 📅',
      bodyText: 'Good morning {{1}}! Reminder: Your session for "{{2}}" is scheduled for {{3}} at {{4}}. If you need to reschedule or have questions, reply here.',
      buttons: ['Confirm', 'Reschedule']
    },
    {
      name: 'follow_up_quote_v1',
      category: 'UTILITY',
      language: 'en_US',
      status: 'APPROVED',
      header: 'Following Up 💬',
      bodyText: 'Hi {{1}}! Just following up on our chat from a few days ago regarding your AI automation inquiry. Did you have any questions or would you like to review available appointment times?',
      buttons: ['View Options', 'Schedule Call']
    },
    {
      name: 're_engagement_v1',
      category: 'MARKETING',
      language: 'en_US',
      status: 'APPROVED',
      header: 'New AI Agent Features 🚀',
      bodyText: 'Hello {{1}}, we have introduced WhatsApp Flow forms and 24/7 calendar booking on our official line. Reply to explore how we can help your team automate operations.',
      buttons: ['Learn More', 'Opt Out']
    }
  ];

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setStatusMsg(null);

    try {
      if (selectedTemplate === 'follow_up_quote_v1') {
        const res = await fetch('/api/reminders/follow-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerPhone: recipientPhone,
            customerName
          })
        });
        const data = await res.json();
        if (data.success) {
          setStatusMsg(`✅ Sent "${selectedTemplate}" template to ${recipientPhone} via official WhatsApp Cloud API.`);
        }
      } else {
        // Send reminder
        const res = await fetch('/api/reminders/trigger', { method: 'POST' });
        await res.json();
        setStatusMsg(`✅ Dispatched template "${selectedTemplate}" to ${recipientPhone} successfully.`);
      }
    } catch (e: any) {
      setStatusMsg(`❌ Error sending template: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const currentTpl = templates.find(t => t.name === selectedTemplate) || templates[0];

  const renderPreviewText = () => {
    let text = currentTpl.bodyText;
    text = text.replace('{{1}}', customerName);
    text = text.replace('{{2}}', serviceName);
    text = text.replace('{{3}}', 'Today');
    text = text.replace('{{4}}', '11:00 AM');
    return text;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 24-Hour Policy Explanation Banner */}
      <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(18,140,126,0.15), rgba(7,94,84,0.15))', borderColor: 'rgba(37,211,102,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(37,211,102,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25d366', flexShrink: 0 }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '4px' }}>
              Meta WhatsApp 24-Hour Customer Care Window & Template Policy
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              When a customer messages your WhatsApp number, Meta opens a <strong>24-hour freeform service window</strong>. Inside this window, Claude can send freeform replies freely. <strong>Outside the 24-hour window</strong>, Meta strictly prohibits freeform messages — only <strong>Pre-Approved Templates</strong> (such as morning reminders or quote follow-ups) can initiate contact.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Templates Catalog & Tester */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Templates Gallery */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                <FileCode size={20} color="#25d366" />
                Pre-Approved Meta WhatsApp Templates
              </h3>
              <p className="panel-subtitle">
                Approved by Meta Business Manager. Ready for morning-of reminders and follow-up triggers.
              </p>
            </div>
            <span className="badge badge-success">3 Approved</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {templates.map((tpl) => (
              <div
                key={tpl.name}
                onClick={() => setSelectedTemplate(tpl.name)}
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  background: selectedTemplate === tpl.name ? 'rgba(37,211,102,0.08)' : 'rgba(255,255,255,0.02)',
                  border: selectedTemplate === tpl.name ? '1px solid #25d366' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
                      {tpl.name}
                    </span>
                    <span className={tpl.category === 'UTILITY' ? 'badge badge-info' : 'badge badge-warning'}>
                      {tpl.category}
                    </span>
                  </div>
                  <span className="badge badge-success">
                    <CheckCircle2 size={12} /> {tpl.status}
                  </span>
                </div>

                {tpl.header && (
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                    {tpl.header}
                  </div>
                )}

                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '8px' }}>
                  {tpl.bodyText}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {tpl.buttons.map((btn, idx) => (
                    <span key={idx} className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                      🔘 {btn}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Template Dispatch Tester */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                <Send size={20} color="#60a5fa" />
                Template Dispatch Tester
              </h3>
              <p className="panel-subtitle">
                Simulate outbound template delivery outside the 24h window.
              </p>
            </div>
          </div>

          <form onSubmit={handleSendTest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                Selected Template:
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
              >
                {templates.map(t => (
                  <option key={t.name} value={t.name}>{t.name} ({t.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                Recipient Phone:
              </label>
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Customer Name:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Service Name:
                </label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Substituted WhatsApp Preview */}
            <div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                CUSTOMER PREVIEW ON WHATSAPP:
              </div>
              <div style={{ background: '#005c4b', padding: '1rem', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', lineHeight: 1.4 }}>
                {currentTpl.header && (
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{currentTpl.header}</div>
                )}
                <div>{renderPreviewText()}</div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                  {currentTpl.buttons.map((b, i) => (
                    <span key={i} style={{ background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSending}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Send size={16} />
              {isSending ? 'Sending Template...' : 'Dispatch Template Message'}
            </button>

            {statusMsg && (
              <div style={{ fontSize: '0.82rem', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#34d399' }}>
                {statusMsg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
