"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type FullPageLoaderProps = {
  open: boolean;
  message?: string;
};

export function FullPageLoader({
  open,
  message = "Loading your message",
}: FullPageLoaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-background/60 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-[2px] border bg-background px-6 py-5 shadow-lg">
        <span
          className="inline-block h-5 w-5 shrink-0 rounded-[2px] border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin"
          aria-hidden
        />
        <p className="text-[13px] font-medium text-foreground">{message}</p>
        <p className="text-[11px] text-muted-foreground">Please wait a moment</p>
      </div>
    </div>,
    document.body
  );
}
