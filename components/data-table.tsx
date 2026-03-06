"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { classifyQuery } from "@/lib/ai-query-detection";
import { InfoTooltip } from "@/components/info-tooltip";
import { TableFullViewModal } from "@/components/table-full-view-modal";
import { RowTableCard } from "@/components/ui/row-table-card";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";
import { PositionSparkline } from "@/components/position-sparkline";

export type TrendFilter = "all" | "growing" | "decaying" | "new" | "lost" | "highImprLowCtr" | "longForm" | "conversational";

export interface DataTableRow {
  key: string;
  clicks: number;
  impressions: number;
  changePercent?: number;
  position?: number;
  /** SERP feature appearances (e.g. RICH_RESULT, VIDEO) for badge display */
  appearances?: string[];
}

type SortKey = "key" | "clicks" | "impressions" | "changePercent" | "position";

export interface DataTableProps {
  title: string;
  /** Optional tooltip text for the section title (shows muted "i" icon) */
  titleTooltip?: string;
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
  /** When true (default), "View X more" opens a scrollable modal with full table and export; when false, expands inline */
  expandInModal?: boolean;
  /** Optional: query key -> daily position array for sparkline column (queries table only) */
  sparklines?: Record<string, number[]>;
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
  titleTooltip?: string;
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
  moreCount: number;
  onRowClick?: (row: DataTableRow) => void;
  onExportCsv?: () => void;
  /** When set, "View X more" calls this instead of onToggleExpand (opens full-view modal) */
  onOpenFullView?: () => void;
  sparklines?: Record<string, number[]>;
}

