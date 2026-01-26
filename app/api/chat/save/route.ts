import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.mappingId || !body.firmName || !body.accountName || !body.message) {
      return NextResponse.json(
        { error: "Missing required fields: mappingId, firmName, accountName, message" },
        { status: 400 }
      );
    }

    const backendApiUrl = getBackendApiUrl();
    
    const response = await fetch(`${backendApiUrl}/api/chat/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Backend API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Failed to save message",
          details: `Backend returned ${response.status}: ${errorText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying chat save request:", error);
    return NextResponse.json(
      {
        error: "Failed to save message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
