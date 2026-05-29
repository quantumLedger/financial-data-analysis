/**
 * LLM quota / billing alarm for `financial-data-analysis` (Next.js).
 *
 * Mirrors `fin-sight-engine/app/utils/llm_quota_alarm.py` and
 * `finSightAI/services/llm_quota_alarm.py` so all three repos share a
 * single Slack channel for "account is out of credit" alerts.
 *
 * Why a dedicated module:
 *  - Plain HTTP 429 is throttling, not necessarily quota — we deliberately
 *    only alert when the body unambiguously says the account itself is
 *    exhausted (insufficient_quota / billing_hard_limit_reached / credit
 *    balance too low / payment required).
 *  - Per-instance dedup at 1 hour granularity (env-configurable) so a flood
 *    of retries can't spam Slack.
 *  - Best-effort: any dispatch failure is logged and swallowed; alerting
 *    must never break LLM call paths.
 *
 * Required env:
 *  - `SLACK_WEBHOOK_URL`            — same webhook the other two repos use.
 *  - `LLM_QUOTA_ALARM_ENABLED`      — set to `false` to short-circuit (default on).
 *  - `LLM_QUOTA_ALARM_COOLDOWN_SEC` — dedup window in seconds (default 3600).
 *
 * Note: in serverless / edge runtimes each invocation may run in a fresh
 * isolate, weakening the in-memory cooldown. That's acceptable — at worst
 * you get one extra Slack message at the start of a cold deploy. The Node
 * runtime keeps the dedup map across requests inside the same warm instance.
 */

const REPO_NAME = "financial-data-analysis" as const;
const DEFAULT_COOLDOWN_SEC = 3600;

type ProviderName =
  | "perplexity"
  | "openai"
  | "anthropic"
  | "mistral"
  | "gemini"
  | "cohere"
  | (string & {});

interface ProviderSignature {
  name: string;
  quotaStatuses: ReadonlySet<number>;
  bodyMarkers: ReadonlyArray<string>;
}

const QUOTA_SIGNATURES: ReadonlyArray<ProviderSignature> = [
  {
    name: "perplexity",
    // Perplexity returns 401 (not 402) when quota is exhausted, with
    // "insufficient_quota" / "exceeded your current quota" in the body.
    quotaStatuses: new Set([401, 402, 403, 429]),
    bodyMarkers: [
      "insufficient_quota",
      "exceeded your current quota",
      "exceeded your quota",
    ],
  },
  {
    name: "openai",
    quotaStatuses: new Set([402, 429]),
    bodyMarkers: [
      "insufficient_quota",
      "billing_hard_limit_reached",
      "you exceeded your current quota",
      "exceeded your monthly",
    ],
  },
  {
    name: "anthropic",
    quotaStatuses: new Set([400, 402, 403]),
    bodyMarkers: ["credit balance is too low", "credits required", "low balance"],
  },
  {
    name: "mistral",
    quotaStatuses: new Set([402, 429]),
    bodyMarkers: ["insufficient", "quota exceeded", "payment required"],
  },
  {
    name: "gemini",
    quotaStatuses: new Set([429, 403]),
    bodyMarkers: ["resource_exhausted", "quota exceeded", "billing account"],
  },
  {
    name: "cohere",
    quotaStatuses: new Set([402, 429]),
    bodyMarkers: ["quota exceeded", "credit"],
  },
];

const PAYMENT_REQUIRED = 402;
const GENERIC_BODY_REGEX =
  /(insufficient[_\s-]?quota|billing[_\s-]?hard[_\s-]?limit|credit\s+balance\s+is\s+too\s+low|you\s+exceeded\s+your\s+current\s+quota|resource[_\s-]?exhausted)/i;

