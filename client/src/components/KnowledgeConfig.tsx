import React, { useState, useEffect } from 'react';
import { Settings, Shield, Key, Bot, DollarSign, Clock, HelpCircle, Save, CheckCircle2 } from 'lucide-react';

export const KnowledgeConfig: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [clientConfig, setClientConfig] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Credentials form
  const [token, setToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [simMode, setSimMode] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
        setProfile(data.businessProfile || {});
        setClientConfig(data.clientConfig || {});
        setPhoneId(data.clientConfig?.phoneNumberId || '');
        setSimMode(Boolean(data.clientConfig?.simulationMode));
      }
    } catch {
      // ignore
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappToken: token,
          phoneNumberId: phoneId,
          simulationMode: simMode
        })
      });
      if (res.ok) {
        setSaveStatus('✅ Settings and credentials updated successfully!');
        fetchSettings();
      }
    } catch (e: any) {
      setSaveStatus(`❌ Error updating settings: ${e.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.75rem' }}>
        <h2 className="panel-title">
          <Settings size={22} color="#f59e0b" />
          Business Knowledgebase & API Settings
        </h2>
        <p className="panel-subtitle">
          Claude's context is injected from this knowledgebase. Keeping pricing, hours, and policies accurate ensures high answering quality.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Business Context & Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Services & Pricing Tiers */}
          <div className="glass-panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <DollarSign size={20} color="#25d366" />
                Active Services & Pricing Tiers
              </h3>
              <span className="badge badge-success">{services.length} Active Services</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {services.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                      {s.name}
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      ${s.priceUSD}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    ⏱ {s.durationMinutes} mins · Category: <strong>{s.category}</strong> · ID: <code>{s.id}</code>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Business Hours & Policies */}
          {profile && (
            <div className="glass-panel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <Clock size={20} color="#60a5fa" />
                  Operating Hours & Guardrail Policies
                </h3>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Standard Hours (PST):</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.82rem' }}>
                  <div style={{ color: '#cbd5e1' }}>Mon – Thu: <strong>09:00 AM – 06:00 PM</strong></div>
                  <div style={{ color: '#cbd5e1' }}>Friday: <strong>09:00 AM – 05:00 PM</strong></div>
                  <div style={{ color: '#cbd5e1' }}>Saturday: <strong>10:00 AM – 02:00 PM</strong></div>
                  <div style={{ color: '#f87171' }}>Sunday: <strong>Closed</strong></div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Agent Behavioral Policies:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
                    <strong style={{ color: '#34d399' }}>AI Identity Transparency:</strong> {profile.policies?.aiDisclosurePolicy}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
                    <strong style={{ color: '#fbbf24' }}>Human Escalation:</strong> {profile.policies?.escalationPolicy}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
                    <strong style={{ color: '#60a5fa' }}>Cancellation & Rescheduling:</strong> {profile.policies?.cancellationPolicy}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Meta & Anthropic API Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <Key size={20} color="#25d366" />
                Meta Cloud API & Claude Keys
              </h3>
            </div>

            <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Operation Mode:
                </label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="mode"
                      checked={simMode}
                      onChange={() => setSimMode(true)}
                    />
                    Sandbox Simulation (Local Testing)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="mode"
                      checked={!simMode}
                      onChange={() => setSimMode(false)}
                    />
                    Live Meta Cloud API
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Meta Phone Number ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104857204918231"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Meta System User Access Token:
                </label>
                <input
                  type="password"
                  placeholder={clientConfig?.hasToken ? '•••••••••••••••••••• (configured)' : 'EAABw... (permanent token)'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Generate a Permanent Token via Meta Business Manager &rarr; System Users with <code>whatsapp_business_messaging</code> permission.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Webhook Verify Token:
                </label>
                <input
                  type="text"
                  value={clientConfig?.verifyToken || 'claude_whatsapp_secret_verify_token_2026'}
                  readOnly
                  style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#34d399', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Paste this string into Meta App Dashboard &rarr; WhatsApp &rarr; Configuration &rarr; Webhook &rarr; Verify Token.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Anthropic Claude Model:
                </label>
                <input
                  type="text"
                  value="claude-3-5-sonnet-20241022"
                  readOnly
                  style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fbbf24', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                <Save size={16} /> Save Configuration
              </button>

              {saveStatus && (
                <div style={{ fontSize: '0.82rem', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#34d399' }}>
                  {saveStatus}
                </div>
              )}
            </form>
          </div>

          {/* Quick FAQ Reference */}
          <div className="glass-panel">
            <h3 className="panel-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
              <HelpCircle size={18} color="#94a3b8" />
              Frequently Asked Questions (Context)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profile?.faqs?.map((f: any, idx: number) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#fff' }}>Q: {f.question}</strong>
                  <div style={{ color: '#94a3b8', marginTop: '2px' }}>{f.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
