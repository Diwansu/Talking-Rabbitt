import React, { useState } from 'react';
import axios from 'axios';
import UploadBox from './components/UploadBox.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import './index.css';

// Safe default fallback if environment variables are not loaded/configured locally
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/';

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
      type: type === 'none' ? 'bar' : type,
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

    if (aggregateIntent && !hasGrouping && tokenCount <= 4 && !hasFilterPhrase) {
      return "Tip: For charts, include a grouping field. Try 'total revenue by category' or 'total revenue by region'.";
    }

    return '';
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setIsUploading(true);
    setFile(uploadedFile);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const uploadUrl = `${BACKEND_API_URL.replace(/\/$/, '')}/upload`;
      const res = await axios.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDatasetId(res.data.datasetId);
      setDiagnostics(res.data.diagnostics);
      setChat([
        {
          role: 'ai',
          text: `Awesome! I've loaded your retail dataset with ${res.data.rowCount} rows. I ran an autonomous catalog diagnostics audit (Score: ${res.data.diagnostics?.qualityScore || 100}%). Select an agent above and ask me anything!`,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert(`Failed to connect to the API server at ${BACKEND_API_URL}. Please ensure your backend is running.`);
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
    setChat((prev) => [...prev, { role: 'user', text: userMessage }]);
    setInputVal('');
    setIsTyping(true);

    try {
      const chatUrl = `${BACKEND_API_URL.replace(/\/$/, '')}/chat`;
      const res = await axios.post(chatUrl, {
        datasetId,
        query: userMessage,
        chartPreference: 'bar',
        agent,
      });

      const textAnswer = res.data.textAnswer || res.data.answer || 'I analyzed your data.';
      const normalizedChart = normalizeChartConfig(res.data.chartConfig || res.data.chart);

      setChat((prev) => [...prev, { role: 'ai', text: textAnswer }]);
      setChartConfig(normalizedChart);
    } catch (err) {
      console.error(err);
      setChat((prev) => [
        ...prev,
        { role: 'ai', text: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1 className="gradient-text">Rabbitt Retail</h1>
        <p>Multi-Agent Retail Intelligence & Catalog Diagnostics Platform</p>
      </header>

      {!datasetId ? (
        <UploadBox handleFileUpload={handleFileUpload} isUploading={isUploading} />
      ) : (
        <DashboardLayout
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          chartConfig={chartConfig}
          diagnostics={diagnostics}
          agent={agent}
          setAgent={setAgent}
          chat={chat}
          inputVal={inputVal}
          setInputVal={setInputVal}
          handleSend={handleSend}
          isTyping={isTyping}
          chartHint={chartHint}
        />
      )}
    </div>
  );
}