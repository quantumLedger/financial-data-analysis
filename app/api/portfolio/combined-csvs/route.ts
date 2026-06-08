// app/api/portfolio/combined-csvs/route.ts
//
// Thin BFF proxy that fetches combined portfolio CSVs from fin-sight-engine
// (apis.weidentify.ai). Browser callers MUST NOT hit apis.weidentify.ai
// directly: the upstream now requires an X-Internal-Key shared secret, which
// must stay server-side. This route keeps the secret on the server and
// exposes a same-origin endpoint the client can call without any auth burden
// of its own.

import { NextRequest } from "next/server";
import { WEIDENTIFY_API_URL } from "@/lib/config";
import { internalApiKeyHeader } from "@/lib/internalApiKey";
import { retryWithBackoff } from "@/lib/retry";

export const runtime = "nodejs";

// Tight allowlist mirrors the upstream PortfolioTypeEnum. Anything else is a
// caller bug or someone trying to abuse the proxy.
const ALLOWED_PORTFOLIO_TYPES = new Set([
  "MASTER_ORIGINAL",
  "MASTER_PROPOSED",
]);

export async function POST(req: NextRequest) {
  try {
    const inbound = await req.formData();

    const investmentBankerId = String(inbound.get("investment_banker_id") ?? "");
    const clientId = String(inbound.get("client_id") ?? "");
    const firmName = String(inbound.get("firm_name") ?? "");
    const portfolioType = String(inbound.get("portfolio_type") ?? "");

    if (!investmentBankerId || !clientId || !firmName || !portfolioType) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: investment_banker_id, client_id, firm_name, portfolio_type",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!ALLOWED_PORTFOLIO_TYPES.has(portfolioType)) {
      return new Response(
        JSON.stringify({ error: "Invalid portfolio_type" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.append("investment_banker_id", investmentBankerId);
    upstreamForm.append("client_id", clientId);
    upstreamForm.append("firm_name", firmName);
    upstreamForm.append("portfolio_type", portfolioType);

    const upstreamUrl = `${WEIDENTIFY_API_URL}/api/fetch-combined-csvs-by-firm`;

    const data = await retryWithBackoff(
      async () => {
        const res = await fetch(upstreamUrl, {
          method: "POST",
          headers: { ...internalApiKeyHeader() },
          body: upstreamForm,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const err: any = new Error(
            `fin-sight-engine fetch-combined-csvs-by-firm failed: ${res.status} ${text}`,
          );
          err.status = res.status;
          throw err;
        }
        return res.json();
      },
      3,
      1000,
      10000,
      [429, 500, 502, 503, 504],
    );

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const upstreamStatus =
      typeof err?.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 502;
    return new Response(
      JSON.stringify({ error: err?.message || "Upstream fetch failed" }),
      { status: upstreamStatus, headers: { "Content-Type": "application/json" } },
    );
  }
}
