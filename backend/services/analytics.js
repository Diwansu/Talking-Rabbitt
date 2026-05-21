export const stripBom = (value) => (typeof value === 'string' ? value.replace(/^\uFEFF/, '') : value);

export const parseCellValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return '';

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }

  return trimmed;
};

export const buildDatasetInsights = (rows, headers) => {
  const numericStats = [];
  const categoricalStats = [];

  headers.forEach((header) => {
    const values = rows
      .map((row) => row[header])
      .filter((value) => value !== '' && value !== null && value !== undefined);

    if (values.length === 0) return;

    const numericValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value));

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      numericStats.push({
        column: header,
        count: numericValues.length,
        sum,
        avg: Number((sum / numericValues.length).toFixed(4)),
        min,
        max,
      });
      return;
    }

    const counts = new Map();
    values.forEach((value) => {
      const key = String(value);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    categoricalStats.push({ column: header, topValues });
  });

  return { numericStats, categoricalStats };
};

export const toNumericValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeChartConfig = (rawChartConfig, chartPreference) => {
  const preference = String(chartPreference || 'auto').toLowerCase();

  if (preference === 'none') {
    return {
      type: 'none',
      title: 'Chart hidden by user selection',
      xAxisKey: 'label',
      dataPoints: [],
    };
  }

  if (!rawChartConfig || typeof rawChartConfig !== 'object') {
    return { type: 'none', title: '', xAxisKey: 'label', dataPoints: [] };
  }

  let type = String(rawChartConfig.type || 'none').toLowerCase();
  if (!['bar', 'line', 'none'].includes(type)) type = 'none';

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

  const dataPoints = sourceData
    .map((point) => {
      if (!point || typeof point !== 'object') return null;

      const label = point[xAxisKey] ?? point.label ?? point.name ?? point.category ?? point.x;
      const value =
        toNumericValue(point.value) ??
        toNumericValue(point.y) ??
        toNumericValue(point.amount) ??
        toNumericValue(point.total) ??
        toNumericValue(point.count) ??
        toNumericValue(point.metric);

      if (label === undefined || label === null || value === null) return null;

      return {
        [xAxisKey]: String(label),
        value,
      };
    })
    .filter(Boolean)
    .slice(0, 20);

  if (dataPoints.length === 0) {
    return {
      type: 'none',
      title: rawChartConfig.title || '',
      xAxisKey,
      dataPoints: [],
    };
  }

  if (preference === 'bar' || preference === 'line') {
    type = preference;
  }

  if (type === 'none' && preference === 'auto') {
    type = 'bar';
  }

  return {
    type,
    title: rawChartConfig.title || 'Data Visualization',
    xAxisKey,
    dataPoints,
  };
};

export const tryParseModelJson = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleaned = rawText.trim();
  const candidates = [cleaned];

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  if (cleaned.startsWith('"textAnswer"') || cleaned.startsWith('"chartConfig"')) {
    candidates.push(`{${cleaned}}`);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // try next candidate
    }
  }

  return null;
};

export const findMeaningfulStringDeep = (value, visited = new Set()) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const lower = normalized.toLowerCase();
    if (['bar', 'line', 'none'].includes(lower)) return null;
    if (normalized.length < 8) return null;
    return normalized;
  }

  if (typeof value !== 'object') return null;
  if (visited.has(value)) return null;
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMeaningfulStringDeep(item, visited);
      if (found) return found;
    }
    return null;
  }

  for (const [key, objValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (['type', 'charttype', 'xaxiskey', 'title', 'label', 'chartconfig', 'datapoints'].includes(normalizedKey)) {
      continue;
    }

    const found = findMeaningfulStringDeep(objValue, visited);
    if (found) return found;
  }

  return null;
};

export const buildTextAnswer = (parsedOutput, normalizedChartConfig, query) => {
  if (!parsedOutput || typeof parsedOutput !== 'object') {
    return 'I analyzed your data.';
  }

  const directAnswer =
    parsedOutput.textAnswer ||
    parsedOutput.answer ||
    parsedOutput.response ||
    parsedOutput.summary ||
    parsedOutput.insight;

  if (typeof directAnswer === 'string' && directAnswer.trim()) {
    return directAnswer.trim();
  }

  const firstMeaningfulString = Object.entries(parsedOutput).find(([key, value]) => {
    if (typeof value !== 'string' || value.trim().length === 0) return false;

    const normalizedKey = key.toLowerCase();
    const normalizedValue = value.trim().toLowerCase();

    const blockedKeys = ['type', 'charttype', 'xaxiskey', 'title', 'label'];
    const blockedValues = ['bar', 'line', 'none'];

    return !blockedKeys.includes(normalizedKey) && !blockedValues.includes(normalizedValue);
  });

  if (firstMeaningfulString) {
    return firstMeaningfulString[1].trim();
  }

  const deepAnswer = findMeaningfulStringDeep(parsedOutput);
  if (deepAnswer) {
    return deepAnswer;
  }

  if (
    normalizedChartConfig?.type === 'bar' &&
    Array.isArray(normalizedChartConfig.dataPoints) &&
    normalizedChartConfig.dataPoints.length > 0
  ) {
    const topPoint = [...normalizedChartConfig.dataPoints]
      .sort((a, b) => (b.value || 0) - (a.value || 0))[0];

    const axisKey = normalizedChartConfig.xAxisKey;
    const axisValue = topPoint?.[axisKey];

    if (axisValue !== undefined && axisValue !== null) {
      return `Highest value for "${query}" appears in ${axisValue} with ${topPoint.value}.`;
    }
  }

  return 'I analyzed your data.';
};

