import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw, Trash2, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertTriangle, Clock, Eye, Play } from 'lucide-react';

interface WebhookLog {
  id: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  type: string;
  httpStatus: number;
  durationMs: number;
  payload: any;
  response: any;
  error?: string;
  claudeReasoning?: string;
  toolsUsed?: string[];
}

export const WebhookInspector: React.FC = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=150');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        if (!selectedLog && data.length > 0) {
          setSelectedLog(data[0]);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleClear = async () => {
    await fetch('/api/logs', { method: 'DELETE' });
    setLogs([]);
    setSelectedLog(null);
  };

  const handleTestVerification = async () => {
    try {
      const challengeStr = 'challenge_test_' + Math.floor(Math.random() * 100000);
      const res = await fetch(`/webhook?hub.mode=subscribe&hub.verify_token=claude_whatsapp_secret_verify_token_2026&hub.challenge=${challengeStr}`);
      const text = await res.text();
      alert(`Webhook Verification Handshake Test:\nHTTP Status: ${res.status}\nChallenge returned: ${text}\nResult: ${text === challengeStr ? 'SUCCESS (200 OK verified)' : 'FAILED'}`);
      fetchLogs();
    } catch (e: any) {
      alert(`Verification error: ${e.message}`);
    }
  };

  const filteredLogs = logs.filter(l => {
    if (filterType !== 'ALL' && l.type.toLowerCase() !== filterType.toLowerCase() && l.direction.toLowerCase() !== filterType.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const payloadStr = JSON.stringify(l.payload).toLowerCase();
      const typeStr = l.type.toLowerCase();
      return payloadStr.includes(q) || typeStr.includes(q) || (l.error && l.error.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Action Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search logs by phone, payload or tool..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 34px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {['ALL', 'inbound', 'outbound', 'message', 'status', 'flow'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`btn-secondary ${filterType === f ? 'active' : ''}`}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    background: filterType === f ? 'rgba(37,211,102,0.2)' : undefined,
                    borderColor: filterType === f ? 'rgba(37,211,102,0.4)' : undefined,
                    color: filterType === f ? '#34d399' : undefined
                  }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleTestVerification} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
              <Play size={14} color="#34d399" /> Test Webhook GET Handshake
            </button>
            <button onClick={() => setAutoRefresh(!autoRefresh)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
              <RefreshCw size={14} className={autoRefresh ? 'spin-anim' : ''} />
              {autoRefresh ? 'Live Stream: On' : 'Paused'}
            </button>
            <button onClick={handleClear} className="btn-danger">
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Main Split View: Stream on Left, JSON Inspector on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 1.2fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Stream List */}
        <div className="glass-panel" style={{ padding: '0.5rem', maxHeight: '720px', overflowY: 'auto' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>
              Activity Stream ({filteredLogs.length} events)
            </span>
            <span className="badge badge-success">Meta Webhook Active</span>
          </div>

          {filteredLogs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              <Activity size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              No webhook events captured yet. Send a message from the Simulator to trigger a webhook!
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = selectedLog?.id === log.id;
              const isInbound = log.direction === 'inbound';
              const timeStr = new Date(log.timestamp).toLocaleTimeString();

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isSelected ? 'rgba(37,211,102,0.08)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #25d366' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isInbound ? (
                        <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <ArrowDownLeft size={12} /> INBOUND
                        </span>
                      ) : (
                        <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <ArrowUpRight size={12} /> OUTBOUND
                        </span>
                      )}
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                        {log.type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} /> {log.durationMs}ms
                      </span>
                      <span className={log.httpStatus === 200 ? 'badge badge-success' : 'badge badge-danger'}>
                        {log.httpStatus}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.type === 'message' && log.payload?.text?.body
                      ? `"${log.payload.text.body}"`
                      : log.type === 'status'
                      ? `Status: ${log.payload?.status} (${log.payload?.recipient_id || 'user'})`
                      : log.type === 'flow'
                      ? `Flow action: ${log.payload?.action || 'exchange'}`
                      : JSON.stringify(log.payload).slice(0, 75)}
                  </div>

                  {log.toolsUsed && log.toolsUsed.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {log.toolsUsed.map((t, idx) => (
                        <span key={idx} className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                          🛠 {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                    {timeStr}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Log Detail Inspector */}
        <div className="glass-panel" style={{ maxHeight: '720px', overflowY: 'auto' }}>
          {selectedLog ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)', color: '#fff' }}>
                    Request Details
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    ID: {selectedLog.id} · Timestamp: {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className={selectedLog.httpStatus === 200 ? 'badge badge-success' : 'badge badge-danger'}>
                    HTTP {selectedLog.httpStatus}
                  </span>
                  <span className="badge badge-info">
                    {selectedLog.durationMs}ms
                  </span>
                </div>
              </div>

              {/* Claude Reasoning Trace if available */}
              {selectedLog.claudeReasoning && (
                <div style={{ marginBottom: '1.25rem', background: 'rgba(245,158,11,0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    💡 Claude Reasoning & Tool Execution
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {selectedLog.claudeReasoning}
                  </p>
                  {selectedLog.toolsUsed && selectedLog.toolsUsed.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {selectedLog.toolsUsed.map((t, idx) => (
                        <span key={idx} className="badge badge-warning">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payload Viewer */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                  HTTP PAYLOAD / REQUEST BODY:
                </div>
                <pre className="code-box">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>

              {/* Response Viewer */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                  SERVER RESPONSE / DISPATCH:
                </div>
                <pre className="code-box" style={{ color: '#a5d6ff' }}>
                  {JSON.stringify(selectedLog.response, null, 2)}
                </pre>
              </div>

              {selectedLog.error && (
                <div style={{ marginTop: '1rem', background: 'var(--color-danger-bg)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.8rem' }}>
                  <strong>Error Trace:</strong> {selectedLog.error}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Eye size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              Select an event from the left list to inspect its timing, payload and Claude reasoning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
