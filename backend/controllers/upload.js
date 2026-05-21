import fs from 'fs';
import csv from 'csv-parser';
import { datasetsContext } from '../config/store.js';
import { stripBom, parseCellValue, buildDatasetInsights } from '../services/analytics.js';
import { generateCatalogDiagnostics } from '../services/diagnostics.js';

export const handleUpload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  const headers = [];

  fs.createReadStream(req.file.path)
    .pipe(
      csv({
        mapHeaders: ({ header }) => stripBom(header).trim(),
        mapValues: ({ value }) => parseCellValue(value),
      })
    )
    .on('headers', (h) => headers.push(...h))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Clean up the uploaded file
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to delete temp upload file:', err);
      }

      const datasetId = Date.now().toString();
      const sampleData = results.slice(0, 50);
      const rowCount = results.length;
      const insights = buildDatasetInsights(results, headers);
      const diagnostics = generateCatalogDiagnostics(results, headers);

      const contextStr = `
Dataset Schema (Headers): ${headers.join(', ')}
Total Rows: ${rowCount}
    Column Insights (computed from ALL rows):
    ${JSON.stringify(insights, null, 2)}
    Catalog Quality Diagnostics:
    ${JSON.stringify(diagnostics, null, 2)}
Sample Data:
${JSON.stringify(sampleData, null, 2)}
      `;

      datasetsContext.set(datasetId, {
        headers,
        rowCount,
        fullData: results,
        contextStr,
        diagnostics,
      });

      res.json({
        message: 'File processed successfully',
        datasetId,
        headers,
        rowCount,
        diagnostics,
      });
    })
    .on('error', (err) => {
      console.error('CSV Parsing Error:', err);
      res.status(500).json({ error: 'Error parsing CSV file' });
    });
};
