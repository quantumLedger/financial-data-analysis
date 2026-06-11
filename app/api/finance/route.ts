// app/api/finance/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChartData, TableData, MemoData, NarrativeData } from "@/types/chart";
import { retryWithBackoff } from "@/lib/retry";
import { maybeAlertLlmQuotaForError } from "@/lib/llmQuotaAlarm";
import { internalApiKeyHeader } from "@/lib/internalApiKey";
import { resolveAssistantDisplayContent } from "@/lib/assistantMessage";

// ─── Portfolio data fetch ────────────────────────────────────────────────────

async function fetchCombinedCSVsByFirm(
  clientId: string,
  investmentBankerId: string,
  firmName: string,
  portfolioType: "MASTER_ORIGINAL" | "MASTER_PROPOSED"
) {
  const API_URL = "https://apis.weidentify.ai";
  return retryWithBackoff(async () => {
    const formData = new FormData();
    formData.append("investment_banker_id", investmentBankerId);
    formData.append("portfolio_type", portfolioType);
    formData.append("firm_name", firmName);
    formData.append("client_id", clientId);
    // X-Internal-Key authenticates this BFF \u2192 fin-sight-engine call without
    // a per-user Cognito token. Server-side only; never exposed to the browser.
    const response = await fetch(`${API_URL}/api/fetch-combined-csvs-by-firm`, {
      method: "POST",
      headers: { ...internalApiKeyHeader() },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      const error: any = new Error(`Failed to fetch portfolio data: ${response.status} - ${errorText}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  }, 3, 1000, 10000, [429, 500, 502, 503, 504]);
}

// ─── Anthropic client ────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const runtime = "nodejs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isValidBase64 = (str: string) => {
  try { return btoa(atob(str)) === str; } catch { return false; }
};

// ─── finSightAI tool registry ────────────────────────────────────────────────

const FINSIGHT_TOOL_NAMES = new Set([
  "analyze_sec_filing",
  "get_earnings_flash",
  "find_deal_comps",
  "generate_pitch_section",
  "generate_pre_meeting_brief",
  "get_morning_brief",
  "get_portfolio_risk",
]);

function getFinsightStatusMessage(toolName: string, input: any): string {
  switch (toolName) {
    case "analyze_sec_filing":
      return `Fetching ${input.filing_type ?? "10-K"} filing for ${input.ticker}`;
    case "get_earnings_flash":
      return `Pulling earnings data for ${input.ticker}`;
    case "find_deal_comps":
      return `Finding comparable companies for ${input.ticker}`;
    case "generate_pitch_section":
      return `Drafting ${input.section_type} section`;
    case "generate_pre_meeting_brief":
      return `Generating pre-meeting brief for ${input.client_name}`;
    case "get_morning_brief":
      return "Fetching the morning market brief for today";
    case "get_portfolio_risk":
      return "Running portfolio risk analysis";
    default:
      return "Fetching data";
  }
}

async function callFinsightAPI(toolName: string, input: any, userId: number): Promise<any> {
  const BASE = process.env.FINSIGHT_AI_URL;
  if (!BASE) throw new Error("FINSIGHT_AI_URL not configured");

  // Shared header: JSON content-type + X-Internal-Key (when configured).
  // Header is empty until INTERNAL_API_KEY is set on both ends, so the
  // rollout is non-breaking.
  const jsonHeaders = { "Content-Type": "application/json", ...internalApiKeyHeader() };
  const getHeaders = { ...internalApiKeyHeader() };

  switch (toolName) {
    case "analyze_sec_filing": {
      const res = await fetch(`${BASE}/api/sec-filing/analyze`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: userId, ticker: input.ticker, filing_type: input.filing_type ?? "10-K" }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error(`SEC filing API ${res.status}`);
      return (await res.json()).data;
    }

    case "get_earnings_flash": {
      const res = await fetch(`${BASE}/api/earnings-intelligence/analyze`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: userId, ticker: input.ticker }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Earnings API ${res.status}`);
      return (await res.json()).data;
    }

    case "find_deal_comps": {
      const res = await fetch(`${BASE}/api/deal-comps/search`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: userId, target_ticker: input.ticker, search_name: input.search_name }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error(`Deal comps API ${res.status}`);
      return (await res.json()).data;
    }

    case "generate_pitch_section": {
      const res = await fetch(`${BASE}/api/pitch-book/generate`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          user_id: userId,
          section_type: input.section_type,
          company_name: input.company_name,
          deal_type: input.deal_type ?? "General",
          inputs: input.inputs ?? {},
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Pitch book API ${res.status}`);
      return (await res.json()).data;
    }

    case "generate_pre_meeting_brief": {
      const res = await fetch(`${BASE}/api/pre-meeting-brief/generate`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: userId, ...input }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Pre-meeting brief API ${res.status}`);
      return (await res.json()).data;
    }

    case "get_morning_brief": {
      const res = await fetch(`${BASE}/api/morning-brief?user_id=${userId}`, {
        headers: getHeaders,
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`Morning brief API ${res.status}`);
      return (await res.json()).data;
    }

    case "get_portfolio_risk": {
      // Step 1: initiate
      const initRes = await fetch(`${BASE}/portfolio-analysis/initiate`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ mapping_id: input.mapping_id }),
        signal: AbortSignal.timeout(15000),
      });
      if (!initRes.ok) throw new Error(`Portfolio analysis initiate ${initRes.status}`);

      // Step 2: poll until complete (max 55s)
      const deadline = Date.now() + 55000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`${BASE}/portfolio-analysis/${input.mapping_id}/status`, {
          headers: getHeaders,
          signal: AbortSignal.timeout(10000),
        });
        if (!statusRes.ok) continue;
        const body = await statusRes.json();
        if (body.status === "completed") return body.results;
        if (body.status === "failed") throw new Error("Portfolio analysis failed on finSightAI");
      }
      throw new Error("Portfolio analysis timed out after 55s");
    }

    default:
      throw new Error(`Unknown finSightAI tool: ${toolName}`);
  }
}

