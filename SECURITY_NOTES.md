# financial-data-analysis Security Notes (`dev-secure` branch)

This branch hardens the Next.js service against the most common pen-test
findings **without changing the request contract of any existing route**, so
it is safe to deploy ahead of the larger auth-migration work tracked below.

## What changed on this branch

| Area | File | Change |
| --- | --- | --- |
| Security headers (framework) | `next.config.mjs` | HSTS (prod only), X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, COOP, CORP. Plus `output: "standalone"`, `poweredByHeader: false`, `productionBrowserSourceMaps: false`. |
| Security headers (defence-in-depth) + body cap | `middleware.ts` (new) | Re-applies the headers for streaming/SSE responses. Returns `413 payload_too_large` for inbound `POST/PUT/PATCH` bodies > 5 MB before they hit the route handler — protects the Anthropic / Perplexity spend. |
| Liveness probe | `app/api/health/route.ts` (new) | Tiny `GET /api/health` for the container HEALTHCHECK. No DB/dep calls. |
| Service-to-service auth (outbound) | `lib/internalApiKey.ts` (new) + `app/api/finance/route.ts` | All seven `callFinsightAPI` `fetch()` calls attach `X-Internal-Key` when `INTERNAL_API_KEY` is set. Backward compatible: header is empty until the env var is present, then finSightAI starts enforcing — same opt-in rollout as fin-sight-engine. |
| Error sanitisation | `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts` | Generic `{error:"internal_error"}` 500 envelope — no Prisma error text echoed to clients. |
| PII redaction helper | `lib/redact.ts` (new) | `maskEmail`, `maskToken` — use anywhere `email` / `token` would otherwise hit `console.log`. |
| Container hardening | `Dockerfile.prod` (new), `.dockerignore` (new) | Multi-stage build (`deps` → `builder` → `runtime`), Next.js standalone output, non-root `nextjs:1001` user, `HEALTHCHECK`, no compilers / dev deps in runtime image. Crucially: uses `node server.js` (standalone) instead of `next dev`. |
| Build reproducibility | `.gitignore`, `package.json` | Stopped ignoring `package-lock.json` so `npm ci` in Dockerfile.prod is deterministic. Added `build:prod` and `start:prod` scripts that read env from the container, not a baked-in `.env.prod`. Added `audit` / `audit:full` scripts. |

## What is still open (NOT done on this branch — needs your sign-off)

### Unauthenticated API routes (CRITICAL)

Every route in `app/api/**` is currently open. Anyone on the internet can:

- Burn your **Anthropic** + **Perplexity** budget via `POST /api/finance` and `POST /api/perplexity`.
- List, read, or create conversations for any banker/client via `/api/conversations`.

Fix requires a coordinated change with the embedding host:

1. Add a session / JWT validator (Cognito to match fin-sight-engine, or NextAuth) in a new `lib/auth.ts`.
2. Add `Depends`-style helper that wraps each route handler and pulls `{ user_id, bankerId }` from the verified token.
3. Update the iframe host (or parent app at `https://app.weidentify.ai`) to forward the user's id token to this app.
4. Replace `clientId` / `bankerId` query params with values derived from the token.

### Client-supplied `user_id` forwarded to finSightAI (CRITICAL)

`app/api/finance/route.ts:460` reads `icfMapping.investment_banker_id` from
the request body and forwards it verbatim as `user_id` to every finSightAI
call. Until finSightAI's own auth migration is done (see
`finSightAI/SECURITY_NOTES.md`) this means callers of this service can
impersonate any user on finSightAI. Locked in lockstep with the JWT cutover
above.

### Rate limiting

No per-IP / per-token rate limiter on `/api/finance` or `/api/perplexity`. A
single malicious caller can drain your LLM credits in minutes. Recommended:
add `@vercel/edge-rate-limit` or a Redis-backed limiter once auth is in place
(so we have a stable identity to limit on).

### Rollout sequence for `INTERNAL_API_KEY`

Same shared key as the other two repos.

1. Deploy this branch with `INTERNAL_API_KEY` **unset** — calls work as before.
2. Set `INTERNAL_API_KEY=<key>` here and on fin-sight-engine — both start
   sending `X-Internal-Key`.
3. Set the **same** key on finSightAI → enforcement activates on its
   `/api/trigger/*` endpoints.

### Move to `Dockerfile.prod`

`Dockerfile` (the original) still runs `next dev` and is unsafe for prod. The
new `Dockerfile.prod` should replace it in your CI / ECS task definition. The
old file is left in place so the dev workflow (`docker compose up` etc.)
isn't disturbed.
