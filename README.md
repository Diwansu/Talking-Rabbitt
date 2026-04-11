# Talking Rabbitt

A lightweight MVP for conversational data intelligence.

This project lets users upload a CSV dataset, ask natural-language questions about the data, and receive both text answers and chart suggestions powered by an AI backend.

## 🚀 What this project does

- Upload CSV files from the frontend
- Parse the CSV and detect numeric/categorical columns
- Send questions to an AI model via the backend
- Return conversational answers and chart configuration
- Render bar charts when the question is appropriate for visualization

## 📦 Project structure

- `backend/`
  - Express server
  - Multer file upload handling
  - CSV parsing and dataset context storage
  - OpenAI/Groq-compatible AI integration

- `frontend/`
  - React + Vite
  - Conversational UI
  - File upload flow
  - Chart rendering with Recharts

## 🧠 About this MVP

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

## 🚀 Next improvements

- Add a solid data preview step before chat
- Add explicit chart request options in the UI
- Add fallback behavior when the AI response is missing chart data
- Add a deployed production backend and secure key handling

---

If you want, I can also add a short `README` inside `backend/` and `frontend/` with service-specific instructions.