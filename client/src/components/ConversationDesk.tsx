import React, { useState, useEffect } from 'react';
import { UserCheck, Bot, Send, ShieldAlert, Clock, AlertCircle, CheckCircle2, MessageSquare, Phone } from 'lucide-react';

interface Thread {
  customerPhone: string;
  customerName: string;
  mode: 'bot' | 'human_takeover';
  escalated: boolean;
  escalationId?: string;
  lastActivity: number;
  messages: any[];
  unreadByHuman: number;
  windowStatus?: {
    isOpen: boolean;
    remainingMinutes: number;
  };
}

interface Ticket {
  id: string;
  customerPhone: string;
  customerName: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  summary: string;
  status: 'open' | 'claimed' | 'resolved';
  createdAt: number;
}

export const ConversationDesk: React.FC = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [threadsRes, ticketsRes] = await Promise.all([
        fetch('/api/conversations'),
        fetch('/api/escalations')
      ]);

      if (threadsRes.ok) {
        const data = await threadsRes.json();
        setThreads(data);
        if (!selectedThread && data.length > 0) {
          setSelectedThread(data[0]);
        } else if (selectedThread) {
          const updated = data.find((t: Thread) => t.customerPhone === selectedThread.customerPhone);
          if (updated) setSelectedThread(updated);
        }
      }

      if (ticketsRes.ok) {
        setTickets(await ticketsRes.json());
      }
    } catch {
      // ignore
    }
  };

  const handleTakeover = async (phone: string) => {
    try {
      await fetch(`/api/conversations/${encodeURIComponent(phone)}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Founding Lead' })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeBot = async (phone: string) => {
    try {
      await fetch(`/api/conversations/${encodeURIComponent(phone)}/resume`, {
        method: 'POST'
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      await fetch(`/api/conversations/${encodeURIComponent(selectedThread.customerPhone)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: replyText.trim(),
          operatorName: 'Support Operator'
        })
      });
      setReplyText('');
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const openTickets = tickets.filter(t => t.status === 'open');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Escalation Alerts Bar if any */}
      {openTickets.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle color="#ef4444" size={24} />
            <div>
              <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.95rem' }}>
                {openTickets.length} Escalated Conversation{openTickets.length > 1 ? 's' : ''} Awaiting Human Attention
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                Customer requested a human or asked a non-standard question. Bot automated replies have been paused.
              </div>
            </div>
          </div>
          <span className="badge badge-danger">Immediate Action Required</span>
        </div>
      )}

      {/* Main Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left Column: Conversations List */}
        <div className="glass-panel" style={{ padding: '0.75rem', maxHeight: '720px', overflowY: 'auto' }}>
          <div style={{ padding: '0.5rem 0.75rem 0.75rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>
              Conversations ({threads.length})
            </span>
            <span className="badge badge-info">24h Policy Enabled</span>
          </div>

          {threads.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No active conversations yet.
            </div>
          ) : (
            threads.map((th) => {
              const isSelected = selectedThread?.customerPhone === th.customerPhone;
              const isEscalated = th.escalated;
              const isHumanMode = th.mode === 'human_takeover';
              const lastMsg = th.messages[th.messages.length - 1];

              return (
                <div
                  key={th.customerPhone}
                  onClick={() => setSelectedThread(th)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isSelected ? 'rgba(37,211,102,0.08)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #25d366' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
                      {th.customerName}
                    </div>
                    {isEscalated ? (
                      <span className="badge badge-danger">ESCALATED</span>
                    ) : isHumanMode ? (
                      <span className="badge badge-warning">OPERATOR</span>
                    ) : (
                      <span className="badge badge-success">CLAUDE BOT</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                    <Phone size={12} /> {th.customerPhone}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastMsg ? `${lastMsg.from === 'customer' ? 'Customer: ' : 'Bot: '} ${lastMsg.text}` : 'No messages'}
                  </div>

                  {/* 24-hour window countdown badge */}
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {th.windowStatus?.isOpen ? (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        <Clock size={10} /> 24h Window: {Math.floor(th.windowStatus.remainingMinutes / 60)}h {th.windowStatus.remainingMinutes % 60}m open
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        <ShieldAlert size={10} /> 24h Window Expired (Templates Only)
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Chat Thread & Human Operator Desk */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '720px' }}>
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.15rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                      {selectedThread.customerName}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      ({selectedThread.customerPhone})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    {selectedThread.mode === 'human_takeover' ? (
                      <span className="badge badge-warning">
                        <UserCheck size={12} /> Human Takeover Active (Bot Paused)
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <Bot size={12} /> Claude AI Active (24/7 Autopilot)
                      </span>
                    )}

                    {selectedThread.windowStatus?.isOpen ? (
                      <span className="badge badge-info">
                        Freeform Text Allowed
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        Requires Template Message
                      </span>
                    )}
                  </div>
                </div>

                {/* Takeover / Resume Button */}
                <div>
                  {selectedThread.mode === 'human_takeover' ? (
                    <button
                      onClick={() => handleResumeBot(selectedThread.customerPhone)}
                      className="btn-primary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <Bot size={16} /> Resume Claude AI
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTakeover(selectedThread.customerPhone)}
                      className="btn-warning"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <UserCheck size={16} /> Take Over As Human
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Messages Log */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedThread.messages.map((m: any) => {
                  const isCustomer = m.from === 'customer';
                  const isHuman = m.from === 'human_agent';
                  const isSystem = m.from === 'system';

                  if (isSystem) {
                    return (
                      <div key={m.id} style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {m.text}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                        maxWidth: '75%',
                        background: isCustomer ? '#1e293b' : isHuman ? '#b45309' : '#065f46',
                        color: '#f8fafc',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.86rem'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span>{isCustomer ? 'Customer' : isHuman ? '👤 Human Operator' : '🤖 Claude Assistant'}</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                    </div>
                  );
                })}
              </div>

              {/* Operator Reply Composer */}
              <form onSubmit={handleSendReply} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder={
                    selectedThread.mode === 'human_takeover'
                      ? "Reply directly as human operator over WhatsApp..."
                      : "Take over conversation or type here to send manual override..."
                  }
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none'
                  }}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSending || !replyText.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={16} /> Send via WhatsApp
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
              Select a conversation from the left to view messages and manage human takeover.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
