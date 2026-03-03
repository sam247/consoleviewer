"use client";

import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

interface TableFullViewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: DataTableRow[];
  hasPosition: boolean;
  onExportCsv?: () => void;
}

export function TableFullViewModal({
  open,
  onClose,
  title,
  rows,
  hasPosition,
  onExportCsv,
}: TableFullViewModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="table-full-view-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] rounded-lg border border-border bg-surface shadow-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
          <h2 id="table-full-view-title" className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100 text-xs font-medium"
              >
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-muted-foreground hover:bg-accent transition-colors duration-[120ms]"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-auto min-h-0 flex-1">
          <table className={TABLE_BASE_CLASS}>
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th className={cn("px-4 font-semibold text-left", TABLE_CELL_Y, hasPosition ? "w-[35%]" : "w-[40%]")}>
                  Name
                </th>
                <th className={cn("px-4 font-semibold text-right", TABLE_CELL_Y, hasPosition ? "w-[16%]" : "w-[20%]")}>
                  Clicks
                </th>
                <th className={cn("px-4 font-semibold text-right", TABLE_CELL_Y, hasPosition ? "w-[20%]" : "w-[20%]")}>
                  Impr.
                </th>
                {hasPosition && (
                  <th className={cn("px-4 font-semibold text-right w-14", TABLE_CELL_Y)}>Pos</th>
                )}
                <th className={cn("px-4 font-semibold text-right w-16", TABLE_CELL_Y)}>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={hasPosition ? 5 : 4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No rows to display.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.key}
                    className={TABLE_ROW_CLASS}
                  >
                    <td className={cn("px-4 truncate min-w-0", TABLE_CELL_Y)} title={row.key}>
                      {row.key}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      {formatNum(row.clicks)}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      {formatNum(row.impressions)}
                    </td>
                    {hasPosition && (
                      <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                        {row.position != null ? row.position.toFixed(1) : "—"}
                      </td>
                    )}
                    <td className={cn("px-4 text-right", TABLE_CELL_Y)}>
                      {row.changePercent != null ? (
                        <span
                          className={cn(
                            "tabular-nums",
                            row.changePercent > 0
                              ? "text-positive"
                              : row.changePercent < 0
                                ? "text-negative"
                                : "text-muted-foreground"
                          )}
                        >
                          {row.changePercent > 0 ? "+" : ""}{row.changePercent}%
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
