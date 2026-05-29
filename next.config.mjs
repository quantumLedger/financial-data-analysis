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
  // Build a self-contained server for the Dockerfile.prod multi-stage image.
  output: "standalone",

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
