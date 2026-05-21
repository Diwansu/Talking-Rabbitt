import { ai, aiModel } from '../config/ai.js';
import { datasetsContext } from '../config/store.js';
import {
  buildDeterministicAnswerFromData,
  normalizeChartConfig,
  tryParseModelJson,
  buildTextAnswer,
} from '../services/analytics.js';

export const handleChat = async (req, res) => {
  const { datasetId, query, chartPreference = 'auto', agent = 'analyst' } = req.body;

  if (!datasetId || !datasetsContext.has(datasetId)) {
    return res.status(400).json({ error: 'Invalid or missing datasetId' });
  }

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const datasetInfo = datasetsContext.get(datasetId);

  try {
    let agentInstructions = '';
    if (agent === 'diagnostics') {
      agentInstructions = `You are the Catalog Quality & Risk Diagnostics Agent for Rabbitt Retail.
Focus on diagnosing catalog health, formatting anomalies, stockout risks (like zero stock items with active sales), pricing errors (like zero or negative prices), and proposing cleansing scripts (e.g. Python/JS snippets). Make your textAnswer detailed and structured. If a chart is requested or useful, construct chartConfig to show data quality metrics, missing fields count, or risk distributions.`;
    } else if (agent === 'marketing') {
      agentInstructions = `You are the Personalization & Marketing Copywriter Agent for Rabbitt Retail.
Focus on creative product copywriting, advertising copy, SEO tag generation, product recommendation bundles (e.g. cross-selling category items), and market basket analysis insights based on the sales numbers. Make your textAnswer highly engaging and creative. If a chart is requested, construct a chartConfig depicting category popularity, user segments, or recommendation confidence.`;
    } else {
      agentInstructions = `You are the Sales & Inventory Analytics Agent for Rabbitt Retail.
Focus on numerical trends, aggregations, computing totals/averages/counts, and resolving quantitative queries. Use the Column Insights as the mathematical ground truth. If a chart is requested, create a clean bar/line chart with xAxisKey and dataPoints.`;
    }

    const systemPrompt = `
${agentInstructions}

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

      // Check for deterministic fallback first
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
      res.json({
        textAnswer:
          "Here's what I observed, but I couldn't format the chart perfectly: " +
          cleanOutput,
        chartConfig: { type: 'none' },
      });
    }
  } catch (error) {
    console.error('Error generating content from Groq:', error);
    res.status(500).json({ error: 'Failed to process the query with the AI model.' });
  }
};
