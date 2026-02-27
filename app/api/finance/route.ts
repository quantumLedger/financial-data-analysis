// app/api/finance/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChartData } from "@/types/chart";
import { retryWithBackoff } from "@/lib/retry";

// Portfolio data fetching function with retry
async function fetchCombinedCSVsByFirm(
  clientId: string,
  investmentBankerId: string,
  firmName: string,
  portfolioType: "MASTER_ORIGINAL" | "MASTER_PROPOSED"
) {
  const API_URL = "https://apis.weidentify.ai";
  
  return retryWithBackoff(async () => {
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append("investment_banker_id", investmentBankerId);
    formData.append("portfolio_type", portfolioType);
    formData.append("firm_name", firmName);
    formData.append("client_id", clientId);
    
    const response = await fetch(
      `${API_URL}/api/fetch-combined-csvs-by-firm`,
      {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - browser/Node will set it with boundary
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      const error: any = new Error(`Failed to fetch portfolio data: ${response.status} - ${errorText}`);
      error.status = response.status;
      throw error;
    }
    
    return await response.json();
  }, 3, 1000, 10000, [429, 500, 502, 503, 504]);
}

// Initialize Anthropic client with correct headers
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const runtime = "nodejs";

// Helper to validate base64
const isValidBase64 = (str: string) => {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
};

// Add Type Definitions
interface ChartToolResponse extends ChartData {
  // Any additional properties specific to the tool response
}

interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const tools: ToolSchema[] = [
  {
    name: "suggest_follow_ups",
    description:
      "Suggest 2-3 short follow-up questions the user might naturally want to ask next, based on the analysis just provided.",
    input_schema: {
      type: "object" as const,
      properties: {
        questions: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "2-3 concise follow-up questions",
        },
      },
      required: ["questions"],
    },
  },
  {
    name: "generate_graph_data",
    description:
      "Generate structured JSON data for creating financial charts and graphs.",
    input_schema: {
      type: "object" as const,
      properties: {
        chartType: {
          type: "string" as const,
          enum: ["bar", "multiBar", "line", "pie", "area", "stackedArea"] as const,
          description: "The type of chart to generate",
        },
        config: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const },
            description: { type: "string" as const },
            trend: {
              type: "object" as const,
              properties: {
                percentage: { type: "number" as const },
                direction: {
                  type: "string" as const,
                  enum: ["up", "down"] as const,
                },
              },
              required: ["percentage", "direction"],
            },
            footer: { type: "string" as const },
            totalLabel: { type: "string" as const },
            xAxisKey: { type: "string" as const },
          },
          required: ["title", "description"],
        },
        data: {
          type: "array" as const,
          items: {
            type: "object" as const,
            additionalProperties: true, // Allow any structure
          },
        },
        chartConfig: {
          type: "object" as const,
          additionalProperties: {
            type: "object" as const,
            properties: {
              label: { type: "string" as const },
              stacked: { type: "boolean" as const },
            },
            required: ["label"],
          },
        },
      },
      required: ["chartType", "config", "data", "chartConfig"],
    },
  },
];

