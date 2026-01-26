import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const mappingId = searchParams.get("mappingId");
    const sessionId = searchParams.get("sessionId");
    const limit = searchParams.get("limit") || "100";

    if (!mappingId) {
      return NextResponse.json(
        { error: "mappingId is required" },
        { status: 400 }
      );
    }

    const backendApiUrl = getBackendApiUrl();
    
    const queryParams = new URLSearchParams({
      mappingId,
      limit,
    });
    if (sessionId) {
      queryParams.append("sessionId", sessionId);
    }

    const response = await fetch(`${backendApiUrl}/api/chat/history?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Backend API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Failed to load chat history",
          details: `Backend returned ${response.status}: ${errorText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying chat history request:", error);
    return NextResponse.json(
      {
        error: "Failed to load chat history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