// ─── Output tool processors ──────────────────────────────────────────────────

interface ChartToolResponse extends ChartData {}

function processChartBlock(block: any): ChartData | null {
  if (!block) return null;
  const chartData = block.input as ChartToolResponse;

  if (chartData.data && typeof chartData.data === "string") {
    try {
      let parsed = JSON.parse(chartData.data as unknown as string);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      chartData.data = parsed;
    } catch {
      throw new Error("Invalid chart data: data is not valid JSON");
    }
  }

  if (!chartData.chartType || !chartData.data || !Array.isArray(chartData.data)) {
    throw new Error("Invalid chart data structure");
  }

  if (chartData.chartType === "pie") {
    chartData.data = chartData.data.map((item: any) => {
      const valueKey = Object.keys(chartData.chartConfig)[0] ?? "value";
      const segmentKey = (chartData.config as any).xAxisKey || "segment";
      return {
        segment: item[segmentKey] || item.segment || item.category || item.name,
        value: item[valueKey] ?? item.value,
      };
    });
    (chartData.config as any).xAxisKey = "segment";
  }

  const processedChartConfig = Object.entries(chartData.chartConfig).reduce(
    (acc, [key, config], index) => ({
      ...acc,
      [key]: { ...(config as Record<string, unknown>), color: `hsl(var(--chart-${index + 1}))` },
    }),
    {} as Record<string, unknown>
  );

  return { ...chartData, chartConfig: processedChartConfig as any };
}

function processTableBlock(block: any): TableData | null {
  const input = block.input;
  if (!input?.title || !input?.columns || !input?.rows) return null;
  return {
    title: input.title,
    description: input.description,
    columns: input.columns,
    rows: input.rows,
    footer: input.footer,
  };
}

