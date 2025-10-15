// app/api/finance/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChartData } from "@/types/chart";

// Initialize Anthropic client with correct headers
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const runtime = "edge";

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

export async function POST(req: NextRequest) {
  try {
    const { messages, fileData, model } = await req.json();

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

    console.log("🚀 Final Claude API Request:", {
      endpoint: "messages.create",
      model,
      max_tokens: 4096,
      temperature: 0.7,
      messageCount: anthropicMessages.length,
      tools: tools.map((t) => t.name),
      messageStructure: JSON.stringify(
        anthropicMessages.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content.slice(0, 50) + "..."
              : "[Complex Content]",
        })),
        null,
        2,
      ),
    });

    // Strong Markdown-focused system prompt
    const systemPrompt = `You are a financial data visualization expert. Your role is to analyze financial data and create clear, meaningful visualizations using the generate_graph_data tool.

OUTPUT RULES (VERY IMPORTANT):
- Always answer in **Markdown**.
- Use clear section headings (## Heading), short paragraphs, and bullet lists.
- Prefer **tables** for side-by-side comparisons (allocations, top holdings, period deltas).
- Use callouts/tips (e.g., > **Note:**) for caveats and assumptions.
- Include concise, actionable insights and a brief “What this means” summary.
- When you show code/data, use fenced blocks (e.g., \`\`\`json).
- Do NOT paste the tool’s raw JSON directly; use the tool to create charts and summarize insights in Markdown.

CHARTING GUIDANCE:
- Pick the most appropriate chart type (bar, multiBar, line, pie, area, stackedArea).
- Summaries should reference the chart by name (e.g., “**Top 10 Holdings (Bar)**”).

Here are the chart types available and their ideal use cases:

1. LINE CHARTS ("line")
   - Time series data showing trends
   - Financial metrics over time
   - Market performance tracking

2. BAR CHARTS ("bar")
   - Single metric comparisons
   - Period-over-period analysis
   - Category performance

3. MULTI-BAR CHARTS ("multiBar")
   - Multiple metrics comparison
   - Side-by-side performance analysis
   - Cross-category insights

4. AREA CHARTS ("area")
   - Volume or quantity over time
   - Cumulative trends
   - Market size evolution

5. STACKED AREA CHARTS ("stackedArea")
   - Component breakdowns over time
   - Portfolio composition changes
   - Market share evolution

6. PIE CHARTS ("pie")
   - Distribution analysis
   - Market share breakdown
   - Portfolio allocation

When generating visualizations:
1. Structure data correctly based on the chart type
2. Use descriptive titles and clear descriptions
3. Include trend information when relevant (percentage and direction)
4. Add contextual footer notes
5. Use proper data keys that reflect the actual metrics

Always:
- Generate real, contextually appropriate data
- Use proper financial formatting
- Include relevant trends and insights
- Structure data exactly as needed for the chosen chart type
- Choose the most appropriate visualization for the data
- NEVER SAY you are using the generate_graph_data tool, just execute it when needed.

Focus on clear financial insights and let the visualization enhance understanding.`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      tools: tools,
      tool_choice: { type: "auto" },
      messages: anthropicMessages,
      system: systemPrompt,
    });

    console.log("✅ Claude API Response received:", {
      status: "success",
      stopReason: response.stop_reason,
      hasToolUse: response.content.some((c) => c.type === "tool_use"),
      contentTypes: response.content.map((c) => c.type),
      contentLength:
        response.content[0].type === "text"
          ? (response.content[0] as any).text.length
          : 0,
      toolOutput: response.content.find((c) => c.type === "tool_use")
        ? JSON.stringify(
            response.content.find((c) => c.type === "tool_use"),
            null,
            2,
          )
        : "No tool used",
    });

    const toolUseContent = response.content.find((c) => c.type === "tool_use");
    const textContent = response.content.find((c) => c.type === "text");

    const processToolResponse = (toolUseContent: any) => {
      if (!toolUseContent) return null;

      const chartData = toolUseContent.input as ChartToolResponse;

      if (
        !chartData.chartType ||
        !chartData.data ||
        !Array.isArray(chartData.data)
      ) {
        throw new Error("Invalid chart data structure");
      }

      // Transform data for pie charts to match expected structure
      if (chartData.chartType === "pie") {
        // Ensure data items have 'segment' and 'value' keys
        chartData.data = chartData.data.map((item: any) => {
          // Find the first key in chartConfig (e.g., 'sales')
          const valueKey = Object.keys(chartData.chartConfig)[0];
          const segmentKey = (chartData.config as any).xAxisKey || "segment";

          return {
            segment:
              item[segmentKey] || item.segment || item.category || item.name,
            value: (item as any)[valueKey] ?? (item as any).value,
          };
        });

        // Ensure xAxisKey is set to 'segment' for consistency
        (chartData.config as any).xAxisKey = "segment";
      }

      // Create new chartConfig with system color variables
      const processedChartConfig = Object.entries(chartData.chartConfig).reduce(
        (acc, [key, config], index) => ({
          ...acc,
          [key]: {
            ...(config as Record<string, unknown>),
            // Assign color variables sequentially
            color: `hsl(var(--chart-${index + 1}))`,
          },
        }),
        {} as Record<string, unknown>,
      );

      return {
        ...chartData,
        chartConfig: processedChartConfig as any,
      };
    };

    const processedChartData = toolUseContent
      ? processToolResponse(toolUseContent)
      : null;

    return new Response(
      JSON.stringify({
        content: (textContent as any)?.text || "",
        hasToolUse: response.content.some((c) => c.type === "tool_use"),
        toolUse: toolUseContent,
        chartData: processedChartData,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      },
    );
  } catch (error) {
    console.error("❌ Finance API Error: ", error);
    console.error("Full error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      headers: error instanceof Error ? (error as any).headers : undefined,
      response: error instanceof Error ? (error as any).response : undefined,
    });

    // Add specific error handling for different scenarios
    if (error instanceof Anthropic.APIError) {
      return new Response(
        JSON.stringify({
          error: "API Error",
          details: (error as any).message,
          code: (error as any).status,
        }),
        { status: (error as any).status },
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return new Response(
        JSON.stringify({
          error: "Authentication Error",
          details: "Invalid API key or authentication failed",
        }),
        { status: 401 },
      );
    }

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
