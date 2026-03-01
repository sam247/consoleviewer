"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";

interface OpportunityRow {
  key: string;
  position: number;
  impressions: number;
  ctr: number;
  changePercent?: number;
}

interface SectionState {
  page1Push: boolean;
  page2Opp: boolean;
  ctrLeak: boolean;
}

const CTR_BENCHMARKS: Record<number, number> = {
  1: 28, 2: 15, 3: 11, 4: 8, 5: 7, 6: 6, 7: 5, 8: 5, 9: 4, 10: 3,
};

function getBenchmarkCtr(position: number): number {
  const rounded = Math.min(10, Math.max(1, Math.round(position)));
  return CTR_BENCHMARKS[rounded] ?? 2;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
}

function OppTable({
  rows,
  emptyText,
}: {
  rows: OpportunityRow[];
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 5);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 pb-3">{emptyText}</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold">Query</th>
              <th className="px-4 py-2 text-right font-semibold w-14">Pos</th>
              <th className="px-4 py-2 text-right font-semibold w-20">Impressions</th>
              <th className="px-4 py-2 text-right font-semibold w-16">CTR</th>
              <th className="px-4 py-2 text-right font-semibold w-16">Change</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className="border-b border-border/40 last:border-0 hover:bg-accent/40 transition-colors">
                <td className="px-4 py-2 truncate max-w-[220px]" title={row.key}>
                  {row.key}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{row.position.toFixed(1)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatNum(row.impressions)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.ctr.toFixed(2)}%</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.changePercent != null ? (
                    <span className={cn(row.changePercent >= 0 ? "text-positive" : "text-negative")}>
                      {row.changePercent >= 0 ? "+" : ""}{row.changePercent}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <div className="border-t border-border/50 px-4 py-2 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "View less" : `View ${rows.length - 5} more`}
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
  open,
  onToggle,
}: {
  title: string;
  subtitle: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors text-left"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
        {count > 0 && (
          <span className="rounded-full bg-foreground/10 text-foreground px-1.5 py-0.5 text-xs tabular-nums font-medium">
            {count}
          </span>
        )}
      </div>
      <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
    </button>
  );
}

interface OpportunityIntelligenceProps {
  queries: DataTableRow[];
  className?: string;
}

export function OpportunityIntelligence({ queries, className }: OpportunityIntelligenceProps) {
  const [open, setOpen] = useState<SectionState>({ page1Push: true, page2Opp: false, ctrLeak: false });

  const allImpressions = useMemo(() => queries.map((r) => r.impressions), [queries]);
  const medianImpr = useMemo(() => median(allImpressions), [allImpressions]);
  const p75Impr = useMemo(() => percentile(allImpressions, 75), [allImpressions]);

  const page1Push = useMemo<OpportunityRow[]>(() => {
    return queries
      .filter(
        (r) =>
          r.position != null &&
          r.position >= 4 &&
          r.position <= 10 &&
          r.impressions > medianImpr &&
          (r.changePercent ?? 0) >= 0
      )
      .map((r) => ({
        key: r.key,
        position: r.position!,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
        changePercent: r.changePercent,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);
  }, [queries, medianImpr]);

  const page2Opp = useMemo<OpportunityRow[]>(() => {
    return queries
      .filter(
        (r) =>
          r.position != null &&
          r.position >= 11 &&
          r.position <= 20 &&
          r.impressions >= p75Impr
      )
      .map((r) => ({
        key: r.key,
        position: r.position!,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
        changePercent: r.changePercent,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);
  }, [queries, p75Impr]);

  const ctrLeak = useMemo<OpportunityRow[]>(() => {
    return queries
      .filter((r) => {
        if (r.position == null || r.position > 5) return false;
        if (r.impressions <= medianImpr) return false;
        const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
        const benchmark = getBenchmarkCtr(r.position);
        return ctr < benchmark * 0.7;
      })
      .map((r) => ({
        key: r.key,
        position: r.position!,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
        changePercent: r.changePercent,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);
  }, [queries, medianImpr]);

  const totalOpps = page1Push.length + page2Opp.length + ctrLeak.length;

  return (
    <div className={cn("rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Opportunity intelligence</span>
          {totalOpps > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{totalOpps} opportunities identified</span>
          )}
        </div>
      </div>

      {/* Page 1 Push */}
      <div className="border-b border-border/60">
        <SectionHeader
          title="Page 1 push"
          subtitle="Position 4–10, above-median impressions, stable or growing"
          count={page1Push.length}
          open={open.page1Push}
          onToggle={() => setOpen((s) => ({ ...s, page1Push: !s.page1Push }))}
        />
        {open.page1Push && (
          <OppTable
            rows={page1Push}
            emptyText="No page 1 push opportunities in the current date range."
          />
        )}
      </div>

      {/* Page 2 Opportunity */}
      <div className="border-b border-border/60">
        <SectionHeader
          title="Page 2 opportunity"
          subtitle="Position 11–20, high impressions"
          count={page2Opp.length}
          open={open.page2Opp}
          onToggle={() => setOpen((s) => ({ ...s, page2Opp: !s.page2Opp }))}
        />
        {open.page2Opp && (
          <OppTable
            rows={page2Opp}
            emptyText="No page 2 opportunities in the current date range."
          />
        )}
      </div>

      {/* CTR Leak */}
      <div>
        <SectionHeader
          title="CTR leak"
          subtitle="Position 1–5, high impressions, CTR below band benchmark"
          count={ctrLeak.length}
          open={open.ctrLeak}
          onToggle={() => setOpen((s) => ({ ...s, ctrLeak: !s.ctrLeak }))}
        />
        {open.ctrLeak && (
          <OppTable
            rows={ctrLeak}
            emptyText="No CTR leaks detected in the current date range."
          />
        )}
      </div>
    </div>
  );
}
