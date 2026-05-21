import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, Send, BarChart2, MessageSquare, Activity, Zap, ShieldAlert, Sparkles, Database, FileText } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import './index.css';


export default function App() {
  const [file, setFile] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [agent, setAgent] = useState('analyst');
  const [activeTab, setActiveTab] = useState('charts');
  
  const [chat, setChat] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chartConfig, setChartConfig] = useState({ type: 'none' });
  const [chartHint, setChartHint] = useState('');

  const toNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;

    const cleaned = value.replace(/,/g, '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeChartConfig = (rawChartConfig) => {
    if (!rawChartConfig || typeof rawChartConfig !== 'object') {
      return { type: 'none', title: '', xAxisKey: 'label', dataPoints: [] };
    }

    const typeValue = String(rawChartConfig.type || '').toLowerCase();
    const type = typeValue === 'bar' || typeValue === 'line' ? typeValue : 'none';

    let xAxisKey = rawChartConfig.xAxisKey || rawChartConfig.xAxis || rawChartConfig.labelKey || 'label';
    const sourceData = rawChartConfig.dataPoints || rawChartConfig.data || rawChartConfig.points || [];

    if (!Array.isArray(sourceData) || sourceData.length === 0) {
      return {
        type: 'none',
        title: rawChartConfig.title || '',
        xAxisKey,
        dataPoints: [],
      };
    }

    if (!rawChartConfig.xAxisKey && sourceData[0] && typeof sourceData[0] === 'object') {
      const inferredKey = Object.keys(sourceData[0]).find(
        (key) => !['value', 'y', 'amount', 'total', 'count', 'metric'].includes(key)
      );
      if (inferredKey) xAxisKey = inferredKey;
    }

    const normalizedPoints = sourceData
      .map((point) => {
        if (!point || typeof point !== 'object') return null;

        const label = point[xAxisKey] ?? point.label ?? point.name ?? point.category ?? point.x;
        const value =
          toNumber(point.value) ??
          toNumber(point.y) ??
          toNumber(point.amount) ??
          toNumber(point.total) ??
          toNumber(point.count) ??
          toNumber(point.metric);

        if (label === undefined || label === null || value === null) return null;

        return {
          [xAxisKey]: String(label),
          value,
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    if (normalizedPoints.length === 0) {
      return {
        type: 'none',
        title: rawChartConfig.title || '',
        xAxisKey,
        dataPoints: [],
      };
    }

    return {
      type: 'bar',
      title: rawChartConfig.title || 'Data Visualization',
      xAxisKey,
      dataPoints: normalizedPoints,
    };
  };

  const getChartHint = (queryText) => {
    const query = String(queryText || '').toLowerCase().trim();
    if (!query) return '';

    const aggregateIntent = /(total|sum|overall|average|avg|max|min|count)/.test(query);
    const hasGrouping = /\bby\b/.test(query);
    const tokenCount = query.split(/\s+/).filter(Boolean).length;
    const hasFilterPhrase = /\b(in|for|where|with)\b/.test(query);

    // Show guidance only for short aggregate-only prompts like "total revenue".
    if (aggregateIntent && !hasGrouping && tokenCount <= 4 && !hasFilterPhrase) {
      return "Tip: For charts, include a grouping field. Try 'total revenue by category' or 'total revenue by region'.";
    }

    return '';
  };

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isTyping]);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setIsUploading(true);
    setFile(uploadedFile);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDatasetId(res.data.datasetId);
      setDiagnostics(res.data.diagnostics);
      setChat([
        { role: 'ai', text: `Awesome! I've loaded your retail dataset with ${res.data.rowCount} rows. I ran an autonomous catalog diagnostics audit (Score: ${res.data.diagnostics?.qualityScore || 100}%). Select an agent above and ask me anything!` }
      ]);
    } catch (err) {
      console.error(err);
      alert('Failed to upload the file. Is the backend running?');
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!inputVal.trim() || !datasetId) return;

    const userMessage = inputVal;
    const currentHint = getChartHint(userMessage);
    setChartHint(currentHint);
    setChat(prev => [...prev, { role: 'user', text: userMessage }]);
    setInputVal('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}chat`, {
        datasetId,
        query: userMessage,
        chartPreference: 'bar',
        agent,
      });

      const textAnswer = res.data.textAnswer || res.data.answer || 'I analyzed your data.';
      const normalizedChart = normalizeChartConfig(res.data.chartConfig || res.data.chart);

      setChat(prev => [...prev, { role: 'ai', text: textAnswer }]);
      
      setChartConfig(normalizedChart);
    } catch (err) {
      console.error(err);
      setChat(prev => [...prev, { role: 'ai', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1 className="gradient-text">Rabbitt Retail</h1>
        <p>Multi-Agent Retail Intelligence & Catalog Diagnostics Platform</p>
      </header>

      {!datasetId ? (
        <div className="upload-wrapper">
          <div className="upload-actions">
            <label className="glass-panel upload-box">
              {isUploading ? (
                <div className="empty-state">
                  <Activity size={48} className="upload-icon" style={{ animation: 'bounce 2s infinite' }} />
                  <h3>Analyzing Catalog Data...</h3>
                  <p>Running data diagnostics audits</p>
                </div>
              ) : (
                <>
                  <UploadCloud className="upload-icon" />
                  <h3>Upload Retail Catalog / Sales CSV</h3>
                  <p className="text-muted" style={{ marginTop: '0.5rem' }}>Drag & drop your inventory or transactional dataset</p>
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="upload-input" 
                    onChange={handleFileUpload} 
                  />
                </>
              )}
            </label>
            {!isUploading && (
              <>
                <a
                  className="sample-download-btn"
                  href="/sample-sales-data.csv"
                  download
                  onClick={(e) => e.stopPropagation()}
                >
                  Download Walmart Sample Catalog
                </a>
                <p className="sample-download-note">Contains intentional pricing alerts, missing categories, and stock warnings for testing.</p>
              </>
            )}
          </div>
        </div>
      ) : (
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
                chartConfig.type === 'none' ? (
                  <div className="empty-state">
                    <Zap size={48} color="rgba(255,255,255,0.1)" />
                    <p>Ask the <b>Analyst Agent</b> a quantitative question to generate a chart (e.g., "Compare pricing by category" or "Highest revenue by region").</p>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#f8fafc', fontWeight: 500 }}>
                      {chartConfig.title || 'Data Visualization'}
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartConfig.dataPoints} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey={chartConfig.xAxisKey} 
                          stroke="#94a3b8" 
                          tick={{ fill: '#94a3b8', fontSize: 12 }} 
                          tickMargin={10} 
                        />
                        <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #3b82f6', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#ec4899' }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="url(#colorUv)" 
                          radius={[4, 4, 0, 0]} 
                          animationDuration={1500} 
                        />
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : (
                /* Catalog Quality Audit Visualizer */
                <div className="diagnostics-panel">
                  <div className="diagnostics-summary">
                    <div className="metric-card">
                      <span className="metric-label">Catalog Health Score</span>
                      <span className="metric-value" style={{ color: diagnostics?.qualityScore > 80 ? '#10b981' : '#f59e0b' }}>
                        {diagnostics?.qualityScore}%
                      </span>
                      <div className="quality-meter-container">
                        <div 
                          className="quality-meter-value" 
                          style={{ 
                            width: `${diagnostics?.qualityScore}%`,
                            backgroundColor: diagnostics?.qualityScore > 80 ? '#10b981' : '#f59e0b' 
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Data Completeness</span>
                      <span className="metric-value text-blue">{diagnostics?.completeness}%</span>
                      <p className="metric-subtext">Percentage of populated fields</p>
                    </div>
                  </div>

                  <div className="diagnostics-details">
                    <div className="alert-section">
                      <h4><ShieldAlert size={16} color="#ef4444" /> Pricing & Catalog Anomalies ({diagnostics?.anomalies?.length || 0})</h4>
                      {diagnostics?.anomalies?.length === 0 ? (
                        <p className="clean-alert">No catalog quality alerts found.</p>
                      ) : (
                        <ul className="alerts-list">
                          {diagnostics?.anomalies.map((anom, idx) => (
                            <li key={idx} className="alert-item">{anom}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="alert-section">
                      <h4><Activity size={16} color="#f59e0b" /> Inventory Stockout Warnings ({diagnostics?.stockWarnings?.length || 0})</h4>
                      {diagnostics?.stockWarnings?.length === 0 ? (
                        <p className="clean-alert">No stockout alerts detected.</p>
                      ) : (
                        <ul className="alerts-list">
                          {diagnostics?.stockWarnings.map((warn, idx) => (
                            <li key={idx} className="alert-item warn">{warn}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Interface with Agent Routing */}
          <div className="glass-panel chat-container">
            <div className="chat-header">
              <div className="agent-badge">
                {agent === 'analyst' && <BarChart2 size={16} color="#8b5cf6" />}
                {agent === 'diagnostics' && <ShieldAlert size={16} color="#ef4444" />}
                {agent === 'marketing' && <Sparkles size={16} color="#ec4899" />}
                <span>Active Agent: {agent === 'analyst' ? 'Inventory Analyst' : agent === 'diagnostics' ? 'Catalog Diagnostics' : 'Copywriter / Recs'}</span>
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
            
            <div className="chat-messages">
              {chat.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              {isTyping && (
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              )}
              {chartConfig.type === 'none' && chartHint && (
                <div className="hint-banner">
                  {chartHint}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <input 
                type="text" 
                className="chat-input" 
                placeholder={
                  agent === 'analyst' 
                    ? "Ask e.g. 'Compare sales of TV vs Headphones'"
                    : agent === 'diagnostics'
                    ? "Ask e.g. 'Why does Electric Toothbrush have zero price?'"
                    : "Ask e.g. 'Generate an advertising title for Office Chair'"
                }
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
              />
              <button className="send-btn" onClick={handleSend} disabled={!inputVal.trim() || isTyping}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}