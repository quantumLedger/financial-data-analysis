# Financial Assistant — Product Overview

**Platform:** weidentify.ai
**Audience:** Investment Bankers, Client-Facing Advisors, Portfolio Analysts
**Powered by:** Claude AI (Anthropic) + finSightAI Research Engine + Perplexity Live Data

---

## What Is This?

The Financial Assistant is an AI-powered chat interface built specifically for investment bankers and wealth advisors. It connects to a banker's client portfolio data, live market intelligence, and institutional research tools — and lets them ask questions, generate charts, write memos, and produce client-ready reports all from a single conversational interface.

Think of it as a junior analyst that already knows your client's portfolio, can pull SEC filings, find deal comps, and write the first draft of a client email — in seconds.

---

## Who Uses It & How

| Role | Primary Use Cases |
|------|-------------------|
| Investment Banker | Pre-meeting briefs, pitch book sections, deal comp research, morning market brief |
| Portfolio Advisor | Portfolio risk analysis, proposed vs. current allocation comparison, client narratives |
| Research Analyst | SEC filing analysis, earnings intelligence, investment memos |
| Client-Facing Teams | Auto-generated client emails, executive summaries, PDF reports for meetings |

---

## Core Features

### 1. Conversational Financial Analysis
- Chat directly with an AI assistant that has full context of the client's portfolio (both current and proposed allocations)
- Ask plain-English questions: *"What's the risk exposure in the proposed portfolio?"* or *"Summarize the Q3 earnings for AAPL"*
- The AI automatically decides which research tools and data sources to call — the banker just types
- Supports multi-turn conversations with full memory of prior messages in the session

### 2. Live Market Data Enrichment
- Toggle **"Include Live Data"** to pull real-time market context into any response
- Powered by Perplexity AI — fetches current news, market commentary, and financial data from the web
- Live data is injected alongside portfolio context so the AI can blend current events with the client's situation
- Use cases: morning prep, responding to market events, ad-hoc client questions

### 3. Portfolio Intelligence (Auto-Loaded)
- On launch, the assistant automatically fetches the client's portfolio data from weidentify.ai using the banker's and client's IDs
- Loads both **MASTER_ORIGINAL** (current holdings) and **MASTER_PROPOSED** (recommended allocation) portfolios
- The AI uses this data as its foundational context for every response — no manual upload needed
- The assistant auto-initializes by analyzing the proposed portfolio the moment data loads

---

## finSightAI Research Tools

These are specialized research capabilities the AI uses automatically when relevant. Bankers don't need to trigger them manually — the AI decides when to call them.

| Tool | What It Does | Example Prompt |
|------|-------------|----------------|
| **Analyze SEC Filing** | Pulls and summarizes 10-K, 10-Q, or 8-K filings for any ticker | *"Summarize Apple's latest 10-K"* |
| **Earnings Flash** | Fetches earnings intelligence and EPS analysis for a ticker | *"How did Microsoft do last quarter?"* |
| **Find Deal Comps** | Finds comparable M&A transactions or public company comps | *"Find deal comps for a SaaS acquisition target"* |
| **Generate Pitch Section** | Auto-drafts sections of a pitch book (overview, financials, thesis, etc.) | *"Write an investment thesis section for this deal"* |
| **Pre-Meeting Brief** | Generates a structured pre-meeting brief for a client meeting | *"Prepare me for my meeting with [client name]"* |
| **Morning Brief** | Fetches today's market summary and key news for the banker's coverage | *"What happened in markets today?"* |
| **Portfolio Risk Analysis** | Runs a full risk analysis on a mapped portfolio (initiates + polls for result) | *"Run a risk analysis on the proposed portfolio"* |

The AI runs up to **4 research rounds** per query — it can chain multiple tools together to build a complete picture before responding.

---

## Output Formats

Every response can produce one or more of the following structured outputs, displayed in the right panel alongside the chat:

### Charts (6 Types)
- **Bar, Multi-Bar, Line, Area, Stacked Area, Pie**
- Rendered interactively using Recharts
- Each chart has a **download as PNG** button (2x resolution, clean background)
- Example: allocation breakdown pie chart, YoY revenue bar chart, portfolio performance line chart

### Data Tables
- Formatted columns supporting: text, number, currency (auto-scales to $M / $B), percentage, badge
- Alternating row styling for readability
- **Export as CSV** button on every table
- Example: deal comps table, sector allocation comparison, earnings summary

### Investment Memos
- Structured formal memo with sections: Executive Summary, Analysis, Key Risks, Recommendation
- Rendered in a clean card layout in the right panel
- **Download as Markdown** button for easy copy into Word/Notion
- Example: investment thesis memo, M&A opportunity memo, portfolio rebalancing recommendation

### Client Narratives
- Plain-language paragraphs ready to paste into a client email or deck slide
- Three tone options: **Formal**, **Conversational**, **Executive**
- **One-click copy to clipboard**
- Example: *"We recommend rebalancing your equity allocation toward..."*

