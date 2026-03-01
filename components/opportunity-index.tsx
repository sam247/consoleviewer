"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";

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
function opportunityScore(row: DataTableRow): number {
  const pos = row.position;
  if (pos == null) return 0;
  const impr = row.impressions ?? 0;
  const actualCtr = impr > 0 ? (row.clicks / impr) * 100 : 0;
  const gap = positionGap(pos);
  const deficit = ctrDeficit(pos, actualCtr);
  return impr * gap * deficit;
}

interface OpportunityIndexProps {
  queries: DataTableRow[];
  className?: string;
}

export function OpportunityIndex({ queries, className }: OpportunityIndexProps) {
  const top5 = useMemo(() => {
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
    return withScore.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [queries]);

  if (top5.length === 0) return null;

  function formatNum(n: number): string {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.round(n));
  }

  return (
    <div className={cn("rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20", className)}>
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Opportunity index</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Top 5 by Impressions × position gap × CTR deficit
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="px-4 py-1.5 text-left font-semibold">Query</th>
              <th className="px-4 py-1.5 text-right font-semibold w-14">Pos</th>
              <th className="px-4 py-1.5 text-right font-semibold w-20">Impr.</th>
              <th className="px-4 py-1.5 text-right font-semibold w-14">CTR</th>
              <th className="px-4 py-1.5 text-right font-semibold w-16">Score</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((row, i) => (
              <tr key={row.key} className="border-b border-border/40 last:border-0 hover:bg-accent/50 transition-colors duration-100">
                <td className="px-4 py-1.5 truncate max-w-[200px]" title={row.key}>{row.key}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{row.position.toFixed(1)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatNum(row.impressions)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{row.ctr.toFixed(2)}%</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{formatNum(row.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
