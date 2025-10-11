// /app/page.tsx
"use client";

import React, {useState} from "react";
import FinancePage from "./finance/page";
import { IcfProvider } from "@/components/IcfBridge";
import FloatingSpreadsheetLauncher from "@/components/FloatingSpreadsheetLauncher";




export default function Home() {
    const [picked, setPicked] = useState<any>(null);

  return (
       <IcfProvider>
        {/* <IcfDebugBadge /> */}
        <div>
          <FloatingSpreadsheetLauncher
            initialData={[
              { Ticker: "AAPL", Price: 227.3, Qty: 10 },
              { Ticker: "MSFT", Price: 415.9, Qty: 5 },
              { Ticker: "NVDA", Price: 124.7, Qty: 8 },
            ]}
            onConfirm={(payload) => {
              // payload.matrix: 2D array
              // payload.objects: header-mapped objects (if headers present)
              // payload.range:   "A1:C4" style
              setPicked(payload);
            }}
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