### Follow-Up Suggestions
- After every response, the AI suggests 2–3 natural follow-up questions as clickable buttons
- Keeps the conversation moving without the banker needing to think of what to ask next

---

## Report Generator (PDF Export)

At any point in the conversation, the banker can generate a full **PDF client proposal report** that compiles everything produced so far.

**What goes into the PDF:**
- **Cover page** — report title, client name, firm name, date, content summary
- **Investment Memos section** — all memos generated during the session
- **Client Narratives section** — all narratives, with tone labels
- **Data Tables section** — all formatted tables with headers and footers
- **Chart Data section** — chart titles, descriptions, and underlying data in table form (since PDFs can't render interactive charts)
- **Page footers** — firm name + page numbers on every page

**How to use:** Click the report icon in the top-right of the chat panel → enter a report title → download PDF. Takes ~2 seconds.

---

## Conversation History

- Every conversation is **automatically saved to the database** after each response
- On return visits, the banker sees a **history dropdown** in the chat header with all past conversations
- Each entry shows: conversation title, relative timestamp, message count
- Click any conversation to **restore the full session** — all messages, charts, tables, memos, and narratives reload exactly as they were
- **"+ New" button** starts a fresh conversation without losing history
- Conversations are scoped per banker + client combination

---

## File Upload

Bankers can attach files to any message for the AI to analyze:

| File Type | How It's Used |
|-----------|---------------|
| **PDF** | Extracted as text and included in the AI's context |
| **Images** (JPG, PNG, etc.) | Sent as vision input — the AI can read charts, tables, screenshots |
| **Text files** (.txt, .csv, .md) | Read directly and included in context |

Use cases: upload a competitor's investor presentation, a client's existing portfolio statement, or a screenshot of a Bloomberg terminal.

---

## Additional Controls

| Feature | Description |
|---------|-------------|
| **Model Selector** | Switch between Claude Sonnet (more capable, slower) and Claude Haiku (faster, lighter) per conversation |
| **Export Conversation** | Download the full chat as a Markdown file — useful for records, compliance, or pasting into emails |
| **Resizable Panels** | Drag the divider between chat and visualizations — panel width is remembered across sessions |
| **Stop Generation** | Cancel a response mid-stream with the stop button |
| **Shift+Enter** | Multi-line input in the message box without sending |

---

## What the AI Knows (Context Hierarchy)

When a banker sends a message, the AI has access to:

1. **Client portfolio data** — both current and proposed holdings (auto-loaded from weidentify.ai)
2. **ICF object** — the client-firm mapping including banker ID, client ID, account name, firm name
3. **Live market data** (if toggle is on) — Perplexity web search results for current market context
4. **Full conversation history** — all prior messages in the session
5. **Uploaded files** — any documents or images attached to messages
6. **finSightAI research results** — SEC filings, earnings data, deal comps, etc. fetched in real-time

---

## How a Typical Workflow Looks

**Scenario: Banker preparing for a client meeting**

1. Open the assistant — portfolio data loads automatically
2. The AI auto-initializes and provides an overview of the proposed portfolio
3. Banker asks: *"What are the main risks in this allocation?"*
   - AI calls `get_portfolio_risk` → runs full risk analysis
   - Returns a risk breakdown chart + investment memo
4. Banker asks: *"Find some deal comps for the tech holdings"*
   - AI calls `find_deal_comps` → returns a formatted data table
5. Banker asks: *"Write a summary I can send to the client"*
   - AI calls `generate_client_narrative` → returns a copy-paste ready paragraph
6. Banker clicks **Generate Report** → downloads a PDF with everything above
7. Banker comes back the next day → clicks the history dropdown → picks up exactly where they left off

Total time: ~10 minutes vs. 2–3 hours of manual research.

---

## Technical Summary (For Product/Engineering Reference)

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind, Shadcn UI |
| AI Engine | Anthropic Claude (claude-sonnet-4-5 / claude-haiku-4-5) via streaming SSE |
| Research Tools | finSightAI API (7 endpoints) |
| Live Data | Perplexity API |
| Portfolio Data | weidentify.ai API (`/api/fetch-combined-csvs-by-firm`) |
| Charts | Recharts (6 chart types) |
| PDF Generation | @react-pdf/renderer (client-side) |
| Database | AWS RDS PostgreSQL via Prisma v7 |
| Auth Context | ICF object passed via URL/props (banker ID + client ID + firm) |

---

## What's Not Yet Live (Config Pending)

| Item | Status |
|------|--------|
| Database persistence | Needs real `DATABASE_URL` (RDS endpoint) in env |
| finSightAI research tools | Needs real `FINSIGHT_AI_URL` in env |
| Anthropic API | Key configured ✓ |
| Perplexity API | Key configured ✓ |
| weidentify.ai portfolio API | Hardcoded endpoint, works ✓ |
