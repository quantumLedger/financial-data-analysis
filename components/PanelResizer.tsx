"use client";

import React from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type PanelResizerProps = {
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
};

export function PanelResizer({ isResizing, onMouseDown }: PanelResizerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat and analysis panels"
      className={cn(
        "group relative z-20 flex w-3 shrink-0 cursor-col-resize select-none flex-col items-center justify-center",
        "bg-gradient-to-b from-transparent via-border/80 to-transparent",
        "hover:via-primary/25",
        isResizing && "via-primary/30"
      )}
      onMouseDown={onMouseDown}
      style={{ userSelect: "none" }}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-0 rounded-full border bg-background px-0.5 py-2 shadow-md transition-all",
          "group-hover:border-primary/40",
          isResizing ? "border-primary/50 shadow-lg scale-105" : "border-border/80"
        )}
      >
        <ChevronLeft className="h-2.5 w-2.5 text-muted-foreground/70" />
        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
        <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/70" />
      </div>
    </div>
  );
}
