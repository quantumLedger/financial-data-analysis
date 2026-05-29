/**
 * Tiny PII redaction helpers — use anywhere `email` / `token` would
 * otherwise end up in a `console.log` or a structured log line.
 */

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "***";
  const [local, ...rest] = email.split("@");
  const domain = rest.join("@");
  if (!local) return `***@${domain}`;
  if (local.length === 1) return `*@${domain}`;
  return `${local[0]}${"*".repeat(local.length - 1)}@${domain}`;
}

export function maskToken(
  token: string | null | undefined,
  visible = 4,
): string {
  if (!token) return "***";
  if (token.length <= visible) return "***";
  return `${token.slice(0, visible)}…(${token.length})`;
}
