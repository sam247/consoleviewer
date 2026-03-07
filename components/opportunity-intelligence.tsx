"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";
import { TableFullViewModal } from "@/components/table-full-view-modal";
import { RowTableCard } from "@/components/ui/row-table-card";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  TABLE_BASE_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

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

const ROWS_INITIAL = 10;

function oppRowToDataTableRow(r: OpportunityRow): DataTableRow {
  return {
    key: r.key,
    clicks: Math.round((r.impressions * r.ctr) / 100),
    impressions: r.impressions,
    position: r.position,
    changePercent: r.changePercent,
  };
}

type OppSortKey = "key" | "position" | "impressions" | "ctr" | "changePercent";

function OppTable({
  rows,
  emptyText,
  sectionTitle,
  onOpenFullView,
}: {
  rows: OpportunityRow[];
  emptyText: string;
  sectionTitle: string;
  onOpenFullView?: (title: string, rows: OpportunityRow[]) => void;
}) {
  const { sortKey, sortDir, onSort } = useTableSort<OppSortKey>("impressions");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "key") return dir * a.key.localeCompare(b.key);
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return dir * (Number(aVal) - Number(bVal));
    });
  }, [rows, sortKey, sortDir]);

  const visible = sorted.slice(0, ROWS_INITIAL);
  const hasMore = sorted.length > ROWS_INITIAL;
  const moreCount = hasMore ? sorted.length - ROWS_INITIAL : 0;

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 py-2">{emptyText}</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Query" column="key" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="min-w-0 w-[35%]" />
              <SortableHeader label="Pos" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-14" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-20" />
              <SortableHeader label="CTR" column="ctr" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
              <SortableHeader label="Change" column="changePercent" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className={TABLE_ROW_CLASS}>
                <td className={cn("px-4 truncate min-w-0", "py-2")} title={row.key}>
                  {row.key}
                </td>
                <td className={cn("px-4 text-right tabular-nums text-muted-foreground", "py-2")} title="Avg position">{row.position.toFixed(1)}</td>
                <td className={cn("px-4 text-right tabular-nums text-muted-foreground", "py-2")}>{formatNum(row.impressions)}</td>
                <td className={cn("px-4 text-right tabular-nums text-muted-foreground", "py-2")}>{row.ctr.toFixed(2)}%</td>
                <td className={cn("px-4 text-right tabular-nums", "py-2")}>
                  {row.changePercent != null ? (
                    <span className={cn(row.changePercent >= 0 ? "text-positive" : "text-negative")}>
                      {row.changePercent >= 0 ? "↑" : "↓"} {row.changePercent >= 0 ? "+" : ""}{row.changePercent}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && onOpenFullView && (
        <div className="border-t border-border px-4 py-2 flex justify-center">
          <button
            type="button"
            onClick={() => onOpenFullView(sectionTitle, rows)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
          >
            View {moreCount} more
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  bandLabel,
  count,
  open,
  onToggle,
}: {
  title: string;
  subtitle: string;
  bandLabel: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors duration-150 text-left"
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{bandLabel}</span>
        <span className="text-xs text-muted-foreground/80">{subtitle}</span>
        {count > 0 && (
          <span className="rounded-full bg-foreground/15 text-foreground px-2 py-0.5 text-xs tabular-nums font-medium">
            {count}
          </span>
        )}
      </div>
      <span className="text-muted-foreground text-xs shrink-0">{open ? "▲" : "▼"}</span>
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
      .sort((a, b) => b.impressions - a.impressions);
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
      .sort((a, b) => b.impressions - a.impressions);
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
      .sort((a, b) => b.impressions - a.impressions);
  }, [queries, medianImpr]);

  const [fullView, setFullView] = useState<{ title: string; rows: OpportunityRow[] } | null>(null);
  const handleOpenFullView = (title: string, rows: OpportunityRow[]) => {
    setFullView({ title, rows });
  };

  const totalOpps = page1Push.length + page2Opp.length + ctrLeak.length;

  return (
    <RowTableCard
      title={<span className="flex items-center gap-2 flex-wrap">Opportunity intelligence</span>}
      subtitle={totalOpps > 0 ? `${totalOpps} opportunities identified` : "No opportunities identified"}
      className={className}
    >

      {/* Page 1 Push */}
      <div className="border-b border-border/60">
        <SectionHeader
          title="Page 1 push"
          bandLabel="Pos 4–10"
          subtitle="Above-median impressions, stable or growing"
          count={page1Push.length}
          open={open.page1Push}
          onToggle={() => setOpen((s) => ({ ...s, page1Push: !s.page1Push }))}
        />
        {open.page1Push && (
          <OppTable
            rows={page1Push}
            emptyText="No page 1 push opportunities in the current date range."
            sectionTitle="Page 1 push"
            onOpenFullView={handleOpenFullView}
          />
        )}
      </div>

      {/* Page 2 Opportunity */}
      <div className="border-b border-border/60">
        <SectionHeader
          title="Page 2 opportunity"
          bandLabel="Pos 11–20"
          subtitle="High impressions"
          count={page2Opp.length}
          open={open.page2Opp}
          onToggle={() => setOpen((s) => ({ ...s, page2Opp: !s.page2Opp }))}
        />
        {open.page2Opp && (
          <OppTable
            rows={page2Opp}
            emptyText="No page 2 opportunities in the current date range."
            sectionTitle="Page 2 opportunity"
            onOpenFullView={handleOpenFullView}
          />
        )}
      </div>

      {/* CTR Leak */}
      <div>
        <SectionHeader
          title="CTR leak"
          bandLabel="Pos 1–5"
          subtitle="High impressions, CTR below band benchmark"
          count={ctrLeak.length}
          open={open.ctrLeak}
          onToggle={() => setOpen((s) => ({ ...s, ctrLeak: !s.ctrLeak }))}
        />
        {open.ctrLeak && (
          <OppTable
            rows={ctrLeak}
            emptyText="No CTR leaks detected in the current date range."
            sectionTitle="CTR leak"
            onOpenFullView={handleOpenFullView}
          />
        )}
      </div>

      {fullView && (
        <TableFullViewModal
          open={!!fullView}
          onClose={() => setFullView(null)}
          title={fullView.title}
          rows={fullView.rows.map(oppRowToDataTableRow)}
          hasPosition
        />
      )}
    </RowTableCard>
  );
}
