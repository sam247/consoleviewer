"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type TrendFilter = "all" | "growing" | "decaying";

export interface DataTableRow {
  key: string;
  clicks: number;
  impressions: number;
  changePercent?: number;
}

interface DataTableProps {
  title: string;
  rows: DataTableRow[];
  maxRows?: number;
  className?: string;
  trendFilter?: TrendFilter;
  onTrendFilterChange?: (t: TrendFilter) => void;
  showFilter?: boolean;
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export function DataTable({
  title,
  rows,
  maxRows = 10,
  className,
  trendFilter: controlledTrend,
  onTrendFilterChange,
  showFilter = true,
}: DataTableProps) {
  const [internalTrend, setInternalTrend] = useState<TrendFilter>("all");
  const trend = controlledTrend ?? internalTrend;
  const setTrend = onTrendFilterChange ?? setInternalTrend;
  const showToggles = showFilter && (controlledTrend === undefined || onTrendFilterChange === undefined);

  const filtered = useMemo(() => {
    let list = rows;
    if (trend === "growing")
      list = list.filter((r) => (r.changePercent ?? 0) > 0);
    if (trend === "decaying")
      list = list.filter((r) => (r.changePercent ?? 0) < 0);
    return list.slice(0, maxRows);
  }, [rows, trend, maxRows]);

  return (
    <div className={cn("rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 p-0", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-semibold text-sm text-foreground">{title}</span>
        {showToggles && (
          <div className="flex gap-1">
            {(["all", "growing", "decaying"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTrend(t)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs capitalize transition-colors",
                  trend === t
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold text-right">Clicks</th>
              <th className="px-4 py-2 font-semibold text-right">Impressions</th>
              <th className="px-4 py-2 font-semibold text-right w-16">Change</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.key}
                className="border-b border-border/50 hover:bg-accent/50 transition-colors duration-150"
              >
                <td className="px-4 py-2 truncate max-w-[180px]" title={row.key}>
                  {row.key}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatNum(row.clicks)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatNum(row.impressions)}
                </td>
                <td className="px-4 py-2 text-right">
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
                      {row.changePercent > 0 ? "+" : ""}
                      {row.changePercent}%
                    </span>
                  ) : (
                    "–"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
