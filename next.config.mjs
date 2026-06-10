/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Origins that are allowed to embed this app inside an <iframe>. The
// fin-sight-front shell loads this app as an iframe (see
// fin-sight-front/src/components/Analyst/index.tsx), so we must allow that
// parent origin or the browser cancels the request and shows
// "refused to connect" in the iframe.
//
// Reads from NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS (comma-separated) and falls
// back to sane prod / dev defaults. Keep this list in sync with
// `ALLOWED_PARENT_ORIGINS` in lib/config.ts (used by the postMessage bridge).
const parentOriginsFromEnv = process.env.NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS
  ?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedFrameAncestors = parentOriginsFromEnv?.length
  ? parentOriginsFromEnv
  : isProd
    ? [
        "https://inspolio.weidentify.ai",
        "https://app.weidentify.ai",
        "https://weidentify.ai",
      ]
    : ["http://localhost:3000"];

// CSP `frame-ancestors` is the modern, allow-list-capable replacement for
// X-Frame-Options. Browsers that support CSP2+ ignore X-Frame-Options when
// frame-ancestors is set, so we drop XFO entirely — the previous `DENY`
// value blocked the legitimate embedding from fin-sight-front.
const frameAncestorsValue = ["'self'", ...allowedFrameAncestors].join(" ");

// Baseline security headers applied to every response. middleware.ts also
// sets these as defence-in-depth in case a route bypasses the framework
// headers pipeline (e.g. SSE / streaming responses).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors ${frameAncestorsValue};`,
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  },
  // NOTE: Cross-Origin-Opener-Policy applies to top-level browsing contexts
  // only, so it does not block iframe embedding. Cross-Origin-Resource-Policy
  // applies to no-cors subresource fetches (images, scripts, fonts) — not to
  // iframe document loads — so `same-site` is still safe here because both
  // inspolio.weidentify.ai and finance.weidentify.ai share the same site.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig = {
  // NOTE: `output: "standalone"` is the right choice for the Dockerfile.prod
  // image (smaller, self-contained). It is intentionally OFF here because we
  // currently run bare on EC2 under pm2 with `next start`, and the standalone
  // runtime does not auto-load `.env*` files — that broke DATABASE_URL
  // resolution at runtime. Re-enable when we cut over to the Docker image
  // and inject env via the container environment.
  // output: "standalone",

  // Hide the `X-Powered-By: Next.js` header — minor fingerprinting reduction.
  poweredByHeader: false,

  // Don't ship readable source maps to the browser in production.
  productionBrowserSourceMaps: false,

  // Next.js 16 blocks cross-origin requests to internal dev resources
  // (e.g. `/__nextjs_font/*`, `/_next/webpack-hmr`) by default. When this
  // app is served via `finance.weidentify.ai` but `next dev` thinks of
  // itself as `localhost:4000`, the iframe parent ends up "cross-origin"
  // to those dev endpoints and fonts / HMR get blocked with a console
  // warning. Allow-list the real public host(s) here. Only used by
  // `next dev`; ignored by `next start`.
  allowedDevOrigins: [
    "finance.weidentify.ai",
    "inspolio.weidentify.ai",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
