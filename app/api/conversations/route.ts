import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") ?? "";
  const bankerId = searchParams.get("bankerId") ?? "";

  if (!clientId || !bankerId) {
    return NextResponse.json({ error: "clientId and bankerId required" }, { status: 400 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { clientId, bankerId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });
    return NextResponse.json(conversations);
  } catch (err) {
    console.error("❌ GET /api/conversations error:", err);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, bankerId, firmName, accountName, title } = await req.json();

    if (!clientId || !bankerId) {
      return NextResponse.json({ error: "clientId and bankerId required" }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        clientId,
        bankerId,
        firmName: firmName ?? "",
        accountName: accountName ?? "",
        title: title ?? "New Conversation",
      },
    });
    return NextResponse.json(conversation, { status: 201 });
  } catch (err) {
    console.error("❌ POST /api/conversations error:", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