function DataTableView({
  title,
  titleTooltip,
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
  moreCount,
  onRowClick,
  onExportCsv,
  onOpenFullView,
  sparklines,
}: DataTableViewProps) {
  const hasSparklines = Boolean(sparklines && Object.keys(sparklines).length > 0);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    if (exportMenuOpen) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [exportMenuOpen]);

  useEffect(() => {
    setActiveRowIndex(0);
  }, [visibleRows.length]);
  const filterOptions: TrendFilter[] = hasPosition
    ? ["all", "growing", "decaying", "new", "lost", "highImprLowCtr", "longForm", "conversational"]
    : ["all", "growing", "decaying", "new", "lost", "longForm", "conversational"];

  return (
    <RowTableCard
      title={<span className="flex items-center gap-1">{title}{titleTooltip && <InfoTooltip title={titleTooltip} />}</span>}
      className={className}
      headerRight={
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {showFilterBar && trend !== "new" && trend !== "lost" && (
            <div className="flex flex-wrap gap-0.5 rounded-md border border-input bg-background p-0.5">
              {filterOptions.filter((t) => t !== "new" && t !== "lost").map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrend(t)}
                  className={cn(
                    "rounded px-2 py-1 text-xs transition-colors duration-[120ms] whitespace-nowrap",
                    trend === t
                      ? "bg-background text-foreground font-medium border border-input"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {FILTER_LABELS[t]}
                </button>
              ))}
            </div>
          )}
          {showFilterBar && (trend === "new" || trend === "lost") && (
            <div className="flex gap-0.5 rounded-md border border-input bg-background p-0.5">
              <button
                type="button"
                onClick={() => setTrend("all")}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors duration-[120ms]"
              >
                ← All
              </button>
              <span className={cn(
                "rounded px-2 py-1 text-xs font-medium capitalize bg-background text-foreground border border-input"
              )}>
                {FILTER_LABELS[trend]}
              </span>
            </div>
          )}
          {onExportCsv && (
            <div className="relative shrink-0" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((o) => !o)}
                className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
                title="Export"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-0.5 z-20 min-w-[100px] rounded border border-border bg-surface py-1 shadow-lg">
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
      }
      footer={
        hasMore ? (
          <button
            type="button"
            onClick={onOpenFullView ?? onToggleExpand}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
          >
            {onOpenFullView ? "View full report →" : expanded ? "View less" : `View ${moreCount} more`}
          </button>
        ) : undefined
      }
    >
      <div className="overflow-x-auto min-w-0">
        <div className="overflow-y-auto" style={{ maxHeight: BODY_MAX_HEIGHT }}>
          <table className={TABLE_BASE_CLASS}>
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th className={cn("px-4 font-semibold text-left min-w-0", TABLE_CELL_Y)}>
                  <button type="button" onClick={() => onSort("key")} className="hover:text-foreground transition-colors flex items-center gap-1">
                    Name {sortKey === "key" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className={cn("px-4 font-semibold text-right w-[80px]", TABLE_CELL_Y)}>
                  <button type="button" onClick={() => onSort("clicks")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Clicks {sortKey === "clicks" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className={cn("px-4 font-semibold text-right w-[110px]", TABLE_CELL_Y)}>
                  <button type="button" onClick={() => onSort("impressions")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Impr. {sortKey === "impressions" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                {hasPosition && (
                  <th className={cn("px-4 font-semibold text-right w-[70px]", TABLE_CELL_Y)}>
                    <button type="button" onClick={() => onSort("position")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                      Pos {sortKey === "position" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                )}
                {hasSparklines && (
                  <th className={cn("px-2 font-semibold text-right w-[60px]", TABLE_CELL_Y)} title="Position trend">
                    <span className="text-muted-foreground">Trend</span>
                  </th>
                )}
                <th className={cn("px-4 font-semibold text-right w-[70px]", TABLE_CELL_Y)}>
                  <button type="button" onClick={() => onSort("changePercent")} className="ml-auto block w-full text-right hover:text-foreground transition-colors">
                    Change {sortKey === "changePercent" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={hasPosition ? (hasSparklines ? 6 : 5) : hasSparklines ? 5 : 4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No ranking signals detected in this range.
                  </td>
                </tr>
              )}
              {visibleRows.map((row, rowIndex) => (
                <tr
                  key={row.key}
                  ref={(el) => {
                    rowRefs.current[rowIndex] = el;
                  }}
                  className={cn(
                    TABLE_ROW_CLASS,
                    onRowClick && "cursor-pointer border-l-2 border-l-transparent focus-visible:bg-accent/60 focus-visible:border-l-chart-clicks"
                  )}
                  onClick={() => onRowClick?.(row)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onFocus={() => setActiveRowIndex(rowIndex)}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === "Enter") {
                      onRowClick(row);
                      return;
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      const next = Math.min(visibleRows.length - 1, rowIndex + 1);
                      rowRefs.current[next]?.focus();
                      setActiveRowIndex(next);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      const prev = Math.max(0, rowIndex - 1);
                      rowRefs.current[prev]?.focus();
                      setActiveRowIndex(prev);
                    }
                  } : undefined}
                  aria-selected={onRowClick ? activeRowIndex === rowIndex : undefined}
                >
                  <td className={cn("px-4 min-w-0", TABLE_CELL_Y)} title={row.key}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{row.key}</span>
                      {row.appearances && row.appearances.length > 0 && (
                        <span className="flex shrink-0 gap-0.5">
                          {row.appearances.slice(0, 3).map((a) => (
                            <span
                              key={a}
                              className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground"
                              title={a}
                            >
                              {a === "RICH_RESULT" ? "Snippet" : a === "VIDEO" ? "Video" : a === "AMP_BLUE_LINK" ? "AMP" : a.replace(/_/g, " ").slice(0, 8)}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
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
                  {hasSparklines && (
                    <td className={cn("px-2 text-right align-middle", TABLE_CELL_Y)}>
                      {sparklines?.[row.key] ? <PositionSparkline positions={sparklines[row.key]} /> : "—"}
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
    </RowTableCard>
  );
}

export function DataTable({
  title,
  titleTooltip,
  rows,
  maxRows: _maxRows = 10,
  className,
  trendFilter: controlledTrend,
  onTrendFilterChange,
  showFilter = true,
  onRowClick,
  onExportCsv,
  expandInModal = true,
  sparklines,
}: DataTableProps) {
  const [internalTrend, setInternalTrend] = useState<TrendFilter>("all");
  const trend = controlledTrend ?? internalTrend;
  const setTrend = onTrendFilterChange ?? setInternalTrend;
  const showFilterBar = showFilter;
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);

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

  const maxRows = _maxRows ?? INITIAL_VISIBLE;
  const visibleRows = expanded ? sorted : sorted.slice(0, maxRows);
  const hasMore = sorted.length > maxRows;
  const moreCount = hasMore ? sorted.length - maxRows : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "key" || key === "position" ? "asc" : "desc");
    }
  };

  return (
    <>
      <DataTableView
        title={title}
        titleTooltip={titleTooltip}
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
        moreCount={moreCount}
        onRowClick={onRowClick}
        onExportCsv={onExportCsv}
        onOpenFullView={expandInModal ? () => setFullViewOpen(true) : undefined}
        sparklines={sparklines}
      />
      <TableFullViewModal
        open={fullViewOpen}
        onClose={() => setFullViewOpen(false)}
        title={title}
        rows={sorted}
        hasPosition={hasPosition}
        onExportCsv={onExportCsv}
      />
    </>
  );
}
