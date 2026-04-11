import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, Send, BarChart2, MessageSquare, Activity, Zap } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import './index.css';


export default function App() {
  const [file, setFile] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
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
      setChat([
        { role: 'ai', text: `Awesome! I've loaded your data with ${res.data.rowCount} rows. What would you like to know?` }
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
        <h1 className="gradient-text">Talking Rabbitt</h1>
        <p>Conversational Intelligence for Enterprise Data</p>
      </header>

      {!datasetId ? (
        <div className="upload-wrapper">
          <div className="upload-actions">
            <label className="glass-panel upload-box">
              {isUploading ? (
                <div className="empty-state">
                  <Activity size={48} className="upload-icon" style={{ animation: 'bounce 2s infinite' }} />
                  <h3>Analyzing Data...</h3>
                  <p>Preparing conversational layer</p>
                </div>
              ) : (
                <>
                  <UploadCloud className="upload-icon" />
                  <h3>Upload Datasets</h3>
                  <p className="text-muted" style={{ marginTop: '0.5rem' }}>Drag & drop your CSV file here to start exploring</p>
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
                  Download Sample CSV
                </a>
                <p className="sample-download-note">No data yet? Use this sample file to test charts and chat instantly.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="dashboard-layout">
          {/* Smart Dashboard Layer */}
          <div className="glass-panel viz-container">
            <div className="viz-header">
              <h2><BarChart2 size={24} color="#8b5cf6" /> Live Insights</h2>
            </div>
            <div className="viz-body">
              {chartConfig.type === 'none' ? (
                <div className="empty-state">
                  <Zap size={48} color="rgba(255,255,255,0.1)" />
                  <p>Ask a question about your data to generate a chart</p>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%' }}>
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
              )}
            </div>
          </div>

          {/* Chat Interface */}
          <div className="glass-panel chat-container">
            <div className="chat-header">
              <MessageSquare size={20} color="#ec4899" /> Talking Rabbitt AI
            </div>
            
            <div className="chat-messages">
              {chat.map((msg, i) => (
                // FIX 2: Replaced invalid \`message \${msg.role}\` with a proper template literal
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
                placeholder="Ask e.g., 'What is the total revenue by region?'"
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