export const findHeader = (headers, candidates) => {
  const lowered = headers.map((header) => ({ original: header, lowered: String(header).toLowerCase() }));
  for (const candidate of candidates) {
    const match = lowered.find((entry) => entry.lowered.includes(candidate));
    if (match) return match.original;
  }
  return null;
};

export const buildDeterministicAnswerFromData = (query, datasetInfo, chartPreference) => {
  if (!datasetInfo || !Array.isArray(datasetInfo.fullData) || datasetInfo.fullData.length === 0) return null;

  const q = String(query || '').toLowerCase();
  const headers = datasetInfo.headers || Object.keys(datasetInfo.fullData[0] || {});
  const revenueHeader = findHeader(headers, ['revenue', 'sales', 'amount']);
  if (!revenueHeader) return null;

  const preference = String(chartPreference || 'auto').toLowerCase();

  if (/region/.test(q) && /(highest|top|max)/.test(q) && /(revenue|sales)/.test(q)) {
    const regionHeader = findHeader(headers, ['region', 'zone', 'area']);
    if (!regionHeader) return null;

    const grouped = new Map();
    datasetInfo.fullData.forEach((row) => {
      const region = row[regionHeader];
      const revenue = toNumericValue(row[revenueHeader]);
      if (region === undefined || region === null || revenue === null) return;
      grouped.set(String(region), (grouped.get(String(region)) || 0) + revenue);
    });

    const dataPoints = [...grouped.entries()]
      .map(([region, value]) => ({ [regionHeader]: region, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    if (dataPoints.length === 0) return null;

    const top = dataPoints[0];
    return {
      textAnswer: `${top[regionHeader]} collected the highest revenue with ${top.value}.`,
      chartConfig:
        preference === 'none'
          ? { type: 'none', title: 'Chart hidden by user selection', xAxisKey: regionHeader, dataPoints: [] }
          : {
              type: preference === 'line' ? 'line' : 'bar',
              title: 'Revenue by Region',
              xAxisKey: regionHeader,
              dataPoints: dataPoints.slice(0, 15),
            },
    };
  }

  if (/(revenue|sales)/.test(q) && /(electronic|electronics)/.test(q) && /category/.test(q)) {
    const categoryHeader = findHeader(headers, ['category', 'product']);
    if (!categoryHeader) return null;

    const total = datasetInfo.fullData.reduce((acc, row) => {
      const categoryValue = String(row[categoryHeader] || '').toLowerCase();
      if (!categoryValue.includes('electronic')) return acc;
      const revenue = toNumericValue(row[revenueHeader]);
      return acc + (revenue || 0);
    }, 0);

    return {
      textAnswer: `Total revenue collected from Electronics category is ${Number(total.toFixed(2))}.`,
      chartConfig:
        preference === 'none'
          ? { type: 'none', title: 'Chart hidden by user selection', xAxisKey: categoryHeader, dataPoints: [] }
          : {
              type: preference === 'line' ? 'line' : 'bar',
              title: 'Revenue - Electronics Category',
              xAxisKey: categoryHeader,
              dataPoints: [{ [categoryHeader]: 'Electronics', value: Number(total.toFixed(2)) }],
            },
    };
  }

  if (/(unit|units|quantity|qty)/.test(q) && /(electonic|electronic|electronics)/.test(q) && /category/.test(q)) {
    const categoryHeader = findHeader(headers, ['category', 'product']);
    const unitsHeader = findHeader(headers, ['units', 'quantity', 'qty']);
    if (!categoryHeader || !unitsHeader) return null;

    const totalUnits = datasetInfo.fullData.reduce((acc, row) => {
      const categoryValue = String(row[categoryHeader] || '').toLowerCase();
      if (!categoryValue.includes('electronic')) return acc;
      const units = toNumericValue(row[unitsHeader]);
      return acc + (units || 0);
    }, 0);

    return {
      textAnswer: `Total units sold in Electronics category is ${Number(totalUnits.toFixed(2))}.`,
      chartConfig:
        preference === 'none'
          ? { type: 'none', title: 'Chart hidden by user selection', xAxisKey: categoryHeader, dataPoints: [] }
          : {
              type: preference === 'line' ? 'line' : 'bar',
              title: 'Units Sold - Electronics Category',
              xAxisKey: categoryHeader,
              dataPoints: [{ [categoryHeader]: 'Electronics', value: Number(totalUnits.toFixed(2)) }],
            },
    };
  }

  return null;
};
