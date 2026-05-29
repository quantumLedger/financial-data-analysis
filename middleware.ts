import { NextResponse, type NextRequest } from "next/server";

// Defence-in-depth: re-applies the security headers also configured in
// next.config.mjs so streaming responses (SSE in /api/finance) and any
// route that constructs a Response by hand still pick them up. Also caps
// inbound JSON-style bodies to a sane size to prevent abuse of the Claude
// API path with multi-MB pseudo-uploads.

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const isProd = process.env.NODE_ENV === "production";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "X-Permitted-Cross-Domain-Policies": "none",
  ...(isProd
    ? {
        "Strict-Transport-Security":
          "max-age=63072000; includeSubDomains; preload",
      }
    : {}),
};

export function middleware(req: NextRequest) {
  // Reject obviously oversized inbound POST/PUT bodies before they ever
  // reach the route handler (saves Anthropic spend and protects the LLM
  // prompt from being filled with megabytes of attacker-supplied text).
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    const lenHeader = req.headers.get("content-length");
    const len = lenHeader ? Number(lenHeader) : NaN;
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return new NextResponse(
        JSON.stringify({ error: "payload_too_large" }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

// Apply to everything except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
