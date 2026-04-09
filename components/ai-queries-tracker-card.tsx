"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DataTableRow } from "@/components/data-table";
import { isConversational, isLongForm } from "@/lib/ai-query-detection";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
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

export function AiQueriesTrackerCard({
  queries,
  viewAllHref,
  siteUrl,
  maxRows = 8,
  className,
}: {
  queries: DataTableRow[];
  viewAllHref: string;
  siteUrl?: string;
  maxRows?: number;
  className?: string;
}) {
  const rows = useMemo(() => {
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
    return out
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, maxRows);
  }, [maxRows, queries, siteUrl]);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Search signals</span>}
      subtitle="Intent clusters"
      action={
        <Link href={viewAllHref} className="text-xs text-muted-foreground hover:text-foreground underline" aria-label="View all AI query clusters">
          View all
        </Link>
      }
      className={cn("min-w-0", className)}
    >
      <div className="overflow-x-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className={cn("px-5 font-semibold text-left w-[60%]", TABLE_CELL_Y)}>Signal</th>
              <th className={cn("px-5 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Impr.</th>
              <th className={cn("px-5 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Chg</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.label} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.label}>
                    <span className="flex items-center justify-between gap-2 min-w-0">
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{r.count}</span>
                    </span>
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
                  No AI-style query clusters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}
