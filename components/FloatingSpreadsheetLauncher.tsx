"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { BarChart3, X } from "lucide-react";
import {
  DialogComponent,
  PositionDataModel,
} from "@syncfusion/ej2-react-popups";
import {
  SpreadsheetComponent,
  SheetsDirective,
  SheetDirective,
  RangesDirective,
  RangeDirective,
  Inject,
  Ribbon,
  Edit,
  Selection,
  Sort,
  Filter,
  Clipboard,
} from "@syncfusion/ej2-react-spreadsheet";

/**
 * IMPORTANT: include these CSS imports once in your global CSS (e.g. app/globals.css)
 * Choose a theme you like (here: material)
 *
 * @import "@syncfusion/ej2-base/styles/material.css";
 * @import "@syncfusion/ej2-buttons/styles/material.css";
 * @import "@syncfusion/ej2-inputs/styles/material.css";
 * @import "@syncfusion/ej2-popups/styles/material.css";
 * @import "@syncfusion/ej2-dropdowns/styles/material.css";
 * @import "@syncfusion/ej2-navigations/styles/material.css";
 * @import "@syncfusion/ej2-react-spreadsheet/styles/material.css";
 */

// Types
export type Anchor = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export type FloatingSpreadsheetLauncherProps = {
  /** Initial input from parent – object or array of objects */
  initialData?: Record<string, any> | Record<string, any>[];
  /** Called when user confirms selection; returns normalized 2D array and objects */
  onConfirm?: (payload: {
    /** 2D cell matrix, trimmed to selection (rows as arrays). Strings or numbers */
    matrix: (string | number)[][];
    /** Array of row objects when headers present; may be empty if not resolvable */
    objects: Record<string, any>[];
    /** Selected A1 range string */
    range: string;
  }) => void;
  /** Optional: controlled open state. If omitted, component manages its own open/close */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Floater position */
  anchor?: Anchor;
  /** Dialog size */
  dialogWidth?: number | string;
  dialogHeight?: number | string;
  /** Label for the launcher (tooltip aria-label) */
  label?: string;
  /** Highest z-index overlaying everything */
  zIndex?: number;
  /** Light/Dark toggles for the launcher button */
  theme?: "light" | "dark" | "auto";
  /** Sheet name to display */
  sheetName?: string;
  /** Optional classNames */
  className?: string;
};

// Utility: normalize objects so the spreadsheet gets consistent columns
function normalizeObjects(
  input?: Record<string, any> | Record<string, any>[]
): Record<string, any>[] {
  if (!input) return [];
  const rows = Array.isArray(input) ? input : [input];
  if (rows.length === 0) return [];
  const headerSet = new Set<string>();
  for (const r of rows) Object.keys(r ?? {}).forEach((k) => headerSet.add(k));
  const headers = Array.from(headerSet);
  return rows.map((r) => {
    const out: Record<string, any> = {};
    for (const h of headers) {
      const v = (r ?? {})[h];
      out[h] =
        v != null && typeof v === "object" ? JSON.stringify(v) : v ?? "";
    }
    return out;
  });
}

// Utility: convert a range's 2D array + first-row headers to objects
function matrixToObjects(matrix: (string | number)[][]): Record<string, any>[] {
  if (!matrix?.length) return [];
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow || headerRow.length === 0) return [];
  return dataRows.map((row) => {
    const obj: Record<string, any> = {};
    headerRow.forEach((h, idx) => {
      const key = String(h ?? "").trim();
      if (key) obj[key] = row[idx] ?? "";
    });
    return obj;
  });
}

// Utility: clamp dialog size
function toPx(v: number | string | undefined, fallback: string): string {
  if (v == null) return fallback;
  return typeof v === "number" ? `${v}px` : v;
}

