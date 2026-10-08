import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Activity, 
  Users, 
  Calendar, 
  FileCode, 
  Settings, 
  BookOpen, 
  Bot, 
  ShieldCheck, 
  Radio, 
  Clock 
} from 'lucide-react';

import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { WebhookInspector } from './components/WebhookInspector';
import { ConversationDesk } from './components/ConversationDesk';
import { AppointmentsView } from './components/AppointmentsView';
import { TemplatesView } from './components/TemplatesView';
import { KnowledgeConfig } from './components/KnowledgeConfig';
import { GuideView } from './components/GuideView';

export function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'inspector' | 'conversations' | 'appointments' | 'templates' | 'settings' | 'guide'>('simulator');
  const [statusData, setStatusData] = useState<any>(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        setStatusData(await res.json());
      }
    } catch {
      // offline
    }
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Bot size={24} color="#fff" />
          </div>
          <div>
            <div className="brand-title">
              Claude WhatsApp Agent
              <span className="brand-tag">v21.0 Cloud API</span>
            </div>
            <div className="brand-subtitle">
              Autonomous Assistant on its Own Official Dedicated Line
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <MessageSquare size={16} /> Sandbox Simulator
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            <Activity size={16} /> Webhook Inspector
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            <Users size={16} /> Escalations Desk
            {statusData?.openEscalationsCount > 0 && (
              <span className="badge badge-danger" style={{ padding: '0px 6px', fontSize: '0.65rem' }}>
                {statusData.openEscalationsCount}
              </span>
            )}
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            <Calendar size={16} /> Appointments
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <FileCode size={16} /> 24h & Templates
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} /> Config & Keys
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => setActiveTab('guide')}
          >
            <BookOpen size={16} /> Guide
          </button>
        </nav>

        {/* System Status Pill */}
        <div className="system-status-pill">
          <div className="status-dot" />
          <span>
            {statusData?.whatsapp?.isSimulation ? 'Sandbox Engine Ready' : 'Meta Live Connected'}
          </span>
        </div>
      </header>

      {/* Metrics Banner */}
      <section className="metrics-strip">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ color: '#25d366' }}>
            <Radio size={20} />
          </div>
          <div>
            <div className="metric-val">
              {statusData?.whatsapp?.isSimulation ? 'Sandbox' : 'Live Graph API'}
            </div>
            <div className="metric-label">WhatsApp Cloud Line Mode</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ color: '#60a5fa' }}>
            <Users size={20} />
          </div>
          <div>
            <div className="metric-val">{statusData?.activeConversationsCount ?? 1}</div>
            <div className="metric-label">Active Customer Threads</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ color: '#fbbf24' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div className="metric-val">{statusData?.appointmentsCount ?? 2}</div>
            <div className="metric-label">Calendar Appointments</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ color: statusData?.openEscalationsCount > 0 ? '#ef4444' : '#10b981' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="metric-val" style={{ color: statusData?.openEscalationsCount > 0 ? '#ef4444' : '#34d399' }}>
              {statusData?.openEscalationsCount ?? 0}
            </div>
            <div className="metric-label">Open Human Escalations</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ color: '#c084fc' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="metric-val">Claude 3.5</div>
            <div className="metric-label">Sonnet Reasoner Loop</div>
          </div>
        </div>
      </section>

      {/* Main View Area */}
      <main className="main-view-container">
        {activeTab === 'simulator' && <WhatsAppSimulator />}
        {activeTab === 'inspector' && <WebhookInspector />}
        {activeTab === 'conversations' && <ConversationDesk />}
        {activeTab === 'appointments' && <AppointmentsView />}
        {activeTab === 'templates' && <TemplatesView />}
        {activeTab === 'settings' && <KnowledgeConfig />}
        {activeTab === 'guide' && <GuideView />}
      </main>
    </div>
  );
}

export default App;
