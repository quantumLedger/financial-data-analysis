"use client";

import React, { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MemoData } from "@/types/chart";

const mdComponents: Components = {
  p: ({ node, ...props }) => <p className="text-[12px] my-1" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-1 text-[12px]" {...props} />,
  li: ({ node, ...props }) => <li className="text-[12px]" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
};

export function MemoRenderer({ data }: { data: MemoData }) {
  const handleDownload = useCallback(() => {
    const lines = [
      `# ${data.title}`,
      data.company ? `**Company:** ${data.company}` : "",
      data.date ? `**Date:** ${data.date}` : "",
      "",
      "## Executive Summary",
      data.executive_summary,
      "",
      "## Analysis",
      data.analysis,
      "",
      "## Key Risks",
      ...data.risks.map((r) => `- ${r}`),
      "",
      "## Recommendation",
      data.recommendation,
    ].filter((l) => l !== undefined);

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.title || "memo").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Investment Memo
            </div>
            <CardTitle className="text-[14px]">{data.title}</CardTitle>
            {(data.company || data.date) && (
              <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                {data.company && <span>{data.company}</span>}
                {data.date && <span>{data.date}</span>}
              </div>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            title="Download as Markdown"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4 text-[12px]">
        {/* Executive Summary */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 pb-1 border-b">
            Executive Summary
          </h3>
          <p className="text-[12px] leading-relaxed">{data.executive_summary}</p>
        </section>

        {/* Analysis */}
        {data.analysis && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 pb-1 border-b">
              Analysis
            </h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {data.analysis}
            </ReactMarkdown>
          </section>
        )}

        {/* Risks */}
        {data.risks.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 pb-1 border-b">
              Key Risks
            </h3>
            <ul className="space-y-1">
              {data.risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="text-destructive mt-0.5 flex-shrink-0">▸</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recommendation */}
        {data.recommendation && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 pb-1 border-b">
              Recommendation
            </h3>
            <p className="text-[12px] leading-relaxed font-medium">{data.recommendation}</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
