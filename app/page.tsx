// /app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import FinancePage from "./finance/page";
import { IcfProvider } from "@/components/IcfBridge";
import FloatingSpreadsheetLauncher from "@/components/FloatingSpreadsheetLauncher";

export default function Home() {
  const [picked, setPicked] = useState<any>(null);

  useEffect(() => {
    const removeSyncfusionError = () => {
      const elems = document.querySelectorAll(".syncfusion-license-error");
      elems.forEach(el => el.remove());
      console.log("Removed syncfusion-license-error elements");
    };

    const timer1 = setTimeout(removeSyncfusionError, 5000);
    const timer2 = setTimeout(removeSyncfusionError, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <IcfProvider>
      <div>
        <FloatingSpreadsheetLauncher
          initialData={[
            { Ticker: "AAPL", Price: 227.3, Qty: 10 },
            { Ticker: "MSFT", Price: 415.9, Qty: 5 },
            { Ticker: "NVDA", Price: 124.7, Qty: 8 },
          ]}
          onConfirm={(payload) => setPicked(payload)}
          anchor="bottom-right"
          dialogWidth={900}
          dialogHeight={560}
          theme="light"
          sheetName="Portfolio Analyst"
        />
      </div>
      <FinancePage />
    </IcfProvider>
  );
}
