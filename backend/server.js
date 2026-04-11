import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import csv from 'csv-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Initialize AI client (Groq uses OpenAI-compatible SDK)
const ai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.GROK_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
});

const aiModel = process.env.GROQ_MODEL || process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

app.use(cors());
app.use(express.json());

// Set up Multer for file uploads (storing temporarily on disk or memory)
const upload = multer({ dest: 'uploads/' });

// In-memory store for CSV summaries (for MVP simplicity)
// In a real app this would go to MongoDB
const datasetsContext = new Map();

const stripBom = (value) => (typeof value === 'string' ? value.replace(/^\uFEFF/, '') : value);

const parseCellValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return '';

  // Parse integers/decimals when possible so analytics aren't string-based.
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }

  return trimmed;
};

const buildDatasetInsights = (rows, headers) => {
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

const toNumericValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeChartConfig = (rawChartConfig, chartPreference) => {
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

const tryParseModelJson = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleaned = rawText.trim();
  const candidates = [cleaned];

  // Try extracting first JSON object block if model wraps extra text.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  // Common failure: model returns key/value pairs without outer braces.
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

const findMeaningfulStringDeep = (value, visited = new Set()) => {
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

const buildTextAnswer = (parsedOutput, normalizedChartConfig, query) => {
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

  // If the model used a different top-level key, pick a meaningful string value,
  // excluding technical/config strings like chart type values.
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

  // Build a helpful fallback from chart data instead of a generic sentence.
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

const findHeader = (headers, candidates) => {
  const lowered = headers.map((header) => ({ original: header, lowered: String(header).toLowerCase() }));
  for (const candidate of candidates) {
    const match = lowered.find((entry) => entry.lowered.includes(candidate));
    if (match) return match.original;
  }
  return null;
};

const buildDeterministicAnswerFromData = (query, datasetInfo, chartPreference) => {
  if (!datasetInfo || !Array.isArray(datasetInfo.fullData) || datasetInfo.fullData.length === 0) return null;

  const q = String(query || '').toLowerCase();
  const headers = datasetInfo.headers || Object.keys(datasetInfo.fullData[0] || {});
  const revenueHeader = findHeader(headers, ['revenue', 'sales', 'amount']);
  if (!revenueHeader) return null;

  const preference = String(chartPreference || 'auto').toLowerCase();

  // "Which region got the highest revenue?"
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

  // "How much revenue from electronic category?"
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

  // "How many units sold in electronics category?"
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

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  const headers = [];

  // Parse the uploaded CSV
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
      // Clean up the temporary file
      fs.unlinkSync(req.file.path);

      const datasetId = Date.now().toString();

      // Keep a summary of the dataset to send to Grok
      // If dataset is huge, we'd only keep schema and top rows or aggregate it.
      // For MVP, we'll store max 50 rows + schema for context
      const sampleData = results.slice(0, 50);
      const rowCount = results.length;

      const insights = buildDatasetInsights(results, headers);

      const contextStr = `
Dataset Schema (Headers): ${headers.join(', ')}
Total Rows: ${rowCount}
    Column Insights (computed from ALL rows):
    ${JSON.stringify(insights, null, 2)}
Sample Data:
${JSON.stringify(sampleData, null, 2)}
      `;

      datasetsContext.set(datasetId, {
        headers,
        rowCount,
        fullData: results,
        contextStr,
      });

      res.json({
        message: 'File processed successfully',
        datasetId,
        headers,
        rowCount,
      });
    })
    .on('error', (err) => {
      res.status(500).json({ error: 'Error parsing CSV file' });
    });
});

app.post('/api/chat', async (req, res) => {
  const { datasetId, query, chartPreference = 'auto' } = req.body;

  if (!datasetId || !datasetsContext.has(datasetId)) {
    return res.status(400).json({ error: 'Invalid or missing datasetId' });
  }

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const datasetInfo = datasetsContext.get(datasetId);

  try {
    // We instruct the model to return a structured JSON string
    // containing both a 'textAnswer' and a 'chartConfig'
    const systemPrompt = `
You are Talking Rabbitt, a conversational intelligence layer for enterprise data.
You are helping an AI Product Manager analyze their data.
The user has uploaded a CSV dataset. Here is the summary of that dataset:
${datasetInfo.contextStr}

Important: "Column Insights" are computed from ALL rows and should be treated as the source of truth for totals/averages/counts.
Use "Sample Data" only to understand structure and examples.
The user selected chart preference: ${chartPreference}.

Chart preference rules:
- If preference is "bar", return chartConfig.type = "bar" when chartable.
- If preference is "line", return chartConfig.type = "line" when chartable.
- If preference is "none", return chartConfig.type = "none" and dataPoints = [].
- If preference is "auto", choose the best fit.

The user will ask a question about this data.
You MUST respond with ONLY a valid JSON object matching this schema:
{
  "textAnswer": "Your concise, insightful textual answer to the query.",
  "chartConfig": {
    "type": "bar" | "line" | "none",
    "title": "Title of the chart",
    "xAxisKey": "name of the field to use as x-axis (e.g. region, month)",
    "dataPoints": [
      { "[xAxisKey]": "...", "value": 123 },
      ... up to 15 data points ...
    ]
  }
}
If the query does not require a chart, set "type" to "none" and "dataPoints" to [].
Do NOT wrap the JSON in markdown code blocks (\`\`\`json). Just return the raw JSON object. Use valid double quotes. Ensure it parses cleanly via JSON.parse().
    `;

    const response = await ai.chat.completions.create({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
    });

    const rawOutput = response.choices[0].message.content;

    // Clean up potential markdown formatting if the model still adds it
    const cleanOutput = rawOutput
      .replace(/^```json/m, '')
      .replace(/```$/m, '')
      .trim();

    try {
      const parsedOutput = tryParseModelJson(cleanOutput);
      if (!parsedOutput) {
        throw new Error('Model output is not valid JSON.');
      }

      const deterministic = buildDeterministicAnswerFromData(query, datasetInfo, chartPreference);
      if (deterministic) {
        return res.json(deterministic);
      }

      const normalizedChart = normalizeChartConfig(parsedOutput.chartConfig || parsedOutput.chart, chartPreference);
      const textAnswer = buildTextAnswer(parsedOutput, normalizedChart, query);

      res.json({
        textAnswer,
        chartConfig: normalizedChart,
      });
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw Output:', cleanOutput);
      // Fallback response if model fails to format
      res.json({
        textAnswer:
          "Here's what I observed, but I couldn't format the chart perfectly: " +
          cleanOutput,
        chartConfig: { type: 'none' },
      });
    }
  } catch (error) {
    console.error('Error generating content from Grok:', error);
    res.status(500).json({ error: 'Failed to process the query with the AI model.' });
  }
});

app.listen(port, () => {
  console.log(`Talking Rabbitt API Server running on port ${port}`);
});