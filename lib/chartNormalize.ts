import type { ChartConfig, ChartData } from "@/types/chart";

const SEGMENT_KEYS = [
  "segment",
  "category",
  "name",
  "label",
  "sector",
  "symbol",
  "industry",
  "asset_class",
  "assetClass",
] as const;

const VALUE_KEYS = [
  "value",
  "marketValue",
  "market_value",
  "amount",
  "weight",
  "percentage",
] as const;

function readNumeric(item: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const raw = item[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
      return Number(raw);
    }
  }

  for (const [key, raw] of Object.entries(item)) {
    if (SEGMENT_KEYS.includes(key as (typeof SEGMENT_KEYS)[number])) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }

  return 0;
}

function readSegment(
  item: Record<string, unknown>,
  segmentKey: string,
  index: number
): string {
  const candidates = [segmentKey, ...SEGMENT_KEYS];
  for (const key of candidates) {
    const raw = item[key];
    if (raw != null && String(raw).trim() !== "") return String(raw);
  }
  return `Slice ${index + 1}`;
}

/** Normalize pie rows to `{ segment, value }` — LLM output often omits segment labels. */
export function normalizePieChartRows(
  rows: Array<Record<string, unknown>>,
  config: { xAxisKey?: string },
  chartConfig: ChartConfig
): Array<{ segment: string; value: number }> {
  const segmentKey = config.xAxisKey || "segment";
  const configuredValueKey = Object.keys(chartConfig)[0] ?? "value";
  const valueKeys = [configuredValueKey, ...VALUE_KEYS.filter((k) => k !== configuredValueKey)];

  return rows.map((item, index) => ({
    segment: readSegment(item, segmentKey, index),
    value: readNumeric(item, ...valueKeys),
  }));
}

export function normalizePieChartData(chart: ChartData): ChartData {
  if (chart.chartType !== "pie") return chart;

  const rows = normalizePieChartRows(chart.data, chart.config, chart.chartConfig);
  const label =
    chart.chartConfig[Object.keys(chart.chartConfig)[0] ?? "value"]?.label ?? "Value";

  return {
    ...chart,
    config: { ...chart.config, xAxisKey: "segment" },
    data: rows,
    chartConfig: { value: { label } },
  };
}