export default function FloatingSpreadsheetLauncher({
  initialData,
  onConfirm,
  open,
  onOpenChange,
  anchor = "bottom-right",
  dialogWidth = 880,
  dialogHeight = 560,
  label = "Open Spreadsheet",
  zIndex = 2147483647,
  theme = "auto",
  sheetName = "Data",
  className,
}: FloatingSpreadsheetLauncherProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      onOpenChange ? onOpenChange(v) : setInternalOpen(v);
    },
    [onOpenChange]
  );

  const spreadsheetRef = useRef<SpreadsheetComponent | null>(null);

  // Prepare data for the sheet
  const normalized = useMemo(() => normalizeObjects(initialData), [initialData]);

  // Positioning for Syncfusion Dialog (anchors to a corner)
  const position: PositionDataModel = useMemo(() => {
    const map: Record<Anchor, PositionDataModel> = {
      "bottom-right": { X: "Right", Y: "Bottom" },
      "bottom-left": { X: "Left", Y: "Bottom" },
      "top-right": { X: "Right", Y: "Top" },
      "top-left": { X: "Left", Y: "Top" },
    };
    return map[anchor];
  }, [anchor]);

  // Autofit helper after mount/create
  const handleCreated = useCallback(() => {
    const inst = spreadsheetRef.current;
    try {
      // Fit a reasonable number of columns; extend if needed
      inst?.autoFit("A:AZ");
    } catch {}
  }, []);

  // Extract selected range as 2D array (matrix)
  const readSelectionMatrix = useCallback(async (): Promise<
    (string | number)[][]
  > => {
    const inst = spreadsheetRef.current as any;
    if (!inst) return [];
    // A1-style string
    const range: string = inst.getSelectedRange?.() ?? "";
    // getData returns: { result: [{...}], rowCount, colCount } OR a 2D array via getDisplayText
    // We'll attempt getData(range, true) first; fallback to getDisplayText
    try {
      const data = await inst.getData(range);
      if (data && Array.isArray(data.result)) {
        // Convert object rows into matrix using keys order
        const rows = data.result as Record<string, any>[];
        const headers = Object.keys(rows[0] ?? {});
        const matrix: (string | number)[][] = [headers];
        for (const r of rows) {
          matrix.push(headers.map((h) => r[h] ?? ""));
        }
        return matrix;
      }
    } catch {}

    // Fallback: traverse visible text from selected range
    try {
      const addrInfo = inst.getAddressInfo(range);
      const { rowIndex, colIndex, rowCount, colCount } = addrInfo;
      const matrix: (string | number)[][] = [];
      for (let r = 0; r < rowCount; r++) {
        const row: (string | number)[] = [];
        for (let c = 0; c < colCount; c++) {
          const cell = inst.getCell(rowIndex + r, colIndex + c);
          const txt = cell?.textContent ?? "";
          row.push(txt);
        }
        matrix.push(row);
      }
      return matrix;
    } catch {
      return [];
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    const inst = spreadsheetRef.current as any;
    if (!inst) return;
    const range: string = inst.getSelectedRange?.() ?? "";
    const matrix = await readSelectionMatrix();
    const objects = matrixToObjects(matrix);
    onConfirm?.({ matrix, objects, range });
    setOpen(false);
  }, [onConfirm, readSelectionMatrix, setOpen]);

  // Launcher button theme classes
  const btnBase =
    "group fixed rounded-full shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const btnSize = "w-14 h-14";
  const placement: React.CSSProperties = (() => {
    const gap = 16;
    const style: React.CSSProperties = { zIndex, position: "fixed" };
    if (anchor.includes("bottom")) style.bottom = gap;
    if (anchor.includes("top")) style.top = gap;
    if (anchor.includes("right")) style.right = gap;
    if (anchor.includes("left")) style.left = gap;
    return style;
  })();

  const isDark = (() => {
    if (theme === "dark") return false;
    if (theme === "light") return false;
    // auto – respect prefers-color-scheme
    if (typeof window !== "undefined") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    }
    return false;
  })();

  const btnColor = isDark
    ? "bg-black text-white hover:opacity-90 focus:ring-white"
    : "bg-white text-black border border-black/10 hover:bg-black hover:text-white focus:ring-black";

  return (
    <>
      {/* Floating Icon Button */}
      <button
        aria-label={label}
        title={label}
        style={placement}
        className={`${btnBase} ${btnSize} ${btnColor} ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        <BarChart3 className="w-7 h-7 mx-auto" />
      </button>

      {/* Spreadsheet Dialog */}
      <DialogComponent
        visible={isOpen}
        allowDragging
        closeOnEscape
        showCloseIcon
        isModal={false}
        target={"body"}
        position={position}
        width={toPx(dialogWidth, "880px")}
        height={toPx(dialogHeight, "560px")}
        zIndex={zIndex}
        // headerTemplate={() => (
        //   <div className="flex items-center justify-between pr-2">
        //     <span className="font-medium">Spreadsheet</span>
        //     <button
        //       onClick={() => setOpen(false)}
        //       className={`inline-flex items-center justify-center rounded-md p-1 hover:opacity-80 ${
        //         isDark ? "text-white" : "text-black"
        //       }`}
        //       aria-label="Close"
        //     >
        //       <X className="w-5 h-5" />
        //     </button>
        //   </div>
        // )}
        content={() => (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <SpreadsheetComponent
                ref={spreadsheetRef}
                allowSorting
                allowFiltering
                allowEditing
                // allowClipboard
                created={handleCreated}
              >
                <Inject
                  services={[Ribbon, Edit, Selection, Sort, Filter, Clipboard]}
                />
                <SheetsDirective>
                  <SheetDirective name={sheetName}>
                    <RangesDirective>
                      <RangeDirective dataSource={normalized} />
                    </RangesDirective>
                  </SheetDirective>
                </SheetsDirective>
              </SpreadsheetComponent>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-black/10 flex items-center justify-end gap-2 p-2">
              <button
                onClick={() => setOpen(false)}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  isDark
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-black/5 text-black hover:bg-black/10"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  isDark
                    ? "bg-white text-black hover:opacity-90"
                    : "bg-black text-white hover:opacity-90"
                }`}
              >
                Use Selection
              </button>
            </div>
          </div>
        )}
      />
    </>
  );
}
