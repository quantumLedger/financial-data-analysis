// app/api/perplexity/route.ts
import { NextRequest } from "next/server";

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

    const apiKey = process.env.PERPLEXITY_API_KEY;
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

    // Call Perplexity API
    console.log("Calling Perplexity API with query:", query.substring(0, 50) + "...");
    
    let response;
    try {
      response = await fetch("https://api.perplexity.ai/chat/completions", {
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
          max_tokens: 1024,
          temperature: 0.0,
        }),
      });
    } catch (fetchError) {
      console.error("Fetch error calling Perplexity API:", fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Network error: ${fetchError instanceof Error ? fetchError.message : "Unknown fetch error"}`,
          content: "",
          citations: [],
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", errorText);
      
      if (response.status === 429) {
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

      if (response.status === 401) {
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
          error: `API error: ${response.status} ${response.statusText}`,
          content: "",
          citations: [],
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
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

