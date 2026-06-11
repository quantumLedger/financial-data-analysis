"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import type { ChartData, TableData, MemoData, NarrativeData } from "@/types/chart";

interface MessageSubset {
  charts?: ChartData[];
  tables?: TableData[];
  memos?: MemoData[];
  narratives?: NarrativeData[];
}

interface ReportGeneratorProps {
  messages: MessageSubset[];
  clientName: string;
  firmName: string;
}

export function ReportGenerator({ messages, clientName, firmName }: ReportGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allMemos = messages.flatMap((m) => m.memos ?? []);
  const allNarratives = messages.flatMap((m) => m.narratives ?? []);
  const allTables = messages.flatMap((m) => m.tables ?? []);
  const allCharts = messages.flatMap((m) => m.charts ?? []);
  const hasContent =
    allMemos.length > 0 ||
    allNarratives.length > 0 ||
    allTables.length > 0 ||
    allCharts.length > 0;

  // Derive a default title when content first appears
  useEffect(() => {
    if (!reportTitle && hasContent) {
      setReportTitle(
        clientName
          ? `${clientName} Investment Report`
          : "Investment Report"
      );
    }
  }, [hasContent, clientName, reportTitle]);

  // Close popover on outside click
  useEffect(() => {
    if (!showForm) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showForm]);

  // Focus input when popover opens
  useEffect(() => {
    if (showForm) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showForm]);

  const handleGenerate = useCallback(async () => {
    if (!reportTitle.trim()) return;
    setGenerating(true);
    try {
      // Dynamic imports — keeps @react-pdf/renderer out of the main bundle
      const [{ pdf }, { ReportDocument }] = await Promise.all([
        import("@react-pdf/renderer") as any,
        import("./ReportDocument"),
      ]);

      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const doc = React.createElement(ReportDocument, {
        reportTitle: reportTitle.trim(),
        clientName,
        firmName,
        date,
        memos: allMemos,
        narratives: allNarratives,
        tables: allTables,
        charts: allCharts,
      });

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle.trim().replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setShowForm(false);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [reportTitle, clientName, firmName, allMemos, allNarratives, allTables, allCharts]);

  if (!hasContent) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setShowForm((v) => !v)}
        title="Generate client proposal PDF"
      >
        <FileText className="h-4 w-4" />
      </Button>

      {showForm && (
        <div className="absolute top-full right-0 mt-1 bg-background border rounded-lg shadow-xl p-3 w-72 z-50">
          <div className="text-[11px] font-semibold mb-1">Generate Client Report</div>
          <div className="text-[10px] text-muted-foreground mb-2">
            {[
              allMemos.length > 0 && `${allMemos.length} memo${allMemos.length > 1 ? "s" : ""}`,
              allNarratives.length > 0 && `${allNarratives.length} narrative${allNarratives.length > 1 ? "s" : ""}`,
              allTables.length > 0 && `${allTables.length} table${allTables.length > 1 ? "s" : ""}`,
              allCharts.length > 0 && `${allCharts.length} chart${allCharts.length > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(", ")}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !generating) handleGenerate();
              if (e.key === "Escape") setShowForm(false);
            }}
            className="w-full text-[11px] border rounded px-2 py-1.5 mb-2.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Report title"
          />
          <Button
            size="sm"
            className="w-full text-[11px] h-7"
            onClick={handleGenerate}
            disabled={generating || !reportTitle.trim()}
          >
            {generating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                Generating report
              </>
            ) : (
              "Download PDF"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
