"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { classifyQuery } from "@/lib/ai-query-detection";

export type TrendFilter = "all" | "growing" | "decaying" | "new" | "lost" | "highImprLowCtr" | "longForm" | "conversational";

export interface DataTableRow {
  key: string;
  clicks: number;
  impressions: number;
  changePercent?: number;
  position?: number;
}

type SortKey = "key" | "clicks" | "impressions" | "changePercent" | "position";

interface DataTableProps {
  title: string;
  rows: DataTableRow[];
  maxRows?: number;
  className?: string;
  trendFilter?: TrendFilter;
  onTrendFilterChange?: (t: TrendFilter) => void;
  showFilter?: boolean;
  /** When set, rows are clickable and this is called on row click (e.g. open detail drawer) */
  onRowClick?: (row: DataTableRow) => void;
  /** When set, an export CSV icon is shown in the header; callback should trigger CSV download */
  onExportCsv?: () => void;
}

const INITIAL_VISIBLE = 10;
const BODY_MAX_HEIGHT = 300;

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function medianVal(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const FILTER_LABELS: Record<TrendFilter, string> = {
  all: "All",
  growing: "Growing",
  decaying: "Decaying",
  new: "New",
  lost: "Lost",
  highImprLowCtr: "High impr / Low CTR",
  longForm: "Long-form",
  conversational: "Conversational",
};

interface DataTableViewProps {
  title: string;
  className?: string;
  showFilterBar: boolean;
  trend: TrendFilter;
  setTrend: (t: TrendFilter) => void;
  hasPosition: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  visibleRows: DataTableRow[];
  hasMore: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRowClick?: (row: DataTableRow) => void;
  onExportCsv?: () => void;
}

function DataTableView({
  title,
  className,
  showFilterBar,
  trend,
  setTrend,
  hasPosition,
  sortKey,
  sortDir,
  onSort,
  visibleRows,
  hasMore,
  expanded,
  onToggleExpand,
  onRowClick,
  onExportCsv,
}: DataTableViewProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    if (exportMenuOpen) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [exportMenuOpen]);
  const filterOptions: TrendFilter[] = hasPosition
    ? ["all", "growing", "decaying", "new", "lost", "highImprLowCtr", "longForm", "conversational"]
    : ["all", "growing", "decaying", "new", "lost", "longForm", "conversational"];

  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-surface overflow-hidden transition-transform duration-[120ms] hover:border-foreground/20 hover:scale-[1.01] transform-gpu p-0", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 gap-2 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-sm text-foreground">{title}</span>
          {onExportCsv && (
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((o) => !o)}
                className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms]"
                title="Export"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
              {exportMenuOpen && (
                <div className="absolute left-0 top-full mt-0.5 z-20 min-w-[100px] rounded border border-border bg-surface py-1 shadow-lg">
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    onClick={() => { onExportCsv(); setExportMenuOpen(false); }}
                  >
                    Export CSV
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {showFilterBar && trend !== "new" && trend !== "lost" && (
          <div className="flex flex-wrap gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
            {filterOptions.filter((t) => t !== "new" && t !== "lost").map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTrend(t)}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors duration-[120ms] whitespace-nowrap",
                  trend === t
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {FILTER_LABELS[t]}
              </button>
            ))}
          </div>
        )}
        {showFilterBar && (trend === "new" || trend === "lost") && (
          <div className="flex gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setTrend("all")}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors duration-[120ms]"
            >
              ← All
            </button>
            <span className={cn(
              "rounded px-2 py-1 text-xs font-medium capitalize bg-foreground text-background"
            )}>
              {FILTER_LABELS[trend]}
            </span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto min-w-0">
        <div className="overflow-y-auto" style={{ maxHeight: BODY_MAX_HEIGHT }}>
          <table className="w-full text-sm table-fixed">
            <thead className="sticky top-0 z-10 bg-surface border-b border-border text-muted-foreground">
              <tr>
                <th className={cn("px-4 py-1.5 pb-1.5 font-semibold text-left min-w-0", hasPosition ? "w-[35%]" : "w-[40%]")}>
                  <button type="button" onClick={() => onSort("key")} className="hover:text-foreground transition-colors flex items-center gap-1">
                    Name {sortKey === "key" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className={cn("px-4 py-1.5 pb-1.5 font-semibold text-right", hasPosition ? "w-[16%]" : "w-[20%]")}>
                  <button type="button" onClick={() => onSort("clicks")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Clicks {sortKey === "clicks" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className={cn("px-4 py-1.5 pb-1.5 font-semibold text-right", hasPosition ? "w-[20%]" : "w-[20%]")}>
                  <button type="button" onClick={() => onSort("impressions")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Impr. {sortKey === "impressions" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                {hasPosition && (
                  <th className="px-4 py-1.5 pb-1.5 font-semibold text-right w-14">
                    <button type="button" onClick={() => onSort("position")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                      Pos {sortKey === "position" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-1.5 pb-1.5 font-semibold text-right w-16">
                  <button type="button" onClick={() => onSort("changePercent")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Change {sortKey === "changePercent" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={hasPosition ? 5 : 4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No rows match the current filter.
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-border/50 transition-all duration-[120ms]",
                    onRowClick && "cursor-pointer hover:border-l-2 hover:border-l-chart-clicks border-l-transparent",
                    "hover:bg-accent/50"
                  )}
                  onClick={() => onRowClick?.(row)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
                >
                  <td className="px-4 py-1.5 truncate min-w-0" title={row.key}>
                    {row.key}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatNum(row.clicks)}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatNum(row.impressions)}
                  </td>
                  {hasPosition && (
                    <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.position != null ? row.position.toFixed(1) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-1.5 text-right">
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
              className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {expanded ? "View less" : `View ${INITIAL_VISIBLE} more`}
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
  onRowClick,
  onExportCsv,
}: DataTableProps) {
  const [internalTrend, setInternalTrend] = useState<TrendFilter>("all");
  const trend = controlledTrend ?? internalTrend;
  const setTrend = onTrendFilterChange ?? setInternalTrend;
  const showFilterBar = showFilter;
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState(false);

  const hasPosition = useMemo(() => rows.some((r) => r.position != null), [rows]);

  const medianImpr = useMemo(() => medianVal(rows.map((r) => r.impressions)), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (trend === "growing")
      list = list.filter((r) => (r.changePercent ?? 0) > 0);
    else if (trend === "decaying")
      list = list.filter((r) => (r.changePercent ?? 0) < 0);
    else if (trend === "highImprLowCtr")
      list = list.filter((r) => {
        if (r.impressions <= medianImpr) return false;
        const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
        return ctr < 0.03;
      });
    else if (trend === "longForm") {
      list = list.filter((r) => {
        const c = classifyQuery(r.key);
        return c === "long" || c === "both";
      });
    } else if (trend === "conversational") {
      list = list.filter((r) => {
        const c = classifyQuery(r.key);
        return c === "conversational" || c === "both";
      });
    }
    return list;
  }, [rows, trend, medianImpr]);

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "key" || key === "position" ? "asc" : "desc");
    }
  };

  return (
    <DataTableView
      title={title}
      className={className}
      showFilterBar={showFilterBar}
      trend={trend}
      setTrend={setTrend}
      hasPosition={hasPosition}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      visibleRows={visibleRows}
      hasMore={hasMore}
      expanded={expanded}
      onToggleExpand={() => setExpanded((e) => !e)}
      onRowClick={onRowClick}
      onExportCsv={onExportCsv}
    />
  );
}
