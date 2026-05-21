import React from 'react';
import { Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ChartsVisualizer({ chartConfig }) {
  if (chartConfig.type === 'none') {
    return (
      <div className="empty-state">
        <Zap size={48} color="rgba(255,255,255,0.1)" />
        <p>
          Ask the <b>Analyst Agent</b> a quantitative question to generate a chart (e.g.,
          "Compare pricing by category" or "Highest revenue by region").
        </p>
      </div>
    );
  }

  return (
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
            contentStyle={{
              backgroundColor: '#1a1d27',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              color: '#fff',
            }}
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
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
