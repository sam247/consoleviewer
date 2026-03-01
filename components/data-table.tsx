"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type TrendFilter = "all" | "growing" | "decaying" | "new" | "lost";

export interface DataTableRow {
  key: string;
  clicks: number;
  impressions: number;
  changePercent?: number;
}

type SortKey = "key" | "clicks" | "impressions" | "changePercent";

interface DataTableProps {
  title: string;
  rows: DataTableRow[];
  maxRows?: number;
  className?: string;
  trendFilter?: TrendFilter;
  onTrendFilterChange?: (t: TrendFilter) => void;
  showFilter?: boolean;
}

const INITIAL_VISIBLE = 10;
const BODY_MAX_HEIGHT = 280;

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

interface DataTableViewProps {
  title: string;
  className?: string;
  showTrendToggles: boolean;
  trend: TrendFilter;
  setTrend: (t: TrendFilter) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  visibleRows: DataTableRow[];
  hasMore: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

function DataTableView({
  title,
  className,
  showTrendToggles,
  trend,
  setTrend,
  sortKey,
  sortDir,
  onSort,
  visibleRows,
  hasMore,
  expanded,
  onToggleExpand,
}: DataTableViewProps) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 p-0", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-semibold text-sm text-foreground">{title}</span>
        {showTrendToggles ? (
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
        ) : null}
      </div>
      <div className="overflow-x-auto min-w-0">
        <div className="overflow-y-auto" style={{ maxHeight: BODY_MAX_HEIGHT }}>
          <table className="w-full text-sm table-fixed">
            <thead className="sticky top-0 z-10 bg-surface border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-2 pb-2 font-semibold text-left min-w-0 w-[40%]">
                  <button type="button" onClick={() => onSort("key")} className="hover:text-foreground transition-colors flex items-center gap-1">
                    Name {sortKey === "key" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-2 pb-2 font-semibold text-right w-[20%]">
                  <button type="button" onClick={() => onSort("clicks")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Clicks {sortKey === "clicks" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-2 pb-2 font-semibold text-right w-[20%]">
                  <button type="button" onClick={() => onSort("impressions")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Impressions {sortKey === "impressions" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-2 pb-2 font-semibold text-right w-16">
                  <button type="button" onClick={() => onSort("changePercent")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Change {sortKey === "changePercent" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-border/50 hover:bg-accent/50 transition-colors duration-150"
                >
                  <td className="px-4 py-2 truncate min-w-0" title={row.key}>
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
        {hasMore ? (
          <div className="border-t border-border px-4 py-2 flex justify-center">
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? "View less" : "View more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DataTable({
  title,
  rows,
  maxRows: _maxRows = 10,
  className,
  trendFilter: controlledTrend,
  onTrendFilterChange,
  showFilter = true,
}: DataTableProps) {
  const [internalTrend, setInternalTrend] = useState<TrendFilter>("all");
  const trend = controlledTrend ?? internalTrend;
  const setTrend = onTrendFilterChange ?? setInternalTrend;
  const showToggles = showFilter && (controlledTrend === undefined || onTrendFilterChange === undefined);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    let list = rows;
    if (trend === "growing")
      list = list.filter((r) => (r.changePercent ?? 0) > 0);
    else if (trend === "decaying")
      list = list.filter((r) => (r.changePercent ?? 0) < 0);
    return list;
  }, [rows, trend]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (sortKey === "key") return dir * String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return dir * ((Number(aVal) ?? 0) - (Number(bVal) ?? 0));
    });
  }, [filtered, sortKey, sortDir]);

  const visibleRows = expanded ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const hasMore = sorted.length > INITIAL_VISIBLE;
  const showTrendToggles = showToggles && trend !== "new" && trend !== "lost";

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "key" ? "asc" : "desc");
    }
  };

  return (
    <DataTableView
      title={title}
      className={className}
      showTrendToggles={showTrendToggles}
      trend={trend}
      setTrend={setTrend}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      visibleRows={visibleRows}
      hasMore={hasMore}
      expanded={expanded}
      onToggleExpand={() => setExpanded((e) => !e)}
    />
  );
}
