import { toNumericValue } from './analytics.js';

export const generateCatalogDiagnostics = (rows, headers) => {
  let qualityScore = 100;
  const anomalies = [];
  const stockWarnings = [];
  const missingFields = {};

  headers.forEach((header) => {
    missingFields[header] = 0;
  });

  rows.forEach((row) => {
    headers.forEach((header) => {
      const val = row[header];
      if (val === undefined || val === null || val === '') {
        missingFields[header]++;
      }
    });
  });

  let totalMissing = 0;
  headers.forEach((header) => {
    totalMissing += missingFields[header];
  });

  const totalPossibleCells = rows.length * headers.length;
  const completenessPercent = totalPossibleCells > 0
    ? ((totalPossibleCells - totalMissing) / totalPossibleCells) * 100
    : 100;

  qualityScore -= (100 - completenessPercent) * 0.5;

  const findCol = (keys) => headers.find((h) => keys.some((k) => String(h).toLowerCase().includes(k)));
  const priceCol = findCol(['price', 'msrp', 'cost']);
  const stockCol = findCol(['stock', 'quantity', 'qty', 'on_hand']);
  const salesCol = findCol(['sales', 'units_sold', 'revenue']);
  const nameCol = findCol(['name', 'title', 'product']);
  const idCol = findCol(['id', 'sku', 'code']);

  rows.forEach((row) => {
    const pName = row[nameCol] || row[idCol] || 'Unknown Product';

    if (priceCol) {
      const priceVal = toNumericValue(row[priceCol]);
      if (priceVal !== null) {
        if (priceVal <= 0) {
          anomalies.push(`Pricing Error: Product '${pName}' has a price of $${priceVal}. Retail items must have positive value.`);
          qualityScore -= 5;
        } else if (priceVal > 5000) {
          anomalies.push(`Pricing Outlier: Product '${pName}' has a price of $${priceVal} (unusually high).`);
          qualityScore -= 2;
        }
      }
    }

    if (stockCol) {
      const stockVal = toNumericValue(row[stockCol]);
      if (stockVal !== null && stockVal < 0) {
        anomalies.push(`Inventory Error: Product '${pName}' has negative stock (${stockVal}).`);
        qualityScore -= 5;
      }

      if (stockVal === 0 && salesCol) {
        const salesVal = toNumericValue(row[salesCol]) || toNumericValue(row['Sales_Q1']) || toNumericValue(row['Sales_Q2']) || 0;
        if (salesVal > 0) {
          stockWarnings.push(`Stockout Risk: Product '${pName}' is out of stock (Stock = 0) but has active sales (${salesVal} units).`);
          qualityScore -= 3;
        }
      }
    }
  });

  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  return {
    qualityScore,
    anomalies: anomalies.slice(0, 10),
    stockWarnings: stockWarnings.slice(0, 10),
    completeness: Math.round(completenessPercent),
    missingFields,
  };
};
