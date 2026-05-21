import React from 'react';
import { BarChart2, ShieldAlert } from 'lucide-react';
import ChartsVisualizer from './ChartsVisualizer.jsx';
import DiagnosticsAudit from './DiagnosticsAudit.jsx';
import AgentSelector from './AgentSelector.jsx';
import ChatInterface from './ChatInterface.jsx';

export default function DashboardLayout({
  activeTab,
  setActiveTab,
  chartConfig,
  diagnostics,
  agent,
  setAgent,
  chat,
  inputVal,
  setInputVal,
  handleSend,
  isTyping,
  chartHint,
}) {
  return (
    <div className="dashboard-layout">
      {/* Smart Dashboard / Diagnostics Audit Panel */}
      <div className="glass-panel viz-container">
        <div className="tabs-header">
          <button
            className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            <BarChart2 size={16} /> Live Charts
          </button>
          <button
            className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            <ShieldAlert size={16} /> Diagnostics Audit
          </button>
        </div>

        <div className="viz-body">
          {activeTab === 'charts' ? (
            <ChartsVisualizer chartConfig={chartConfig} />
          ) : (
            <DiagnosticsAudit diagnostics={diagnostics} />
          )}
        </div>
      </div>

      {/* Chat Interface with Agent Routing */}
      <div className="glass-panel chat-container">
        <AgentSelector agent={agent} setAgent={setAgent} />
        <ChatInterface
          chat={chat}
          inputVal={inputVal}
          setInputVal={setInputVal}
          handleSend={handleSend}
          isTyping={isTyping}
          agent={agent}
          chartConfig={chartConfig}
          chartHint={chartHint}
        />
      </div>
    </div>
  );
}
