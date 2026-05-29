/**
 * Shared-secret header helper for service-to-service calls into finSightAI
 * (and any other backend that gates trigger endpoints with X-Internal-Key).
 *
 * Returns an empty object when INTERNAL_API_KEY is unset, so the rollout is
 * safe: turn the env var on once the receiving service is also enforcing it.
 */
export function internalApiKeyHeader(): Record<string, string> {
  const key = (process.env.INTERNAL_API_KEY || "").trim();
  return key ? { "X-Internal-Key": key } : {};
}
