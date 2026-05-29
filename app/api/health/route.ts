// Lightweight liveness probe — used by container HEALTHCHECK and ALB.
// Intentionally trivial: no DB or external service calls so a downstream
// outage cannot mark this pod unhealthy.
export const runtime = "nodejs";

export async function GET() {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
