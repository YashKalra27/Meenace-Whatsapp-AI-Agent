import React, { useState, useEffect, useRef } from 'react';
import { Send, CheckCheck, Sparkles, Smartphone, Calendar, FileText, UserCheck, ShieldAlert, X } from 'lucide-react';

interface ChatMsg {
  id: string;
  from: 'customer' | 'assistant' | 'human_agent' | 'system';
  text: string;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read';
  type?: string;
  metadata?: any;
}

interface WhatsAppSimulatorProps {
  onWebhookEvent?: () => void;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowService, setFlowService] = useState('srv-strategy');
  const [flowDate, setFlowDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().split('T')[0];
  });
  const [flowSlot, setFlowSlot] = useState('11:00 AM');
  const [flowName, setFlowName] = useState('Alex Rivers');
  const [flowNotes, setFlowNotes] = useState('Looking to implement WhatsApp AI bot for sales qualification.');

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const customerPhone = '+14155550192';

  // Load existing messages on mount
  useEffect(() => {
    fetchThread();
    const interval = setInterval(fetchThread, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchThread = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const threads = await res.json();
        const current = threads.find((t: any) => t.customerPhone.includes('4155550192'));
        if (current && current.messages) {
          setMessages(current.messages);
        }
      }
    } catch {
      // offline or loading
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    setInputText('');
    setIsLoading(true);

    try {
      await fetch('/api/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customerPhone,
          name: flowName,
          text: text.trim(),
          type: 'text'
        })
      });
      await fetchThread();
    } catch (err) {
      console.error('Failed to simulate message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowFlowModal(false);
    setIsLoading(true);

    const flowData = {
      service_id: flowService,
      date: flowDate,
      time_slot: flowSlot,
      name: flowName,
      notes: flowNotes
    };

    try {
      await fetch('/api/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customerPhone,
          name: flowName,
          type: 'interactive',
          interactiveData: {
            type: 'nfm_reply',
            nfm_reply: {
              name: 'flow_appointment_booking_v1',
              body: 'Form Submitted',
              response_json: JSON.stringify(flowData)
            }
          }
        })
      });
      await fetchThread();
    } catch (err) {
      console.error('Failed to submit Flow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: 'Check Tomorrow Availability', text: 'What available appointment slots do you have for tomorrow?' },
    { label: 'View Services & Pricing', text: 'Can you show me your services, pricing, and what is included?' },
    { label: 'Book Strategy Session', text: 'I want to book an AI Automation Strategy Session for tomorrow at 11:00 AM' },
    { label: 'Open WhatsApp Flow Form', text: 'Can you send me the interactive booking form?' },
    { label: 'Talk to Human Agent', text: 'I would like to speak with a human manager please' },
    { label: 'Cancel My Appointment', text: 'Please cancel my upcoming appointment' }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 460px) 1fr', gap: '2rem', alignItems: 'start' }}>
      {/* Left: Interactive Phone Mockup */}
      <div className="phone-mockup-wrapper">
        <div className="phone-speaker-notch" />
        
        {/* WhatsApp Chat Header */}
        <div className="phone-header">
          <div className="contact-info-cluster">
            <div className="contact-avatar">🤖</div>
            <div>
              <div className="contact-name">
                Apex AI Assistant
                <span className="verified-badge" title="Official WhatsApp Cloud API Verified">✓</span>
              </div>
              <div className="contact-status">
                {isLoading ? 'Claude is typing...' : 'Online · Official Cloud API'}
              </div>
            </div>
          </div>
          <span className="badge badge-success">Meta v21.0</span>
        </div>

        {/* WhatsApp Chat Messages Area */}
        <div className="chat-wallpaper">
          <div className="bubble bubble-system">
            🔒 Messages on this line route directly through the official Meta WhatsApp Cloud API.
          </div>

          {messages.length === 0 && (
            <div className="bubble bubble-outgoing">
              Hello! I am Claude, your dedicated AI Assistant on WhatsApp. I can check our calendar, book consultations, or answer questions about our automation services. How can I help you today?
              <div className="bubble-footer">
                <span>09:00 AM</span>
                <CheckCheck size={14} className="tick-double-blue" />
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isCustomer = m.from === 'customer';
            const isSystem = m.from === 'system';
            const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (isSystem) {
              return (
                <div key={m.id} className="bubble bubble-system">
                  {m.text}
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`bubble ${isCustomer ? 'bubble-incoming' : 'bubble-outgoing'}`}
              >
                {/* Flow Message Button CTA */}
                {m.type === 'flow' && (
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ marginBottom: '10px' }}>{m.text.replace('📱 [Interactive WhatsApp Flow: Open Booking Form]', '')}</p>
                    <button
                      onClick={() => setShowFlowModal(true)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: '#00a884',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Smartphone size={16} /> Open Native Booking Form
                    </button>
                  </div>
                )}

                {/* Normal Text */}
                {m.type !== 'flow' && (
                  <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                )}

                <div className="bubble-footer">
                  <span>{timeStr}</span>
                  {!isCustomer && (
                    <CheckCheck
                      size={14}
                      className={m.status === 'read' ? 'tick-double-blue' : 'tick-double-grey'}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <form
          className="phone-footer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            type="text"
            className="chat-input-box"
            placeholder="Type a WhatsApp message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="chat-send-circle" disabled={isLoading || !inputText.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Right: Quick Controls & Simulation Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                <Sparkles size={20} color="#25d366" />
                Live WhatsApp Sandbox Tester
              </h3>
              <p className="panel-subtitle">
                Test the Claude AI loop in real time. Send customer messages, trigger calendar bookings, test WhatsApp Flow forms, and verify human escalations.
              </p>
            </div>
            <span className="badge badge-success">Simulated Device</span>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              One-Click Scenario Prompts
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q.text)}
                  disabled={isLoading}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem' }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Highlights from Guide */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#34d399', fontWeight: 600 }}>
                <Calendar size={16} /> Instant Calendar Sync
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Claude inspects working hours and booked slots to suggest open times and book confirmations.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#60a5fa', fontWeight: 600 }}>
                <Smartphone size={16} /> Native WhatsApp Flows
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Multi-field forms open directly inside WhatsApp for 1-click booking without external redirects.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#fbbf24', fontWeight: 600 }}>
                <UserCheck size={16} /> Human Escalation
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Requests for a human automatically pause bot responses and create an urgent ticket for human takeover.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#f87171', fontWeight: 600 }}>
                <ShieldAlert size={16} /> 24h Meta Window Guard
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Tracks the Meta policy window. Only pre-approved templates are allowed once customer window closes.
              </p>
            </div>
          </div>
        </div>

        {/* Live Delivery Tick Legend */}
        <div className="glass-panel" style={{ padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              <strong>Delivery Status Lifecycle:</strong>
            </span>
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCheck size={16} className="tick-double-grey" /> Delivered to Phone
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCheck size={16} className="tick-double-blue" /> Read by Customer
              </span>
              <span className="badge badge-success">Meta Cloud Webhook 200 OK</span>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Flow Native In-Chat Form Modal Simulator */}
      {showFlowModal && (
        <div className="modal-overlay" onClick={() => setShowFlowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: '#00a884', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <FileText size={16} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.1rem' }}>
                  WhatsApp Flow: Schedule Session
                </h3>
              </div>
              <button onClick={() => setShowFlowModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Native Meta Flow rendered inside WhatsApp. Submitting sends an encrypted <code>nfm_reply</code> to your server webhook.
            </p>

            <form onSubmit={handleFlowSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Select Service Tier
                </label>
                <select
                  value={flowService}
                  onChange={(e) => setFlowService(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="srv-strategy">AI Automation Strategy Session ($199)</option>
                  <option value="srv-whatsapp-bot">Custom WhatsApp AI Agent Implementation ($1,499)</option>
                  <option value="srv-workflow-audit">Process & Security Workflow Audit ($499)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    value={flowDate}
                    onChange={(e) => setFlowDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                    Time Slot
                  </label>
                  <select
                    value={flowSlot}
                    onChange={(e) => setFlowSlot(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="03:00 PM">03:00 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                  Project Objectives & Notes
                </label>
                <textarea
                  value={flowNotes}
                  onChange={(e) => setFlowNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowFlowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit In-Chat Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
