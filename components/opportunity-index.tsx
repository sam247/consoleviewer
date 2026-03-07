"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { classifyQuery } from "@/lib/ai-query-detection";
import type { DataTableRow } from "@/components/data-table";
import { InfoTooltip } from "@/components/info-tooltip";
import { TableFullViewModal } from "@/components/table-full-view-modal";
import { exportToCsv } from "@/lib/export-csv";
import { RowTableCard } from "@/components/ui/row-table-card";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

const CTR_BENCHMARKS: Record<number, number> = {
  1: 28, 2: 15, 3: 11, 4: 8, 5: 7, 6: 6, 7: 5, 8: 5, 9: 4, 10: 3,
};

function getBenchmarkCtr(position: number): number {
  const rounded = Math.min(10, Math.max(1, Math.round(position)));
  return CTR_BENCHMARKS[rounded] ?? 2;
}

/** Position gap: room to improve (e.g. slots to top 10 or top 3). */
function positionGap(position: number): number {
  if (position <= 10) return Math.max(0, 11 - position);
  if (position <= 20) return Math.max(0, 21 - position);
  return 0;
}

/** CTR deficit vs benchmark (percentage points). */
function ctrDeficit(position: number, actualCtr: number): number {
  const benchmark = getBenchmarkCtr(position);
  return Math.max(0, benchmark - actualCtr);
}

/** Opportunity score = Impressions × Position Gap × CTR Deficit (raw; scale for display). */
/** Optional boost (1.1×) for conversational queries in position 4–15 to surface them slightly higher. */
function opportunityScore(row: DataTableRow): number {
  const pos = row.position;
  if (pos == null) return 0;
  const impr = row.impressions ?? 0;
  const actualCtr = impr > 0 ? (row.clicks / impr) * 100 : 0;
  const gap = positionGap(pos);
  const deficit = ctrDeficit(pos, actualCtr);
  let score = impr * gap * deficit;
  const c = classifyQuery(row.key);
  if ((c === "conversational" || c === "both") && pos >= 4 && pos <= 15) {
    score *= 1.1;
  }
  return score;
}

interface OpportunityIndexProps {
  queries: DataTableRow[];
  className?: string;
  /** Optional base filename for CSV export (without .csv) */
  exportFilename?: string;
  sourceEngine?: "google" | "bing";
}

const ROWS_INITIAL = 10;

type OppSortKey = "key" | "position" | "impressions" | "ctr" | "score";

function EngineChip({ engine }: { engine: "google" | "bing" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
        engine === "google" ? "bg-[#4285f4]/12 text-[#4285f4]" : "bg-[#008373]/12 text-[#008373]"
      )}
    >
      {engine === "google" ? "Google" : "Bing"}
    </span>
  );
}

export function OpportunityIndex({ queries, className, exportFilename, sourceEngine = "google" }: OpportunityIndexProps) {
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { sortKey, sortDir, onSort } = useTableSort<OppSortKey>("score");

  const allRows = useMemo(() => {
    const withScore = queries
      .filter((r) => r.position != null && r.impressions > 0)
      .map((r) => ({
        key: r.key,
        position: r.position!,
        impressions: r.impressions,
        ctr: (r.clicks / r.impressions) * 100,
        score: opportunityScore(r),
      }))
      .filter((r) => r.score > 0);
    const dir = sortDir === "asc" ? 1 : -1;
    return withScore.sort((a, b) => {
      if (sortKey === "key") return dir * a.key.localeCompare(b.key);
      return dir * (a[sortKey] - b[sortKey]);
    });
  }, [queries, sortKey, sortDir]);

  const visibleRows = allRows.slice(0, ROWS_INITIAL);
  const hasMore = allRows.length > ROWS_INITIAL;
  const moreCount = hasMore ? allRows.length - ROWS_INITIAL : 0;

  const modalRows: DataTableRow[] = useMemo(
    () =>
      allRows.map((r) => ({
        key: r.key,
        clicks: Math.round((r.impressions * r.ctr) / 100),
        impressions: r.impressions,
        position: r.position,
      })),
    [allRows]
  );

  if (allRows.length === 0) return null;

  const selected = selectedKey ? allRows.find((r) => r.key === selectedKey) ?? null : null;

  function formatNum(n: number): string {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.round(n));
  }

  const handleExport = () => {
    if (!exportFilename) return;
    exportToCsv(
      allRows.map((r) => ({
        key: r.key,
        position: r.position,
        impressions: r.impressions,
        ctr: r.ctr.toFixed(2),
        score: Math.round(r.score),
      })),
      exportFilename + ".csv"
    );
  };

  return (
    <>
      <RowTableCard
        title={<span className="flex items-center gap-2 flex-wrap">Opportunity index<InfoTooltip title="Opportunity score = impressions × ranking potential." /><EngineChip engine={sourceEngine} /></span>}
        subtitle={`Top ${ROWS_INITIAL} by Impressions × position gap × CTR deficit`}
        className={className}
        headerRight={
          allRows.length > 0 && exportFilename ? (
            <button
              type="button"
              onClick={handleExport}
              className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
              title="Export CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
          ) : undefined
        }
        footer={
          hasMore ? (
            <button
              type="button"
              onClick={() => setFullViewOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
            >
              View {moreCount} more
            </button>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className={TABLE_BASE_CLASS}>
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <SortableHeader label="Query" column="key" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="min-w-0 w-[35%]" />
                <SortableHeader label="Pos" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-14" />
                <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-20" />
                <SortableHeader label="CTR" column="ctr" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-14" />
                <SortableHeader label="Score" column="score" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    TABLE_ROW_CLASS,
                    "cursor-pointer border-l-2 border-l-transparent hover:bg-accent/70",
                    selectedKey === row.key && "border-l-chart-clicks bg-accent/40"
                  )}
                  onClick={() => setSelectedKey(row.key)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedKey(row.key)}
                >
                  <td className={cn("px-4 truncate min-w-0", TABLE_CELL_Y)} title={row.key}>{row.key}</td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>{row.position.toFixed(1)}</td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>{formatNum(row.impressions)}</td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>{row.ctr.toFixed(2)}%</td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>{formatNum(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Opportunity analysis: <span className="text-foreground font-medium">{selected.key}</span> · pos {selected.position.toFixed(1)} · {formatNum(selected.impressions)} impr. · {selected.ctr.toFixed(2)}% CTR
          </div>
        )}
      </RowTableCard>
      <TableFullViewModal
        open={fullViewOpen}
        onClose={() => setFullViewOpen(false)}
        title="Opportunity index"
        rows={modalRows}
        hasPosition
        onExportCsv={exportFilename ? handleExport : undefined}
      />
    </>
  );
}
