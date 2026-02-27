"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import type { NarrativeData } from "@/types/chart";

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  conversational: "Conversational",
  executive: "Executive",
};

export function NarrativeCard({ data }: { data: NarrativeData }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = data.narrative;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data.narrative]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Client Narrative
            </span>
            {data.tone && (
              <span className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground">
                {TONE_LABELS[data.tone] ?? data.tone}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              copied
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="bg-muted/30 border rounded-lg p-4">
          <p className="text-[13px] leading-relaxed text-foreground">{data.narrative}</p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Ready to paste into emails, deck slides, or client reports.
        </p>
      </CardContent>
    </Card>
  );
}
