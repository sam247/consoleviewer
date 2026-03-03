"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { classifyQuery } from "@/lib/ai-query-detection";
import type { DataTableRow } from "@/components/data-table";
import { TableFullViewModal } from "@/components/table-full-view-modal";
import { exportToCsv } from "@/lib/export-csv";

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
}

const ROWS_INITIAL = 10;

export function OpportunityIndex({ queries, className, exportFilename }: OpportunityIndexProps) {
  const [fullViewOpen, setFullViewOpen] = useState(false);
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
    return withScore.sort((a, b) => b.score - a.score);
  }, [queries]);

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
      <div className={cn("rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20", className)}>
        <div className="border-b border-border px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Opportunity index</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top {ROWS_INITIAL} by Impressions × position gap × CTR deficit
            </p>
          </div>
          {allRows.length > 0 && exportFilename && (
            <button
              type="button"
              onClick={handleExport}
              className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
              title="Export CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-surface border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-1.5 pb-1.5 font-semibold min-w-0 w-[35%]">Query</th>
                <th className="text-right px-4 py-1.5 pb-1.5 font-semibold w-14">Pos</th>
                <th className="text-right px-4 py-1.5 pb-1.5 font-semibold w-20">Impr.</th>
                <th className="text-right px-4 py-1.5 pb-1.5 font-semibold w-14">CTR</th>
                <th className="text-right px-4 py-1.5 pb-1.5 font-semibold w-16">Score</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-b-0 hover:bg-muted/50 transition-colors duration-100">
                  <td className="px-4 py-1.5 truncate min-w-0" title={row.key}>{row.key}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{row.position.toFixed(1)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatNum(row.impressions)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{row.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatNum(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-border px-4 py-2 flex justify-center">
            <button
              type="button"
              onClick={() => setFullViewOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
            >
              View {moreCount} more
            </button>
          </div>
        )}
      </div>
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