function processMemoBlock(block: any): MemoData | null {
  const input = block.input;
  if (!input?.title || !input?.executive_summary) return null;
  return {
    title: input.title,
    company: input.company,
    date: input.date,
    executive_summary: input.executive_summary,
    analysis: input.analysis ?? "",
    risks: Array.isArray(input.risks) ? input.risks : [],
    recommendation: input.recommendation ?? "",
  };
}

function processNarrativeBlock(block: any): NarrativeData | null {
  const input = block.input;
  if (!input?.narrative) return null;
  return { narrative: input.narrative, tone: input.tone ?? "formal" };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

interface ToolSchema {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] };
}

const tools: ToolSchema[] = [
  // ── Suggest follow-ups (output) ──────────────────────────────────────────
  {
    name: "suggest_follow_ups",
    description: "Suggest 2-3 short follow-up questions the user might naturally want to ask next.",
    input_schema: {
      type: "object",
      properties: {
        questions: { type: "array", items: { type: "string" }, description: "2-3 concise follow-up questions" },
      },
      required: ["questions"],
    },
  },

  // ── Chart (output) ────────────────────────────────────────────────────────
  {
    name: "generate_graph_data",
    description: "Generate structured JSON data for creating financial charts and graphs.",
    input_schema: {
      type: "object",
      properties: {
        chartType: { type: "string", enum: ["bar", "multiBar", "line", "pie", "area", "stackedArea"] },
        config: {
          type: "object",
          properties: {
            title: { type: "string" }, description: { type: "string" },
            trend: { type: "object", properties: { percentage: { type: "number" }, direction: { type: "string", enum: ["up", "down"] } }, required: ["percentage", "direction"] },
            footer: { type: "string" }, totalLabel: { type: "string" }, xAxisKey: { type: "string" },
          },
          required: ["title", "description"],
        },
        data: { type: "array", items: { type: "object", additionalProperties: true } },
        chartConfig: { type: "object", additionalProperties: { type: "object", properties: { label: { type: "string" }, stacked: { type: "boolean" } }, required: ["label"] } },
      },
      required: ["chartType", "config", "data", "chartConfig"],
    },
  },

  // ── Data table (output) ───────────────────────────────────────────────────
  {
    name: "generate_data_table",
    description: "Generate a structured financial data table with formatted columns. Use when tabular comparison is clearer than a chart.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: ["text", "number", "percent", "currency", "badge"] },
              align: { type: "string", enum: ["left", "right", "center"] },
            },
            required: ["key", "label", "type"],
          },
        },
        rows: { type: "array", items: { type: "object", additionalProperties: true } },
        footer: { type: "string" },
      },
      required: ["title", "columns", "rows"],
    },
  },

  // ── Investment memo (output) ──────────────────────────────────────────────
  {
    name: "generate_investment_memo",
    description: "Structure findings into a formal IB investment memo: Executive Summary, Analysis, Risks, Recommendation. Call this when the user asks for a memo, report, or formal write-up.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        date: { type: "string" },
        executive_summary: { type: "string", description: "2-3 sentence executive summary" },
        analysis: { type: "string", description: "Detailed analysis in markdown" },
        risks: { type: "array", items: { type: "string" }, description: "Key risk factors (3-5 bullets)" },
        recommendation: { type: "string", description: "Clear recommendation with rationale" },
      },
      required: ["title", "executive_summary", "analysis", "risks", "recommendation"],
    },
  },

  // ── Client narrative (output) ─────────────────────────────────────────────
  {
    name: "generate_client_narrative",
    description: "Generate a plain-language paragraph ready to copy-paste into a client email or deck slide. No jargon. Call this when the user asks for something to send to a client.",
    input_schema: {
      type: "object",
      properties: {
        narrative: { type: "string", description: "Complete plain-language narrative, copy-paste ready" },
        tone: { type: "string", enum: ["formal", "conversational", "executive"] },
      },
      required: ["narrative"],
    },
  },

  // ── finSightAI research tools ─────────────────────────────────────────────
  {
    name: "analyze_sec_filing",
    description: "Fetch and AI-analyze the latest SEC filing (10-K, 10-Q, 8-K) for any US public company. Use when asked about financials, risks, or regulatory filings.",
    input_schema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "US stock ticker e.g. AAPL, MSFT" },
        filing_type: { type: "string", enum: ["10-K", "10-Q", "8-K"] },
      },
      required: ["ticker", "filing_type"],
    },
  },
  {
    name: "get_earnings_flash",
    description: "Get an AI earnings flash note — EPS actual vs estimate, revenue, beat/miss verdict, management tone, margins, and forward guidance.",
    input_schema: {
      type: "object",
      properties: { ticker: { type: "string" } },
      required: ["ticker"],
    },
  },
  {
    name: "find_deal_comps",
    description: "Find public comparable companies for a target ticker. Returns EV/EBITDA, P/E, EV/Revenue, gross margin, and revenue growth for up to 10 peers.",
    input_schema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Target company ticker" },
        search_name: { type: "string", description: "Optional label for this search" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "generate_pitch_section",
    description: "Generate an IB-grade pitch book section in markdown. Valid sections: Executive Summary, Investment Thesis, Company Overview, Market Analysis, Financial Overview, Transaction Overview, Risk Factors.",
    input_schema: {
      type: "object",
      properties: {
        section_type: { type: "string" },
        company_name: { type: "string" },
        deal_type: { type: "string", enum: ["M&A", "IPO", "Secondary", "Debt", "Restructuring", "General"] },
        inputs: { type: "object", additionalProperties: { type: "string" } },
      },
      required: ["section_type", "company_name", "deal_type", "inputs"],
    },
  },
  {
    name: "generate_pre_meeting_brief",
    description: "Generate a meeting prep document with talking points, agenda, and live ticker moves for client holdings.",
    input_schema: {
      type: "object",
      properties: {
        client_name: { type: "string" },
        meeting_type: { type: "string" },
        meeting_date: { type: "string", description: "YYYY-MM-DD" },
        context_notes: { type: "string" },
        portfolio_snapshot: { type: "string" },
        recent_interactions: { type: "string" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_morning_brief",
    description: "Get today's pre-generated morning market brief — index snapshot, watchlist movers, earnings today, top news, AI narrative.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_portfolio_risk",
    description: "Run quantitative portfolio risk analysis — VaR, Sharpe ratio, volatility, benchmark comparison, rebalancing suggestions.",
    input_schema: {
      type: "object",
      properties: { mapping_id: { type: "string", description: "Portfolio mapping ID from ICF" } },
      required: ["mapping_id"],
    },
  },
];

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      messages, fileData, model, includeLiveData,
      icfMapping, portfolioData: clientPortfolioData, conversationId,
    } = await req.json();

    const icfData = icfMapping || null;
    const finsightUserId = parseInt(String(icfData?.investment_banker_id ?? process.env.FINSIGHT_DEFAULT_USER_ID ?? "1"), 10) || 1;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: "Model selection is required" }), { status: 400 });
    }

    // Build Anthropic messages
    let anthropicMessages = messages.map((msg: any) => ({ role: msg.role, content: msg.content }));

    // Inject file into last message
    if (fileData) {
      const { base64, mediaType, isText } = fileData;
      if (!base64) return new Response(JSON.stringify({ error: "No file data" }), { status: 400 });

      try {
        if (isText) {
          const textContent = decodeURIComponent(escape(atob(base64)));
          anthropicMessages[anthropicMessages.length - 1] = {
            role: "user",
            content: [
              { type: "text", text: `File contents of ${fileData.fileName}:\n\n${textContent}` },
              { type: "text", text: messages[messages.length - 1].content },
            ],
          };
        } else if (mediaType.startsWith("image/")) {
          anthropicMessages[anthropicMessages.length - 1] = {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: messages[messages.length - 1].content },
            ],
          };
        }
      } catch {
        return new Response(JSON.stringify({ error: "Failed to process file content" }), { status: 400 });
      }
    }

    // Extract user query for Perplexity
    let extractedUserQuery = "";
    const lastMsg = messages[messages.length - 1];
    if (typeof lastMsg?.content === "string") {
      extractedUserQuery = lastMsg.content;
    } else if (Array.isArray(lastMsg?.content)) {
      extractedUserQuery = lastMsg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ");
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // ── SSE Stream ──────────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // ── Step 1: Live data (portfolio + Perplexity) ─────────────────
          let stockData: any = null;
          let perplexityData: any = null;

          if (includeLiveData) {
            if (clientPortfolioData) {
              stockData = clientPortfolioData;
            } else if (icfData?.firm_name && icfData?.client_id && icfData?.investment_banker_id) {
              send({ type: "status", message: "Fetching portfolio data" });
              try {
                stockData = await fetchCombinedCSVsByFirm(
                  String(icfData.client_id), String(icfData.investment_banker_id),
                  icfData.firm_name, "MASTER_PROPOSED"
                );
              } catch (e) { console.error("❌ Portfolio fetch error:", e); }
            }

            if (extractedUserQuery.trim()) {
              send({ type: "status", message: "Searching live market data" });
              try {
                const pd = await retryWithBackoff(async () => {
                  const r = await fetch(`${baseUrl}/api/perplexity`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: extractedUserQuery }),
                  });
                  if (!r.ok) { const e: any = new Error(`Perplexity ${r.status}`); e.status = r.status; throw e; }
                  return r.json();
                }, 2, 2000, 8000, [429, 500, 502, 503, 504]);

                if (pd.success && pd.content) {
                  perplexityData = { content: pd.content, citations: pd.citations || [], citationCount: pd.citations?.length || 0 };
                }
              } catch (e) { console.error("❌ Perplexity error:", e); }
            }
          }

          // ── Step 2: Enrich last message ────────────────────────────────
          if (includeLiveData && extractedUserQuery && (stockData || perplexityData)) {
            let enhanced = `Original Query: ${extractedUserQuery}\n\n`;
            if (stockData) {
              enhanced += `**PORTFOLIO DATA (${icfData?.firm_account_name || "Account"} at ${icfData?.firm_name || "Firm"}):**\n${JSON.stringify(stockData, null, 2)}\n\n`;
            }
            if (perplexityData?.content) {
              enhanced += `**LIVE MARKET DATA:**\n${perplexityData.content}\n\n**Sources:** ${perplexityData.citationCount} citation(s)\n\n`;
            }
            const instructions = [
              ...(stockData ? ["- The current portfolio data provided above"] : []),
              ...(perplexityData ? ["- The latest live market data from web search"] : []),
            ];
            enhanced += `Please analyze using:\n${instructions.join("\n")}\n\nIncorporate all available information.`;

            const lastIdx = anthropicMessages.length - 1;
            if (typeof anthropicMessages[lastIdx].content === "string") {
              anthropicMessages[lastIdx].content = enhanced;
            } else if (Array.isArray(anthropicMessages[lastIdx].content)) {
              const arr = anthropicMessages[lastIdx].content as any[];
              const t = arr.find((c: any) => c.type === "text");
              if (t) t.text = enhanced; else arr.unshift({ type: "text", text: enhanced });
            }
          }

          // ── Step 3: System prompt ──────────────────────────────────────
          const liveCtx = includeLiveData && (stockData || perplexityData)
            ? `\nDATA CONTEXT:\nYou have real live data in the user's message:\n${stockData ? "- Portfolio/Stock Data: actual current holdings." : ""}\n${perplexityData ? "- Live Web Search Data: latest market information." : ""}\nDo NOT fabricate figures. Use only the data provided.\n`
            : "";

          const systemPrompt = `You are a senior financial analyst and investment banking research assistant. You help bankers research companies, analyze portfolios, and generate professional client deliverables.
${liveCtx}
RESEARCH CAPABILITIES. Call these tools silently when relevant:
- analyze_sec_filing: for company financials, risks, or regulatory questions
- get_earnings_flash: for earnings performance, beat/miss, guidance
- find_deal_comps: for comparable company multiples and peer benchmarking
- generate_pitch_section: for IB pitch book sections
- generate_pre_meeting_brief: for client meeting preparation
- get_morning_brief: for today's market context
- get_portfolio_risk: for quantitative risk metrics on a portfolio

OUTPUT TOOLS. Call these to produce structured deliverables:
- generate_graph_data: when a chart adds value over text (bar, line, pie, area, multiBar, stackedArea)
- generate_data_table: when tabular comparison is clearer than a chart (comps tables, allocations, metrics)
- generate_investment_memo: when the user asks for a memo, report, or formal write-up
- generate_client_narrative: when the user wants something to send to a client (email-ready paragraph)
- suggest_follow_ups: ALWAYS call once per response with 2-3 follow-up questions. Never mention this.

OUTPUT FORMAT:
- Always respond in Markdown with clear section headings, bullet lists, and tables where useful
- Reference charts/tables by title in your analysis
- Use proper financial formatting (numbers, percentages)
- NEVER say you are using any tool. Execute silently
- For memos and narratives, still provide a brief markdown summary in the text response

Focus on clear, actionable financial insights.`;

          // ── Step 4: Multi-round agentic loop ───────────────────────────
          send({ type: "status", message: "Analyzing request" });

          let currentMessages: any[] = anthropicMessages;
          let finalMessage: any = null;
          let roundCount = 0;
          const MAX_ROUNDS = 4;

          while (roundCount < MAX_ROUNDS) {
            roundCount++;

            const claudeStream = anthropic.messages.stream({
              model,
              max_tokens: 8096,
              temperature: 0.2,
              tools: tools as any,
              tool_choice: { type: "auto" },
              messages: currentMessages as any,
              system: systemPrompt,
            });

            claudeStream.on("text", (text: string) => send({ type: "text", text }));
            let message: any;
            try {
              message = await claudeStream.finalMessage();
            } catch (err) {
              // Detect Anthropic quota / billing exhaustion ("credit balance is
              // too low", HTTP 400 / 402 / 403). Fire a best-effort ops alert
              // before re-throwing so the surrounding error handler still runs.
              await maybeAlertLlmQuotaForError({
                provider: "anthropic",
                error: err,
                requestSummary: typeof currentMessages?.[0]?.content === "string"
                  ? (currentMessages[0].content as string).slice(0, 200)
                  : undefined,
              });
              throw err;
            }

            const toolBlocks = message.content.filter((c: any) => c.type === "tool_use") as any[];
            const hasFinsightCalls = toolBlocks.some((b: any) => FINSIGHT_TOOL_NAMES.has(b.name));

            // If no finSightAI calls needed — this is the final round
            if (message.stop_reason !== "tool_use" || !hasFinsightCalls) {
              finalMessage = message;
              break;
            }

            // Execute all tool calls (finSightAI in parallel)
            send({ type: "status", message: getFinsightStatusMessage(toolBlocks.find((b) => FINSIGHT_TOOL_NAMES.has(b.name))?.name ?? "", toolBlocks[0]?.input ?? {}) });

            const toolResults = await Promise.all(
              toolBlocks.map(async (block: any) => {
                if (!FINSIGHT_TOOL_NAMES.has(block.name)) {
                  // Output tool called mid-loop — return placeholder so Claude continues
                  return { type: "tool_result", tool_use_id: block.id, content: "{}" };
                }
                try {
                  const result = await callFinsightAPI(block.name, block.input, finsightUserId);
                  return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
                } catch (err: any) {
                  console.error(`❌ finSightAI tool ${block.name} error:`, err.message);
                  return {
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: JSON.stringify({ error: err.message || "Tool call failed" }),
                    is_error: true,
                  };
                }
              })
            );

            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: message.content },
              { role: "user", content: toolResults },
            ] as any;
          }

          if (!finalMessage) {
            throw new Error("Agent loop exceeded max rounds without producing a final response");
          }

          console.log("✅ Claude complete:", {
            rounds: roundCount,
            stopReason: finalMessage.stop_reason,
            contentTypes: (finalMessage.content as any[]).map((c: any) => c.type),
          });

          // ── Step 5: Process output tool blocks ─────────────────────────
          const allOutputBlocks = (finalMessage.content as any[]).filter((c: any) => c.type === "tool_use") as any[];

          const processedCharts: ChartData[] = [];
          const processedTables: TableData[] = [];
          const processedMemos: MemoData[] = [];
          const processedNarratives: NarrativeData[] = [];

          for (const block of allOutputBlocks) {
            try {
              if (block.name === "generate_graph_data") {
                const chart = processChartBlock(block);
                if (chart) processedCharts.push(chart);
              } else if (block.name === "generate_data_table") {
                const table = processTableBlock(block);
                if (table) processedTables.push(table);
              } else if (block.name === "generate_investment_memo") {
                const memo = processMemoBlock(block);
                if (memo) processedMemos.push(memo);
              } else if (block.name === "generate_client_narrative") {
                const narrative = processNarrativeBlock(block);
                if (narrative) processedNarratives.push(narrative);
              }
            } catch (err) {
              console.error(`❌ Output tool processing error (${block.name}):`, err);
            }
          }

          const followUpsBlock = allOutputBlocks.find((b) => b.name === "suggest_follow_ups");
          const followUps: string[] = followUpsBlock?.input?.questions ?? [];

          send({
            type: "chart",
            charts: processedCharts,
            tables: processedTables,
            memos: processedMemos,
            narratives: processedNarratives,
            followUps,
            hasToolUse: allOutputBlocks.length > 0,
          });
          send({ type: "done" });

          // ── Step 6: Fire-and-forget DB persistence ─────────────────────
          if (conversationId) {
            const userContent = typeof lastMsg?.content === "string"
              ? lastMsg.content
              : Array.isArray(lastMsg?.content)
              ? lastMsg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("")
              : "";

            const assistantRawText = (finalMessage.content as any[])
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("");

            const assistantContent =
              resolveAssistantDisplayContent(assistantRawText, {
                charts: processedCharts,
                tables: processedTables,
                memos: processedMemos,
                narratives: processedNarratives,
              }) || assistantRawText;

            const fileMetadata = fileData
              ? { fileName: fileData.fileName, mediaType: fileData.mediaType, isText: fileData.isText ?? false }
              : null;

            import("@/lib/prisma")
              .then(({ prisma }) =>
                prisma.$transaction([
                  prisma.message.create({
                    data: {
                      conversationId,
                      role: "user",
                      content: userContent,
                      fileMetadata: fileMetadata ?? undefined,
                    },
                  }),
                  prisma.message.create({
                    data: {
                      conversationId,
                      role: "assistant",
                      content: assistantContent,
                      chartData: processedCharts.length > 0 ? (processedCharts as any) : undefined,
                      tableData: processedTables.length > 0 ? (processedTables as any) : undefined,
                      memoData: processedMemos.length > 0 ? (processedMemos as any) : undefined,
                      narrativeData: processedNarratives.length > 0 ? (processedNarratives as any) : undefined,
                      hasToolUse: allOutputBlocks.length > 0,
                    },
                  }),
                  prisma.conversation.update({
                    where: { id: conversationId },
                    data: { updatedAt: new Date() },
                  }),
                ])
              )
              .catch((err) => console.error("❌ DB persist error:", err));
          }
        } catch (error: any) {
          console.error("❌ Stream error:", error);
          send({ type: "error", error: error.message || "Streaming error occurred" });
        } finally {
          controller.close();
        }
        },
      });

    return new Response(sseStream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (error) {
    console.error("❌ Finance API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`));
        controller.close();
      },
    });
    return new Response(errorStream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }
}