// Module-level chart tool response processor
function processToolResponse(toolUseContent: any) {
  if (!toolUseContent) return null;

  const chartData = toolUseContent.input as ChartToolResponse;

  if (chartData.data && typeof chartData.data === "string") {
    const originalDataString: string = chartData.data as string;
    try {
      let parsed = JSON.parse(originalDataString);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      chartData.data = parsed;
    } catch (parseError) {
      console.error("❌ Error parsing data string:", parseError);
      console.error("Data sample:", originalDataString.substring(0, 200));
      throw new Error("Invalid chart data structure: data is not valid JSON");
    }
  }

  if (!chartData.chartType || !chartData.data || !Array.isArray(chartData.data)) {
    const dataForLogging: any = chartData.data;
    const dataSample =
      typeof dataForLogging === "string"
        ? dataForLogging.substring(0, 100)
        : dataForLogging
        ? JSON.stringify(dataForLogging).substring(0, 100)
        : "null or undefined";
    console.error("Invalid chart data structure:", {
      hasChartType: !!chartData.chartType,
      hasData: !!chartData.data,
      dataType: typeof chartData.data,
      isArray: Array.isArray(chartData.data),
      dataSample,
    });
    throw new Error("Invalid chart data structure");
  }

  if (chartData.chartType === "pie") {
    chartData.data = chartData.data.map((item: any) => {
      const valueKey = Object.keys(chartData.chartConfig)[0] ?? "value";
      const segmentKey = (chartData.config as any).xAxisKey || "segment";
      return {
        segment: item[segmentKey] || item.segment || item.category || item.name,
        value: (item as any)[valueKey] ?? (item as any).value,
      };
    });
    (chartData.config as any).xAxisKey = "segment";
  }

  const processedChartConfig = Object.entries(chartData.chartConfig).reduce(
    (acc, [key, config], index) => ({
      ...acc,
      [key]: {
        ...(config as Record<string, unknown>),
        color: `hsl(var(--chart-${index + 1}))`,
      },
    }),
    {} as Record<string, unknown>,
  );

  return { ...chartData, chartConfig: processedChartConfig as any };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, fileData, model, includeLiveData, icfMapping, portfolioData: clientPortfolioData, conversationId } = await req.json();

    // Extract icfMapping for use in live data fetching
    const icfData = icfMapping || null;

    console.log("🔍 Initial Request Data:", {
      hasMessages: !!messages,
      messageCount: messages?.length,
      hasFileData: !!fileData,
      fileType: fileData?.mediaType,
      model,
    });

    // Input validation
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400 },
      );
    }

    if (!model) {
      return new Response(
        JSON.stringify({ error: "Model selection is required" }),
        { status: 400 },
      );
    }

    // Convert all previous messages
    let anthropicMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Handle file in the latest message
    if (fileData) {
      const { base64, mediaType, isText } = fileData;

      if (!base64) {
        console.error("❌ No base64 data received");
        return new Response(JSON.stringify({ error: "No file data" }), {
          status: 400,
        });
      }

      try {
        if (isText) {
          // Decode base64 text content
          const textContent = decodeURIComponent(escape(atob(base64)));

          // Replace only the last message with the file content
          anthropicMessages[anthropicMessages.length - 1] = {
            role: "user",
            content: [
              {
                type: "text",
                text: `File contents of ${fileData.fileName}:\n\n${textContent}`,
              },
              {
                type: "text",
                text: messages[messages.length - 1].content,
              },
            ],
          };
        } else if (mediaType.startsWith("image/")) {
          // Handle image files
          anthropicMessages[anthropicMessages.length - 1] = {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: messages[messages.length - 1].content,
              },
            ],
          };
        }
      } catch (error) {
        console.error("Error processing file content:", error);
        return new Response(
          JSON.stringify({ error: "Failed to process file content" }),
          { status: 400 },
        );
      }
    }

    // Always extract the user query — extraction is pure string parsing with no side
    // effects. Whether it is actually used (Perplexity) is decided by includeLiveData
    // inside the stream, keeping the flag as the single explicit gate.
    let extractedUserQuery = '';
    if (messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1];
      if (typeof lastUserMessage.content === 'string') {
        extractedUserQuery = lastUserMessage.content;
      } else if (Array.isArray(lastUserMessage.content)) {
        extractedUserQuery = lastUserMessage.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join(' ');
      }
    }
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Stream Claude response to the client via SSE.
    // All data fetching (portfolio, Perplexity) happens inside the stream so we
    // can emit status events while the user is waiting.
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          let stockData: any = null;
          let perplexityData: any = null;

          if (includeLiveData) {
            // STEP 1a: Use portfolio data from client if already fetched; skip re-fetch
            if (clientPortfolioData) {
              stockData = clientPortfolioData;
              console.log("✅ STEP 1a: Using portfolio data from client (no re-fetch)");
            } else if (icfData?.firm_name && icfData?.client_id && icfData?.investment_banker_id) {
              send({ type: "status", message: "Fetching portfolio data..." });
              try {
                stockData = await fetchCombinedCSVsByFirm(
                  String(icfData.client_id),
                  String(icfData.investment_banker_id),
                  icfData.firm_name,
                  "MASTER_PROPOSED"
                );
                console.log("✅ STEP 1a: Stock data fetched successfully");
              } catch (error) {
                console.error("❌ STEP 1a: Error fetching stock data:", error);
              }
            }

            // STEP 1b: Fetch Perplexity live data — explicitly gated by the flag,
            // with query presence as the secondary condition (nothing to search without one)
            if (includeLiveData && extractedUserQuery.trim()) {
              send({ type: "status", message: "Searching live market data..." });
              try {
                const responseData = await retryWithBackoff(async () => {
                  const perplexityResponse = await fetch(`${baseUrl}/api/perplexity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: extractedUserQuery }),
                  });
                  if (!perplexityResponse.ok) {
                    const errorText = await perplexityResponse.text().catch(() => "Unknown error");
                    const error: any = new Error(`Perplexity API call failed: ${perplexityResponse.status} - ${errorText}`);
                    error.status = perplexityResponse.status;
                    throw error;
                  }
                  return await perplexityResponse.json();
                }, 2, 2000, 8000, [429, 500, 502, 503, 504]);

                if (responseData.success && responseData.content) {
                  perplexityData = {
                    content: responseData.content,
                    citations: responseData.citations || [],
                    citationCount: responseData.citations?.length || 0,
                  };
                  console.log(`✅ STEP 1b: Perplexity search completed (${perplexityData.citationCount} citations)`);
                } else {
                  console.warn("⚠️ STEP 1b: Perplexity returned no content:", responseData.error);
                }
              } catch (error) {
                console.error("❌ STEP 1b: Error calling Perplexity API:", error);
              }
            }
          }

          // STEP 2: Rebuild last message with enriched context
          if (includeLiveData && extractedUserQuery && (stockData || perplexityData)) {
            let enhancedPrompt = `Original Query: ${extractedUserQuery}\n\n`;

            if (stockData) {
              const stockDataSummary = typeof stockData === 'object'
                ? JSON.stringify(stockData, null, 2)
                : String(stockData);
              enhancedPrompt += `---\n**STOCK/PORTFOLIO DATA (Current Holdings & Performance for ${icfData?.firm_account_name || 'Account'} at ${icfData?.firm_name || 'Firm'}):**\n${stockDataSummary}\n---\n\n`;
            }

            if (perplexityData?.content) {
              enhancedPrompt += `---\n**LIVE DATA FROM WEB SEARCH (Latest Market Information):**\n${perplexityData.content}\n\n**Sources:** ${perplexityData.citationCount} citation(s) found\n---\n\n`;
            }

            const instructions = [
              ...(stockData ? ['- The current stock/portfolio data provided above'] : []),
              ...(perplexityData ? ['- The latest live market data from web search'] : []),
              ...(stockData && perplexityData ? ['- Combine both sources for comprehensive analysis'] : []),
            ];
            enhancedPrompt += `Please analyze the above query using:\n${instructions.join('\n')}\n\nIncorporate all available information into your analysis and visualizations.`;

            const lastIdx = anthropicMessages.length - 1;
            if (typeof anthropicMessages[lastIdx].content === 'string') {
              anthropicMessages[lastIdx].content = enhancedPrompt;
            } else if (Array.isArray(anthropicMessages[lastIdx].content)) {
              const contentArray = anthropicMessages[lastIdx].content as any[];
              const textElement = contentArray.find((c: any) => c.type === 'text');
              if (textElement) {
                textElement.text = enhancedPrompt;
              } else {
                contentArray.unshift({ type: 'text', text: enhancedPrompt });
              }
            }
          }

          // Dynamic system prompt — adapts based on what live data is available
          const liveDataContext = includeLiveData && (stockData || perplexityData)
            ? `\nDATA CONTEXT:\nYou have been provided with real, live data in the user's message:\n${stockData ? '- **Portfolio/Stock Data**: actual current holdings and performance figures for the client. Treat all numbers as ground truth.' : ''}\n${perplexityData ? '- **Live Web Search Data**: latest market information retrieved in real time from the web. Use it to support your analysis with current context.' : ''}\n${stockData && perplexityData ? '- Cross-reference both sources where relevant to produce a comprehensive, accurate analysis.' : ''}\nDo NOT fabricate or estimate figures — use only the data provided.\n`
            : '';

          const systemPrompt = `You are a financial data visualization expert. Your role is to analyze financial data and create clear, meaningful visualizations using the generate_graph_data tool.
${liveDataContext}
OUTPUT RULES:
- Always answer in **Markdown**.
- Use clear section headings (## Heading), short paragraphs, and bullet lists.
- Prefer **tables** for side-by-side comparisons (allocations, top holdings, period deltas).
- Use callouts/tips (e.g., > **Note:**) for caveats and assumptions.
- Include concise, actionable insights and a brief "What this means" summary.
- When you show code/data, use fenced blocks (e.g., \`\`\`json).
- Do NOT paste the tool's raw JSON directly; use the tool to create charts and summarize insights in Markdown.

CHARTING GUIDANCE:
- Only use generate_graph_data when a chart meaningfully adds value over a table or text description.
- Pick the most appropriate chart type: bar (single metric comparisons), multiBar (side-by-side metrics), line (time series trends), area (volume/cumulative over time), stackedArea (composition changes over time), pie (distribution/allocation).
- Reference charts by name in your summary (e.g., "**Top 10 Holdings (Bar)**").

Always:
- Use proper financial formatting for numbers and percentages.
- Structure chart data exactly as required by the chosen chart type.
- NEVER say you are using the generate_graph_data tool — just execute it silently when needed.
- ALWAYS call suggest_follow_ups once per response with 2-3 short questions the user might ask next. Never mention this tool.

Focus on clear financial insights and let the visualization enhance understanding.`;

          // STEP 3: Stream Claude response
          send({ type: "status", message: "Analyzing..." });

          const claudeStream = anthropic.messages.stream({
            model,
            max_tokens: 8096,
            temperature: 0.2,
            tools,
            tool_choice: { type: "auto" },
            messages: anthropicMessages,
            system: systemPrompt,
          });

          // Forward text tokens to the client as they arrive
          claudeStream.on("text", (text: string) => {
            send({ type: "text", text });
          });

          // Wait for full completion to get tool use blocks
          const finalMessage = await claudeStream.finalMessage();

          console.log("✅ Claude stream complete:", {
            stopReason: finalMessage.stop_reason,
            hasToolUse: finalMessage.content.some((c) => c.type === "tool_use"),
            contentTypes: finalMessage.content.map((c) => c.type),
          });

          const allToolUseBlocks = finalMessage.content.filter(
            (c) => c.type === "tool_use",
          );

          // Process every generate_graph_data call — not just the first
          const processedCharts: any[] = [];
          for (const block of allToolUseBlocks) {
            if ((block as any).name !== "generate_graph_data") continue;
            try {
              const chart = processToolResponse(block);
              if (chart) processedCharts.push(chart);
            } catch (error) {
              console.error("❌ Error processing chart tool response:", error);
            }
          }

          // Extract follow-up questions
          const followUpsBlock = allToolUseBlocks.find(
            (c: any) => c.name === "suggest_follow_ups",
          ) as any | undefined;
          const followUps: string[] = followUpsBlock?.input?.questions ?? [];

          send({
            type: "chart",
            charts: processedCharts,
            followUps,
            hasToolUse: allToolUseBlocks.length > 0,
          });
          send({ type: "done" });

          // Fire-and-forget DB persistence — never blocks the stream
          if (conversationId) {
            const lastMsg = messages[messages.length - 1];
            const userContent = typeof lastMsg?.content === "string"
              ? lastMsg.content
              : Array.isArray(lastMsg?.content)
              ? lastMsg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("")
              : "";

            const assistantContent = finalMessage.content
              .filter((c) => c.type === "text")
              .map((c: any) => c.text)
              .join("");

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
                      chartData: processedCharts.length > 0 ? processedCharts : undefined,
                      hasToolUse: allToolUseBlocks.length > 0,
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
          console.error("❌ Claude stream error:", error);
          send({
            type: "error",
            error: error.message || "Streaming error occurred",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("❌ Finance API Error: ", error);
    console.error("Full error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      headers: error instanceof Error ? (error as any).headers : undefined,
      response: error instanceof Error ? (error as any).response : undefined,
    });

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`),
        );
        controller.close();
      },
    });
    return new Response(errorStream, {
      status: 200, // Keep 200 so the client reads the stream body
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }
}
