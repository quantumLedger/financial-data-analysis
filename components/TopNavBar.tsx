"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { ALLOWED_PARENT_ORIGINS } from "@/lib/config";

interface TopNavBarProps {
  features?: {
    showDomainSelector?: boolean;
    showViewModeSelector?: boolean;
    showPromptCaching?: boolean;
  };
}

const TopNavBar: React.FC<TopNavBarProps> = ({ features = {} }) => {
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Listen for SET_THEME messages from the parent (fin-sight-front) iframe host. */
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Validate origin — accept allowed parent origins and same-origin (dev hot-reload)
      const allowed =
        ALLOWED_PARENT_ORIGINS.includes(event.origin) ||
        event.origin === window.location.origin;
      if (!allowed) return;

      const data = event.data as { type?: string; theme?: string } | null;
      if (data?.type === 'SET_THEME' && (data.theme === 'dark' || data.theme === 'light')) {
        setTheme(data.theme);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setTheme]);

  if (!mounted) return null;

  // The nav bar itself has no visible UI — theme control comes from the parent.
  return <div className="hidden" aria-hidden />;
};

export default TopNavBar;
