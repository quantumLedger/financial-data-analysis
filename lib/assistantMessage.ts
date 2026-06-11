export const ASSISTANT_NAME = "Inspolio Copilot";

export const ASSISTANT_ERROR_MESSAGE =
  "Something went wrong and I couldn't complete your request. Please try again.";

export type VisualPayload = {
  charts?: unknown[] | null;
  tables?: unknown[] | null;
  memos?: unknown[] | null;
  narratives?: unknown[] | null;
};

export function hasVisualContent(payload: VisualPayload): boolean {
  return (
    (payload.charts?.length ?? 0) > 0 ||
    (payload.tables?.length ?? 0) > 0 ||
    (payload.memos?.length ?? 0) > 0 ||
    (payload.narratives?.length ?? 0) > 0
  );
}

export function isUnresolvedAssistantContent(content: string | undefined | null): boolean {
  if (!content) return true;
  const trimmed = content.trim();
  return trimmed === "" || trimmed === "thinking";
}

export function buildVisualOnlyMessage(payload: VisualPayload): string {
  const chartCount = payload.charts?.length ?? 0;
  const tableCount = payload.tables?.length ?? 0;
  const memoCount = payload.memos?.length ?? 0;
  const narrativeCount = payload.narratives?.length ?? 0;

  const kinds: string[] = [];
  if (chartCount > 0) kinds.push(chartCount === 1 ? "a chart" : "charts");
  if (tableCount > 0) kinds.push(tableCount === 1 ? "a data table" : "data tables");
  if (memoCount > 0) kinds.push(memoCount === 1 ? "an investment memo" : "investment memos");
  if (narrativeCount > 0) {
    kinds.push(narrativeCount === 1 ? "a client narrative" : "client narratives");
  }

  if (kinds.length === 1) {
    return `For your query above, I've generated ${kinds[0]} — explore it in the panel on the right.`;
  }

  const last = kinds.pop();
  const summary = kinds.length > 0 ? `${kinds.join(", ")} and ${last}` : (last ?? "results");
  return `For your query above, I've generated ${summary} — explore them in the panel on the right.`;
}

/**
 * Returns the message text we should show and persist for an assistant reply.
 * Keeps real streamed text when present; otherwise synthesizes a friendly
 * summary when only visual artifacts were produced.
 */
export function resolveAssistantDisplayContent(
  rawText: string | undefined | null,
  payload: VisualPayload
): string {
  const text = rawText?.trim() ?? "";
  if (text && text !== "thinking") return rawText!.trim();

  if (hasVisualContent(payload)) {
    return buildVisualOnlyMessage(payload);
  }

  return "";
}

export function finalizeAssistantMessage<T extends VisualPayload & { role?: string; content: string; status?: string }>(
  message: T | undefined
): T | undefined {
  if (!message || message.role !== "assistant") return message;

  const payload: VisualPayload = {
    charts: message.charts,
    tables: message.tables,
    memos: message.memos,
    narratives: message.narratives,
  };

  if (!isUnresolvedAssistantContent(message.content)) {
    return { ...message, status: undefined };
  }

  const resolved = resolveAssistantDisplayContent(message.content, payload);
  return {
    ...message,
    status: undefined,
    content: resolved || ASSISTANT_ERROR_MESSAGE,
  };
}
