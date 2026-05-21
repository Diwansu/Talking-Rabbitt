import React from 'react';
import { BarChart2, ShieldAlert, Sparkles } from 'lucide-react';

export default function AgentSelector({ agent, setAgent }) {
  return (
    <>
      <div className="chat-header">
        <div className="agent-badge">
          {agent === 'analyst' && <BarChart2 size={16} color="#8b5cf6" />}
          {agent === 'diagnostics' && <ShieldAlert size={16} color="#ef4444" />}
          {agent === 'marketing' && <Sparkles size={16} color="#ec4899" />}
          <span>
            Active Agent:{' '}
            {agent === 'analyst'
              ? 'Inventory Analyst'
              : agent === 'diagnostics'
              ? 'Catalog Diagnostics'
              : 'Copywriter / Recs'}
          </span>
        </div>
      </div>

      <div className="agent-tabs">
        <button
          className={`agent-tab-btn ${agent === 'analyst' ? 'active' : ''}`}
          onClick={() => setAgent('analyst')}
        >
          📊 Analyst
        </button>
        <button
          className={`agent-tab-btn ${agent === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setAgent('diagnostics')}
        >
          ⚠️ Diagnostics
        </button>
        <button
          className={`agent-tab-btn ${agent === 'marketing' ? 'active' : ''}`}
          onClick={() => setAgent('marketing')}
        >
          🛍️ Marketing
        </button>
      </div>
    </>
  );
}
