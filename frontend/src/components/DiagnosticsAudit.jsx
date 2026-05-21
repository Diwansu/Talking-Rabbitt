import React from 'react';
import { ShieldAlert, Activity } from 'lucide-react';

export default function DiagnosticsAudit({ diagnostics }) {
  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-summary">
        <div className="metric-card">
          <span className="metric-label">Catalog Health Score</span>
          <span
            className="metric-value"
            style={{
              color: diagnostics?.qualityScore > 80 ? '#10b981' : '#f59e0b',
            }}
          >
            {diagnostics?.qualityScore}%
          </span>
          <div className="quality-meter-container">
            <div
              className="quality-meter-value"
              style={{
                width: `${diagnostics?.qualityScore}%`,
                backgroundColor: diagnostics?.qualityScore > 80 ? '#10b981' : '#f59e0b',
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
          <h4>
            <ShieldAlert size={16} color="#ef4444" /> Pricing & Catalog Anomalies (
            {diagnostics?.anomalies?.length || 0})
          </h4>
          {diagnostics?.anomalies?.length === 0 ? (
            <p className="clean-alert">No catalog quality alerts found.</p>
          ) : (
            <ul className="alerts-list">
              {diagnostics?.anomalies.map((anom, idx) => (
                <li key={idx} className="alert-item">
                  {anom}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="alert-section">
          <h4>
            <Activity size={16} color="#f59e0b" /> Inventory Stockout Warnings (
            {diagnostics?.stockWarnings?.length || 0})
          </h4>
          {diagnostics?.stockWarnings?.length === 0 ? (
            <p className="clean-alert">No stockout alerts detected.</p>
          ) : (
            <ul className="alerts-list">
              {diagnostics?.stockWarnings.map((warn, idx) => (
                <li key={idx} className="alert-item warn">
                  {warn}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
