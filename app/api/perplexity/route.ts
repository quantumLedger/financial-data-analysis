// app/api/perplexity/route.ts
import { NextRequest } from "next/server";
import { PERPLEXITY_API_KEY } from "@/lib/config";
import { retryWithBackoff } from "@/lib/retry";
import { maybeAlertLlmQuota } from "@/lib/llmQuotaAlarm";

// Use Node.js runtime for better API compatibility
export const runtime = "nodejs";
export const maxDuration = 30; // Allow up to 30 seconds for Perplexity API calls

interface PerplexityResponse {
  content: string;
  citations: Array<{ title: string; url: string }>;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          content: "",
          citations: [],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { query } = body;

    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Query cannot be empty",
          content: "",
          citations: [],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.error("PERPLEXITY_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          error: "PERPLEXITY_API_KEY not configured. Please add it to your .env.local file.",
          content: "",
          citations: [],
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call Perplexity API with retry
    console.log("Calling Perplexity API with query:", query.substring(0, 50) + "...");
    
    let response;
    try {
      response = await retryWithBackoff(async () => {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "user",
                content: query,
              },
            ],
            max_tokens: 4096,
            temperature: 0.0,
          }),
        });
        
        // Throw error for retryable status codes
        if (!res.ok) {
          const errorText = await res.text().catch(() => "Unknown error");
          const error: any = new Error(`Perplexity API error: ${res.status} - ${errorText}`);
          error.status = res.status;
          // Surface the raw body to downstream quota detection.
          error.responseText = errorText;

          // Detect quota / billing exhaustion (Perplexity returns 401 with
          // "insufficient_quota" when the account is out of credit). Fire a
          // best-effort ops alert and stop retrying — retrying when the
          // account is empty just spams the provider.
          await maybeAlertLlmQuota({
            provider: "perplexity",
            statusCode: res.status,
            body: errorText,
            requestSummary: query,
          });

          // Don't retry on 401 (auth error)
          if (res.status === 401) {
            throw error;
          }

          // Retry on 429 (rate limit) and 5xx (server errors)
          if (res.status === 429 || res.status >= 500) {
            throw error;
          }

          // For other 4xx errors, throw without retry
          throw error;
        }

        return res;
      }, 3, 1000, 10000);
    } catch (fetchError: any) {
      console.error("Fetch error calling Perplexity API after retries:", fetchError);
      
      // Handle specific error cases
      if (fetchError?.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Rate limit exceeded. Please try again later.",
            content: "",
            citations: [],
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      if (fetchError?.status === 401) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid API key. Please check your PERPLEXITY_API_KEY.",
            content: "",
            citations: [],
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `API error: ${fetchError?.status || 500} ${fetchError?.message || "Unknown error"}`,
          content: "",
          citations: [],
        }),
        { status: fetchError?.status || 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("Error parsing Perplexity API response:", jsonError);
      const responseText = await response.text().catch(() => "Unable to read response");
      console.error("Response text:", responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON response from Perplexity API",
          content: "",
          citations: [],
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract content and citations
    const content =
      data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];
    
    console.log("Perplexity API success. Content length:", content.length, "Citations:", citations.length);

    return new Response(
      JSON.stringify({
        success: true,
        content,
        citations,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Perplexity search error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        content: "",
        citations: [],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

