import React, { useState, useEffect } from 'react';
import { Calendar, BellRing, Clock, CheckCircle2, XCircle, Search, User, Phone } from 'lucide-react';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  date: string;
  timeSlot: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';
  createdAt: number;
  notes?: string;
  reminderSent: boolean;
  reminderSentAt?: number;
}

export const AppointmentsView: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availability, setAvailability] = useState<{ slots: string[]; isClosed: boolean; reason?: string } | null>(null);
  const [reminderResult, setReminderResult] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAppointments();
    checkSlots(checkDate);
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) {
        setAppointments(await res.json());
      }
    } catch {
      // ignore
    }
  };

  const checkSlots = async (date: string) => {
    try {
      const res = await fetch(`/api/calendar/availability?date=${date}`);
      if (res.ok) {
        setAvailability(await res.json());
      }
    } catch {
      // ignore
    }
  };

  const handleTriggerReminders = async () => {
    setIsTriggering(true);
    setReminderResult(null);
    try {
      const res = await fetch('/api/reminders/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setReminderResult(`✅ Dispatched morning reminder template to ${data.sentCount} appointment(s) scheduled for today.`);
        fetchAppointments();
      } else {
        setReminderResult('⚠️ No pending reminders for today.');
      }
    } catch (e: any) {
      setReminderResult(`❌ Error triggering reminders: ${e.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(`Cancel appointment ${id}?`)) return;
    try {
      await fetch(`/api/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin dashboard cancellation' })
      });
      fetchAppointments();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredAppointments = appointments.filter(a => {
    const q = search.toLowerCase();
    return (
      a.customerName.toLowerCase().includes(q) ||
      a.customerPhone.includes(q) ||
      a.serviceName.toLowerCase().includes(q) ||
      a.date.includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Action Header Card */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="panel-title">
              <Calendar size={22} color="#25d366" />
              Calendar & Appointment Bookings
            </h2>
            <p className="panel-subtitle">
              Manage live reservations booked by Claude AI or WhatsApp Flows. Trigger automated morning-of reminders and check working slot availability.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleTriggerReminders}
              className="btn-warning"
              disabled={isTriggering}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <BellRing size={16} />
              {isTriggering ? 'Dispatching...' : 'Dispatch Morning Reminders (Cron Test)'}
            </button>
          </div>
        </div>

        {reminderResult && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '8px', color: '#34d399', fontSize: '0.85rem' }}>
            {reminderResult}
          </div>
        )}
      </div>

      {/* Grid: Availability Checker & Appointments List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Availability Checker Widget */}
        <div className="glass-panel">
          <h3 style={{ fontSize: '1rem', color: '#fff', fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>
            Live Slot Inspector
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Test what available time slots Claude and WhatsApp Flows see on any date:
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
              Date to Check:
            </label>
            <input
              type="date"
              value={checkDate}
              onChange={(e) => {
                setCheckDate(e.target.value);
                checkSlots(e.target.value);
              }}
              style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
            />
          </div>

          {availability && (
            <div>
              {availability.isClosed ? (
                <div style={{ background: 'rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: '6px', color: '#f87171', fontSize: '0.8rem' }}>
                  {availability.reason || 'Business Closed on this date.'}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600, marginBottom: '6px' }}>
                    Available Slots ({availability.slots.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {availability.slots.map((s) => (
                      <span key={s} className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Appointments Table */}
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search appointments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 10px 6px 30px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Total: {filteredAppointments.length} Bookings
            </span>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service Tier</th>
                  <th>Date & Slot</th>
                  <th>Status</th>
                  <th>Morning Reminder</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No appointments found.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#60a5fa' }}>
                        {a.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{a.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{a.customerPhone}</div>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {a.serviceName}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{a.date}</div>
                        <div style={{ fontSize: '0.75rem', color: '#34d399' }}>{a.timeSlot}</div>
                      </td>
                      <td>
                        {a.status === 'confirmed' ? (
                          <span className="badge badge-success">Confirmed</span>
                        ) : a.status === 'rescheduled' ? (
                          <span className="badge badge-warning">Rescheduled</span>
                        ) : (
                          <span className="badge badge-danger">Cancelled</span>
                        )}
                      </td>
                      <td>
                        {a.reminderSent ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} /> Sent
                          </span>
                        ) : (
                          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={12} /> Pending (8:00 AM)
                          </span>
                        )}
                      </td>
                      <td>
                        {a.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancel(a.id)}
                            className="btn-danger"
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
