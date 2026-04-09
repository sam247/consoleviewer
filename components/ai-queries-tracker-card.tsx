"use client";

import { useMemo, useState } from "react";
import type { DataTableRow } from "@/components/data-table";
import { isConversational, isLongForm } from "@/lib/ai-query-detection";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ReportModal } from "@/components/report-modal";
import { exportToCsv } from "@/lib/export-csv";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

type ClusterRow = {
  label: string;
  clicks: number;
  impressions: number;
  changePercent?: number;
  count: number;
};

function normalizeHost(host: string): string[] {
  return host
    .toLowerCase()
    .replace(/^www\./, "")
    .split(/[\.-]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !["shop", "store", "online"].includes(t));
}

function isComparison(q: string): boolean {
  return /\b(vs|versus|compare|comparison|difference between)\b/i.test(q);
}

function isCommercial(q: string): boolean {
  return /\b(buy|price|cost|deal|discount|coupon|cheap|best|top|review|reviews|sale)\b/i.test(q);
}

function isProblem(q: string): boolean {
  return /\b(fix|error|issue|problem|not working|broken|doesn't|won't|troubleshoot)\b/i.test(q);
}

function isQuestion(q: string): boolean {
  const start = /^(how|what|why|when|where|who|can|should|is|are|does|do|which)\b/i;
  return start.test(q) || isConversational(q);
}

function clusterKey(query: string, brandTokens: string[]): string | null {
  const q = query.trim();
  if (!q) return null;
  if (isLongForm(q)) return "long-form";
  if (isQuestion(q)) return "Questions";
  if (isComparison(q)) return "Comparisons";
  if (isCommercial(q)) return "Commercial";
  if (isProblem(q)) return "Problem-based";
  if (brandTokens.length > 0 && brandTokens.some((t) => q.toLowerCase().includes(t))) return "Brand / product";
  return null;
}

function formatSignedPercent(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const v = Math.round(value);
  const arrow = v > 0 ? "↑" : v < 0 ? "↓" : "→";
  return `${arrow} ${v >= 0 ? "+" : ""}${v}%`;
}

type TrendsSortKey = "label" | "impressions" | "changePercent";

export function AiQueriesTrackerCard({
  queries,
  siteUrl,
  maxRows = 8,
  className,
}: {
  queries: DataTableRow[];
  siteUrl?: string;
  maxRows?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const { sortKey, sortDir, onSort } = useTableSort<TrendsSortKey>("impressions");

  const allRows = useMemo(() => {
    const brandTokens = (() => {
      if (!siteUrl) return [] as string[];
      try {
        const u = new URL(siteUrl);
        return normalizeHost(u.hostname);
      } catch {
        return [] as string[];
      }
    })();
    const clusters = new Map<string, { clicks: number; impressions: number; count: number; change: Array<{ w: number; v: number }> }>();
    for (const q of queries) {
      const key = clusterKey(q.key, brandTokens);
      if (!key) continue;
      const cur = clusters.get(key) ?? { clicks: 0, impressions: 0, count: 0, change: [] };
      cur.clicks += q.clicks;
      cur.impressions += q.impressions;
      cur.count += 1;
      if (q.changePercent != null) {
        const w = Math.max(1, q.impressions || q.clicks || 1);
        cur.change.push({ w, v: q.changePercent });
      }
      clusters.set(key, cur);
    }
    const out: ClusterRow[] = Array.from(clusters.entries()).map(([label, agg]) => {
      const totalW = agg.change.reduce((s, x) => s + x.w, 0);
      const avg = totalW > 0 ? agg.change.reduce((s, x) => s + x.w * x.v, 0) / totalW : undefined;
      return { label, clicks: agg.clicks, impressions: agg.impressions, changePercent: avg, count: agg.count };
    });
    return out;
  }, [queries, siteUrl]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => r.label.toLowerCase().includes(q));
  }, [allRows, filter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "label") return dir * a.label.localeCompare(b.label);
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return dir * (Number(aVal) - Number(bVal));
    });
  }, [filtered, sortDir, sortKey]);

  const rows = useMemo(() => sorted.slice(0, maxRows), [maxRows, sorted]);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Search trends</span>}
      subtitle="Search intent trends based on query patterns"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            View full report
          </button>
        </div>
      }
      className={cn("min-w-0 min-h-[360px]", className)}
    >
      <div className="max-h-[280px] overflow-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Segment" column="label" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[60%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[20%]" />
              <SortableHeader label="Change" column="changePercent" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[20%]" />
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.label} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.label}>
                    <span className="truncate">{r.label}</span>
                  </td>
                  <td className={cn("px-5 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r.changePercent != null ? (
                      <span className={r.changePercent >= 0 ? "text-positive" : "text-negative"}>
                        {formatSignedPercent(r.changePercent)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No search trends in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title="Search trends"
        subtitle="Search intent trends based on query patterns"
        actions={
          <button
            type="button"
            onClick={() => {
              exportToCsv(
                sorted.map((r) => ({
                  segment: r.label,
                  impressions: r.impressions,
                  changePercent: r.changePercent,
                  queryCount: r.count,
                })),
                "search-trends.csv"
              );
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Export CSV
          </button>
        }
        search={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter segments"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      >
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Segment" column="label" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[55%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[20%]" />
              <SortableHeader label="Change" column="changePercent" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[15%]" />
              <th className={cn("px-4 font-semibold text-right w-[10%]", TABLE_CELL_Y)}>Queries</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No rows to display.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.label} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.label}>
                    {r.label}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r.changePercent != null ? (
                      <span className={r.changePercent >= 0 ? "text-positive" : "text-negative"}>
                        {formatSignedPercent(r.changePercent)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.count}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ReportModal>
    </TableCard>
  );
}
