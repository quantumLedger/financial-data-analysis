/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Baseline security headers applied to every response. middleware.ts also
// sets these as defence-in-depth in case a route bypasses the framework
// headers pipeline (e.g. SSE / streaming responses).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  },
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