function normaliseBody(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(body);
    } catch {
      return "";
    }
  }
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/** True when (status, body) unambiguously means the provider account is exhausted. */
export function isLlmQuotaSignal(
  provider: ProviderName,
  statusCode: number | null | undefined,
  body: unknown,
): boolean {
  const textLc = normaliseBody(body).toLowerCase();
  const status = statusCode == null ? null : Number(statusCode);

  if (status === PAYMENT_REQUIRED) return true;

  const providerLc = String(provider || "").toLowerCase();
  for (const sig of QUOTA_SIGNATURES) {
    if (sig.name !== providerLc) continue;
    if (status != null && !sig.quotaStatuses.has(status)) return false;
    return sig.bodyMarkers.some((m) => textLc.includes(m));
  }
  return GENERIC_BODY_REGEX.test(textLc);
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

function cooldownSec(): number {
  const raw = process.env.LLM_QUOTA_ALARM_COOLDOWN_SEC;
  if (!raw) return DEFAULT_COOLDOWN_SEC;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COOLDOWN_SEC;
}

// Module-level Map survives across requests within a warm Node instance.
const lastAlertAt = new Map<string, number>();

function shouldSend(key: string): boolean {
  const now = Date.now();
  const last = lastAlertAt.get(key);
  if (last != null && now - last < cooldownSec() * 1000) return false;
  lastAlertAt.set(key, now);
  return true;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function alarmEnabled(): boolean {
  const raw = (process.env.LLM_QUOTA_ALARM_ENABLED ?? "true").trim().toLowerCase();
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}

function excerpt(body: unknown, limit = 800): string {
  const text = normaliseBody(body);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

async function postSlack(args: {
  provider: ProviderName;
  statusCode: number | null | undefined;
  bodyExcerpt: string;
  requestSummary?: string;
}): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const fields: Array<{ title: string; value: string; short: boolean }> = [
    { title: "Repo", value: REPO_NAME, short: true },
    { title: "Provider", value: String(args.provider), short: true },
  ];
  if (args.statusCode != null) {
    fields.push({ title: "HTTP", value: String(args.statusCode), short: true });
  }
  fields.push({
    title: "Detected at (UTC)",
    value: new Date().toISOString(),
    short: true,
  });
  if (args.requestSummary) {
    fields.push({
      title: "Request",
      value: args.requestSummary.slice(0, 280),
      short: false,
    });
  }
  if (args.bodyExcerpt) {
    fields.push({
      title: "Provider response",
      value: "```" + args.bodyExcerpt.slice(0, 600) + "```",
      short: false,
    });
  }

  const payload = {
    attachments: [
      {
        color: "#ff9900",
        title: `:warning: LLM quota exhausted — ${args.provider}`,
        text:
          "`" +
          REPO_NAME +
          "` is hitting *out-of-quota* responses from *" +
          String(args.provider) +
          "*. Top up the account or rotate the key to restore service.",
        fields,
        footer: "Inspolio LLM quota alarm",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(
          `[llmQuotaAlarm] Slack post returned ${res.status}: ${text.slice(0, 200)}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[llmQuotaAlarm] Slack post failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export interface MaybeAlertArgs {
  provider: ProviderName;
  statusCode?: number | null;
  body?: unknown;
  requestSummary?: string;
}

/**
 * Inspect a failed LLM response and, if it looks like quota exhaustion,
 * fire a Slack alert (with per-instance dedup).
 *
 * Always non-throwing. Returns `true` when an alert was actually dispatched.
 */
export async function maybeAlertLlmQuota(args: MaybeAlertArgs): Promise<boolean> {
  try {
    if (!alarmEnabled()) return false;
    if (!isLlmQuotaSignal(args.provider, args.statusCode, args.body)) return false;

    const dedupKey = `${REPO_NAME}:${String(args.provider || "unknown").toLowerCase()}:quota`;
    if (!shouldSend(dedupKey)) {
      console.warn(
        `[llmQuotaAlarm] quota signal from ${args.provider} suppressed by cooldown`,
      );
      return false;
    }

    const bodyExcerpt = excerpt(args.body);
    console.warn(
      `[llmQuotaAlarm] QUOTA EXHAUSTED — provider=${args.provider} status=${args.statusCode ?? "n/a"}`,
    );
    await postSlack({
      provider: args.provider,
      statusCode: args.statusCode,
      bodyExcerpt,
      requestSummary: args.requestSummary,
    });
    return true;
  } catch (err) {
    console.error("[llmQuotaAlarm] unexpected failure:", err);
    return false;
  }
}

/** Convenience wrapper for caught errors with `status` + `response.text`/`message`. */
export async function maybeAlertLlmQuotaForError(args: {
  provider: ProviderName;
  error: unknown;
  requestSummary?: string;
}): Promise<boolean> {
  const e: any = args.error ?? {};
  const status: number | undefined =
    e?.status ?? e?.statusCode ?? e?.response?.status ?? undefined;
  let body: unknown = e?.response?.text ?? e?.response?.data ?? e?.message ?? "";
  if (typeof body === "function") {
    try {
      body = await (body as () => Promise<unknown>)();
    } catch {
      body = "";
    }
  }
  return maybeAlertLlmQuota({
    provider: args.provider,
    statusCode: status,
    body,
    requestSummary: args.requestSummary,
  });
}

/** Clear the dedup cache; intended for unit tests only. */
export function _resetQuotaAlarmDedupForTests(): void {
  lastAlertAt.clear();
}
