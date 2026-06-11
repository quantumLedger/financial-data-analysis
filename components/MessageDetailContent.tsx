"use client";

import React, { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  extractPortfolioHoldings,
  formatHoldingsForTable,
  sanitizeMessageForDisplay,
} from "@/lib/messageDisplay";

const detailMdComponents: Components = {
  p: ({ node, ...props }) => <p className="text-[13px] my-1.5" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 text-[13px]" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 text-[13px]" {...props} />,
  li: ({ node, ...props }) => <li className="text-[13px]" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
};

type MessageDetailContentProps = {
  content: string;
  isThinking?: boolean;
  status?: string;
};

export function MessageDetailContent({
  content,
  isThinking,
  status,
}: MessageDetailContentProps) {
  const displayText = useMemo(() => sanitizeMessageForDisplay(content), [content]);
  const holdings = useMemo(() => extractPortfolioHoldings(content), [content]);
  const table = useMemo(
    () => (holdings ? formatHoldingsForTable(holdings) : null),
    [holdings]
  );

  if (isThinking) {
    return (
      <span className="text-muted-foreground text-[11px]">{status ?? "Thinking"}</span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 px-3 py-2.5 leading-relaxed text-[13px] break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={detailMdComponents}>
          {displayText}
        </ReactMarkdown>
      </div>

      {table && table.rows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] font-medium">Portfolio holdings</p>
          <div className="overflow-x-auto rounded-[2px] border">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  {table.columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b last:border-0">
                    {table.columns.map((col) => (
                      <td key={col.key} className="px-2 py-1.5 align-top whitespace-nowrap">
                        {formatCellValue(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.truncated ? (
            <p className="text-[10px] text-muted-foreground">
              Showing first {table.rows.length} of {table.total} holdings.
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              {table.total} holding{table.total === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
