# Talking Rabbitt

A lightweight MVP for conversational data intelligence.

This project lets users upload a CSV dataset, ask natural-language questions about the data, and receive both text answers and chart suggestions powered by an AI backend.

## 🚀 Features (Pivoted for Walmart Global Tech ML/AI Internship)

This project has been pivoted into a **Multi-Agent Retail Intelligence & Catalog Diagnostics Platform** to align with Walmart Global Tech's ML/AI internship profile (focusing on Agentic AI, GenAI, Catalog Audits, and Pricing Risk Detection).

- **Autonomous Catalog Diagnostics**: Audits uploaded CSV datasets for anomalies (pricing errors, stockout risks, missing formatting) and generates a **Catalog Health Score** and **Completeness Metrics** immediately upon file upload.
- **Multi-Agent Conversational Routing**: Supports query routing to specialized context-aware retail agents:
  - 📊 **Inventory & Sales Analyst Agent**: Handles numbers, math, and trends, and builds interactive Recharts visualizations.
  - ⚠️ **Catalog Quality & Risk Diagnostics Agent**: Focuses on data hygiene, identifying catalog/pricing issues, and proposing programmatic solutions (cleansing scripts).
  - 🛍️ **Personalization & Marketing Copywriter Agent**: Generates advertising copy, SEO keywords, and dynamic product recommendations.
- **Interactive Recharts Dashboard**: Visualizes data queries instantly with dynamically colored responsive chart layouts.
- **Vercel Serverless Optimization**: Optimized to run fully on Vercel's serverless platform using memory/temp filesystem handling.

## 📦 Project structure

- `backend/`
  - Express server, Vercel serverless configurations (`vercel.json`)
  - Multer OS temp directory file handling
  - CSV parsing and diagnostics audit processor
  - OpenAI/Groq-compatible AI SDK client
- `frontend/`
  - React + Vite Single Page App
  - Multi-Agent selector & Glassmorphic Chat UI
  - Catalog Diagnostics Audit dashboard
  - Recharts live data visualization

## 🧠 About this Platform

This is an MVP version that focuses on making data conversations simple.

- The backend stores dataset state in memory for the current session.
- The frontend sends query text and receives AI-generated answers.
- Bar charts are displayed only when the AI returns structured chart data.

## 🔧 Setup

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with:

```env
GROQ_API_KEY=your_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile
```

Then run:

```bash
npm run dev
```

The backend listens on `http://localhost:3001` by default.

### 2. Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/` with:

```env
VITE_BACKEND_URL=http://localhost:3001/api/
```

If you deploy the backend separately, set this to your backend deployment URL instead, for example:

```env
VITE_BACKEND_URL=https://your-backend-app.vercel.app/api/
```

Then run:

```bash
npm run dev
```

Open the Vite local URL shown in the terminal.

## 🧪 How to use

1. Upload a CSV file from the frontend.
2. Wait for the app to confirm the dataset is loaded.
3. Ask a question in plain language.
4. If the question is chart-friendly, a bar chart will appear.

## 💡 Good prompt guidance

### Best prompts for charts

Use prompts that ask for grouping or comparison, especially when you want a chart.

Examples:

- `Total sales by product category`
- `Revenue by region`
- `Top 5 products by units sold`
- `Average order value by month`
- `Count of transactions by city`

These prompts are good because they:

- mention an aggregate metric (`total`, `average`, `count`)
- include a grouping field (`by category`, `by region`, `by month`)
- ask for structured comparisons

### When the app may not show a bar graph

A bar graph usually will not appear when the prompt is:

- purely descriptive: `Describe the dataset`
- asking for a summary: `What is the dataset about?`
- requesting text-only insights: `What are the key findings?`
- not asking for grouped numeric data: `Tell me about sales`
- asking for something that cannot be plotted from the data

### When the app should show a bar graph

A bar graph is expected when the prompt asks for:

- grouped numeric comparisons: `by ...`
- totals, sums, averages, counts
- rankings or top-N values
- category-based summaries

### Prompt advice for MVP users

- Keep prompts short and specific.
- Use the word `by` for grouping.
- Prefer one metric and one grouping field.
- If you want a chart, say `by` and use `total`, `sum`, `average`, `count`, `max`, or `min`.
- If you want text only, ask for a summary, explanation, or insight.

## 📌 Example prompt patterns

| Prompt type | Example | Expected output |
|---|---|---|
| Chart prompt | `Total revenue by product` | bar chart + answer |
| Comparison prompt | `Units sold by region` | bar chart + answer |
| Summary prompt | `What does this data show?` | text answer only |
| Detail prompt | `What are the top categories?` | likely chart + answer |
| Data insight prompt | `What is the average price?` | text answer only |

## 💬 Project story

Talking Rabbitt is built as a simple conversational analytics MVP. It is designed to help non-technical users ask natural questions about tabular data and receive immediate responses.

The project bridges a few useful ideas:

- data upload and exploration
- natural language AI understanding
- simple chart generation for visual insights
- a clean React UI for conversation

This version is intentionally lightweight, so it can be extended later with:

- multi-user dataset storage
- long-term session history
- more chart types (line, pie, scatter)
- stronger prompt guidance and validation
- dataset previews and column selection

## ✅ Notes for developers

- The backend uses in-memory storage for dataset context.
- The frontend uses Recharts for bar chart rendering.
- Chart rendering is only enabled when valid numeric/chart data is returned.
- The MVP is best suited for CSV datasets with numeric and categorical columns.

## 📂 File overview

- `backend/server.js` — API endpoints, CSV parsing, AI request handling
- `frontend/src/App.jsx` — upload UI, chat flow, chart rendering logic
- `frontend/package.json` — frontend dependencies and scripts
- `backend/package.json` — backend dependencies and scripts


