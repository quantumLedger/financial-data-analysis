"use client";

import React, { useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import type { TableData, TableColumn } from "@/types/chart";

function formatCell(value: any, type: TableColumn["type"]): { text: string; color?: string } {
  if (value === null || value === undefined) return { text: "—" };

  switch (type) {
    case "currency": {
      const n = Number(value);
      if (isNaN(n)) return { text: String(value) };
      if (Math.abs(n) >= 1e9) return { text: `$${(n / 1e9).toFixed(1)}B`, color: n < 0 ? "text-red-500" : undefined };
      if (Math.abs(n) >= 1e6) return { text: `$${(n / 1e6).toFixed(1)}M`, color: n < 0 ? "text-red-500" : undefined };
      return { text: `$${n.toLocaleString()}`, color: n < 0 ? "text-red-500" : undefined };
    }
    case "percent": {
      const n = Number(value);
      if (isNaN(n)) return { text: String(value) };
      const pct = n > 1 ? n : n * 100; // handle both 0.15 and 15
      return { text: `${pct.toFixed(1)}%`, color: pct < 0 ? "text-red-500" : pct > 0 ? "text-green-600" : undefined };
    }
    case "number": {
      const n = Number(value);
      if (isNaN(n)) return { text: String(value) };
      return { text: n.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: n < 0 ? "text-red-500" : undefined };
    }
    case "badge": {
      const text = String(value);
      const lower = text.toLowerCase();
      const color = lower === "beat" || lower === "buy" || lower === "bullish"
        ? "text-green-600 bg-green-50 border-green-200"
        : lower === "miss" || lower === "sell" || lower === "cautious"
        ? "text-red-600 bg-red-50 border-red-200"
        : "text-muted-foreground bg-muted border";
      return { text, color };
    }
    default:
      return { text: String(value) };
  }
}

function downloadTableAsCSV(data: TableData) {
  const header = data.columns.map((c) => c.label).join(",");
  const rows = data.rows.map((row) =>
    data.columns.map((col) => {
      const v = row[col.key];
      const text = typeof v === "string" && v.includes(",") ? `"${v}"` : String(v ?? "");
      return text;
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.title || "table").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTableRenderer({ data }: { data: TableData }) {
  const handleDownload = useCallback(() => downloadTableAsCSV(data), [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-[14px]">{data.title}</CardTitle>
            {data.description && (
              <CardDescription className="text-[12px] mt-0.5">{data.description}</CardDescription>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            title="Download as CSV"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                {data.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-${col.align ?? "left"}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className={`border-b last:border-0 ${rowIdx % 2 === 1 ? "bg-muted/20" : ""}`}>
                  {data.columns.map((col) => {
                    const { text, color } = formatCell(row[col.key], col.type);
                    const isBadge = col.type === "badge";
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 text-${col.align ?? "left"} whitespace-nowrap`}
                      >
                        {isBadge ? (
                          <span className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
                            {text}
                          </span>
                        ) : (
                          <span className={color}>{text}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      {data.footer && (
        <CardFooter className="pt-1 pb-3 px-4">
          <p className="text-[11px] text-muted-foreground">{data.footer}</p>
        </CardFooter>
      )}
    </Card>
  );
}
