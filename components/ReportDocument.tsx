// components/ReportDocument.tsx
// @react-pdf/renderer — client-side only, always dynamically imported

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ChartData, TableData, MemoData, NarrativeData } from "@/types/chart";

export interface ReportDocumentProps {
  reportTitle: string;
  clientName: string;
  firmName: string;
  date: string;
  memos: MemoData[];
  narratives: NarrativeData[];
  tables: TableData[];
  charts: ChartData[];
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  // ── Cover ──────────────────────────────────────────────
  coverWrap: {
    flex: 1,
    justifyContent: "center",
  },
  coverEyebrow: {
    fontSize: 8,
    color: "#9ca3af",
    letterSpacing: 2,
    marginBottom: 14,
  },
  coverTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 28,
  },
  coverDivider: {
    borderBottom: "1 solid #e5e7eb",
    marginBottom: 24,
  },
  coverMetaRow: {
    flexDirection: "row",
    marginBottom: 7,
  },
  coverMetaLabel: {
    fontSize: 9,
    color: "#9ca3af",
    width: 84,
  },
  coverMetaValue: {
    fontSize: 9,
    color: "#374151",
    flex: 1,
  },
  // ── Section headers ────────────────────────────────────
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 12,
    paddingBottom: 5,
    borderBottom: "1 solid #e5e7eb",
  },
  subHeader: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 4,
    marginTop: 10,
  },
  // ── Body text ──────────────────────────────────────────
  body: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#4b5563",
    marginBottom: 5,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    color: "#6b7280",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
    color: "#4b5563",
  },
  // ── Memo card ──────────────────────────────────────────
  memoCard: {
    border: "1 solid #e5e7eb",
    borderRadius: 5,
    padding: 14,
    marginBottom: 18,
  },
  memoTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 3,
  },
  memoMeta: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 10,
  },
  memoRecommendation: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    lineHeight: 1.5,
    marginBottom: 5,
  },
  // ── Narrative ──────────────────────────────────────────
  narrativeBox: {
    backgroundColor: "#f9fafb",
    borderLeft: "3 solid #9ca3af",
    padding: 12,
    marginBottom: 14,
    borderRadius: 3,
  },
  narrativeText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#374151",
  },
  narrativeTone: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 5,
  },
  // ── Tables ─────────────────────────────────────────────
  tableWrap: {
    marginTop: 6,
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1 solid #e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #f3f4f6",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: "0.5 solid #f3f4f6",
    backgroundColor: "#fafafa",
  },
  tableHeaderCell: {
    flex: 1,
    padding: "5 6",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
  },
  tableCell: {
    flex: 1,
    padding: "4 6",
    fontSize: 9,
    color: "#374151",
  },
  tableFooter: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 3,
    fontStyle: "italic" as const,
  },
  // ── Chart data ─────────────────────────────────────────
  chartTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 3,
    marginTop: 12,
  },
  chartNote: {
    fontSize: 8,
    color: "#9ca3af",
    fontStyle: "italic" as const,
    marginBottom: 5,
  },
  // ── Footer ─────────────────────────────────────────────
  pageFooter: {
    position: "absolute",
    bottom: 28,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.5 solid #e5e7eb",
    paddingTop: 6,
  },
  pageFooterText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return "Not available";
  if (type === "currency") {
    const n = Number(value);
    if (isNaN(n)) return String(value);
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  }
  if (type === "percent") {
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return `${(n > 1 ? n : n * 100).toFixed(1)}%`;
  }
  if (type === "number") {
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TableSection({ table }: { table: TableData }) {
  return (
    <View wrap={false}>
      <Text style={styles.subHeader}>{table.title}</Text>
      {table.description ? <Text style={styles.body}>{table.description}</Text> : null}
      <View style={styles.tableWrap}>
        <View style={styles.tableHeaderRow}>
          {table.columns.map((col) => (
            <Text key={col.key} style={styles.tableHeaderCell}>
              {col.label}
            </Text>
          ))}
        </View>
        {table.rows.map((row, rowIdx) => (
          <View key={rowIdx} style={rowIdx % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
            {table.columns.map((col) => (
              <Text key={col.key} style={styles.tableCell}>
                {formatValue(row[col.key], col.type ?? "text")}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {table.footer ? <Text style={styles.tableFooter}>{table.footer}</Text> : null}
    </View>
  );
}

function MemoSection({ memo }: { memo: MemoData }) {
  return (
    <View style={styles.memoCard} wrap={false}>
      <Text style={styles.memoTitle}>{memo.title}</Text>
      {(memo.company || memo.date) ? (
        <Text style={styles.memoMeta}>
          {[memo.company, memo.date].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}

      <Text style={styles.subHeader}>Executive Summary</Text>
      <Text style={styles.body}>{memo.executive_summary}</Text>

      {memo.analysis ? (
        <>
          <Text style={styles.subHeader}>Analysis</Text>
          <Text style={styles.body}>{stripMarkdown(memo.analysis)}</Text>
        </>
      ) : null}

      {memo.risks.length > 0 ? (
        <>
          <Text style={styles.subHeader}>Key Risks</Text>
          {memo.risks.map((risk, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>▸</Text>
              <Text style={styles.bulletText}>{risk}</Text>
            </View>
          ))}
        </>
      ) : null}

      {memo.recommendation ? (
        <>
          <Text style={styles.subHeader}>Recommendation</Text>
          <Text style={styles.memoRecommendation}>{memo.recommendation}</Text>
        </>
      ) : null}
    </View>
  );
}

function ChartDataSection({ chart }: { chart: ChartData }) {
  const xKey = chart.config.xAxisKey ?? (chart.data.length > 0 ? Object.keys(chart.data[0])[0] : "x");
  const dataKeys = chart.data.length > 0
    ? Object.keys(chart.data[0]).filter((k) => k !== xKey)
    : [];

  return (
    <View wrap={false}>
      <Text style={styles.chartTitle}>{chart.config.title}</Text>
      {chart.config.description ? <Text style={styles.body}>{chart.config.description}</Text> : null}
      <Text style={styles.chartNote}>
        Interactive chart available in the Financial AI Assistant application.
      </Text>
      {chart.data.length > 0 && dataKeys.length > 0 ? (
        <View style={styles.tableWrap}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderCell}>{xKey}</Text>
            {dataKeys.map((k) => (
              <Text key={k} style={styles.tableHeaderCell}>
                {chart.chartConfig[k]?.label ?? k}
              </Text>
            ))}
          </View>
          {chart.data.slice(0, 12).map((row, rowIdx) => (
            <View key={rowIdx} style={rowIdx % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
              <Text style={styles.tableCell}>{String(row[xKey] ?? "")}</Text>
              {dataKeys.map((k) => (
                <Text key={k} style={styles.tableCell}>{String(row[k] ?? "")}</Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Page footer ────────────────────────────────────────────────────────────────

function Footer({ firmName }: { firmName: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.pageFooterText}>{firmName || "Financial AI Assistant"}</Text>
      <Text
        style={styles.pageFooterText}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

// ── Main document ──────────────────────────────────────────────────────────────

export function ReportDocument({
  reportTitle,
  clientName,
  firmName,
  date,
  memos,
  narratives,
  tables,
  charts,
}: ReportDocumentProps) {
  const contentSummary = [
    memos.length > 0 && `${memos.length} Investment Memo${memos.length > 1 ? "s" : ""}`,
    narratives.length > 0 && `${narratives.length} Client Narrative${narratives.length > 1 ? "s" : ""}`,
    tables.length > 0 && `${tables.length} Data Table${tables.length > 1 ? "s" : ""}`,
    charts.length > 0 && `${charts.length} Chart${charts.length > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document title={reportTitle} creator="Financial AI Assistant">
      {/* ── Cover page ─────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverWrap}>
          <Text style={styles.coverEyebrow}>INVESTMENT RESEARCH REPORT</Text>
          <Text style={styles.coverTitle}>{reportTitle}</Text>
          {clientName ? <Text style={styles.coverSubtitle}>{clientName}</Text> : null}
          <View style={styles.coverDivider} />
          {firmName ? (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Firm</Text>
              <Text style={styles.coverMetaValue}>{firmName}</Text>
            </View>
          ) : null}
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Date</Text>
            <Text style={styles.coverMetaValue}>{date}</Text>
          </View>
          {contentSummary ? (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Contents</Text>
              <Text style={styles.coverMetaValue}>{contentSummary}</Text>
            </View>
          ) : null}
        </View>
        <Footer firmName={firmName} />
      </Page>

      {/* ── Investment Memos ───────────────────────────── */}
      {memos.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionHeader}>Investment Memos</Text>
          {memos.map((memo, i) => (
            <MemoSection key={i} memo={memo} />
          ))}
          <Footer firmName={firmName} />
        </Page>
      )}

      {/* ── Client Narratives ──────────────────────────── */}
      {narratives.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionHeader}>Client Narratives</Text>
          {narratives.map((n, i) => (
            <View key={i} style={styles.narrativeBox}>
              <Text style={styles.narrativeText}>{n.narrative}</Text>
              {n.tone ? (
                <Text style={styles.narrativeTone}>
                  Tone: {n.tone.charAt(0).toUpperCase() + n.tone.slice(1)}
                </Text>
              ) : null}
            </View>
          ))}
          <Footer firmName={firmName} />
        </Page>
      )}

      {/* ── Data Tables ────────────────────────────────── */}
      {tables.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionHeader}>Data Tables</Text>
          {tables.map((table, i) => (
            <TableSection key={i} table={table} />
          ))}
          <Footer firmName={firmName} />
        </Page>
      )}

      {/* ── Chart Data ─────────────────────────────────── */}
      {charts.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionHeader}>Chart Data</Text>
          {charts.map((chart, i) => (
            <ChartDataSection key={i} chart={chart} />
          ))}
          <Footer firmName={firmName} />
        </Page>
      )}
    </Document>
  );
}
