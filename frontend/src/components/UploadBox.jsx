import React from 'react';
import { UploadCloud, Activity } from 'lucide-react';

export default function UploadBox({ handleFileUpload, isUploading }) {
  return (
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
              <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                Drag & drop your inventory or transactional dataset
              </p>
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
            <p className="sample-download-note">
              Contains intentional pricing alerts, missing categories, and stock warnings for testing.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
