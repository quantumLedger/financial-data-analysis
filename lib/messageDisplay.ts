const DATA_JSON_MARKER = "DATA JSON:";

const TRIVIAL_GREETING =
  /^(hi|hello|hey|hi there|hello there|good morning|good afternoon)[!.?\s]*$/i;

/** Short test greetings that should not appear in the chat timeline. */
export function isTrivialGreetingMessage(content: string): boolean {
  if (!content?.trim()) return false;
  return TRIVIAL_GREETING.test(content.trim());
}

const HOLDING_KEY_ALIASES: Record<string, string> = {
  symbol: "Symbol",
  asset: "Asset",
  sector: "Sector",
  industry: "Industry",
  weight: "Weight",
  market_value: "Market value",
  "market value": "Market value",
  current_units: "Units",
  price: "Price",
  asset_class: "Asset class",
  source: "Source",
};

function findFirstObjectArray(value: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 6 || value == null) return null;
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      return value as Record<string, unknown>[];
    }
    return null;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findFirstObjectArray(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Strip internal API payloads from text shown in the chat UI. */
export function sanitizeMessageForDisplay(content: string): string {
  if (!content?.trim()) return content;

  const markerIdx = content.indexOf(DATA_JSON_MARKER);
  if (markerIdx !== -1) {
    const summary = content.slice(0, markerIdx).trim();
    return summary
      ? `${summary}\n\nPortfolio dataset loaded for analysis.`
      : "Portfolio dataset loaded for analysis.";
  }

  const trimmed = content.trim();
  if (
    (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
    trimmed.length > 400 &&
    tryParseJson(trimmed)
  ) {
    return "Structured portfolio data was submitted for analysis.";
  }

  if (
    content.includes("Initialize portfolio memory") &&
    content.length > 600
  ) {
    const lines = content
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        if (t.startsWith("{") || t.startsWith("[")) return false;
        if (t.includes('"symbol"') && t.includes('"asset"')) return false;
        return true;
      })
      .slice(0, 14);
    return `${lines.join("\n").trim()}\n\nPortfolio dataset loaded for analysis.`;
  }

  return content;
}

/** User-facing text persisted to the database (never store raw internal JSON). */
export function sanitizeMessageForPersistence(content: string): string {
  const display = sanitizeMessageForDisplay(content);
  return display.replace(/\*\*View details\*\*/g, "View details");
}

export function extractPortfolioHoldings(
  content: string
): Record<string, unknown>[] | null {
  if (!content?.trim()) return null;

  const markerIdx = content.indexOf(DATA_JSON_MARKER);
  let jsonText: string | null = null;

  if (markerIdx !== -1) {
    jsonText = content.slice(markerIdx + DATA_JSON_MARKER.length).trim();
  } else if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    jsonText = content.trim();
  }

  if (!jsonText) return null;

  const parsed = tryParseJson(jsonText);
  if (!parsed) return null;

  if (Array.isArray(parsed)) {
    return parsed.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  }

  if (typeof parsed === "object" && parsed !== null) {
    const root = parsed as Record<string, unknown>;
    const fromPortfolio = findFirstObjectArray(root.portfolioData ?? root);
    if (fromPortfolio?.length) return fromPortfolio;
  }

  return null;
}

export function messageHasExpandableDetail(content: string): boolean {
  if (!content) return false;
  if (extractPortfolioHoldings(content)) return true;
  if (content.includes(DATA_JSON_MARKER)) return true;
  if (content.length > 900) return true;
  return false;
}

export function getReadMoreLabel(content: string): string {
  return extractPortfolioHoldings(content) ? "View details" : "Read more";
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

export function pickHoldingsColumns(
  rows: Record<string, unknown>[]
): { key: string; label: string }[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const ordered: string[] = [];

  for (const alias of Object.keys(HOLDING_KEY_ALIASES)) {
    const match = keys.find((k) => k.toLowerCase() === alias.toLowerCase());
    if (match && !ordered.includes(match)) ordered.push(match);
  }

  for (const k of keys) {
    if (!ordered.includes(k) && ordered.length < 8) ordered.push(k);
  }

  return ordered.map((key) => ({
    key,
    label:
      HOLDING_KEY_ALIASES[key] ??
      HOLDING_KEY_ALIASES[key.toLowerCase()] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export function formatHoldingsForTable(rows: Record<string, unknown>[]) {
  const columns = pickHoldingsColumns(rows);
  const maxRows = 150;
  const slice = rows.slice(0, maxRows);
  return { columns, rows: slice, total: rows.length, truncated: rows.length > maxRows };
}
