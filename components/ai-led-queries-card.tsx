"use client";

import { useMemo, useState } from "react";
import type { DataTableRow } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/use-table-sort";
import { ReportModal } from "@/components/report-modal";
import { exportToCsv } from "@/lib/export-csv";
import {
  getAiLedSegmentLabel,
  scoreAiLedQuery,
  type AiLedQueryResult,
  type AiLedUiSegment,
} from "@/lib/ai-led-queries";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

type SortKey = "query" | "clicks" | "impressions" | "clicksChangePercent" | "impressionsChangePercent" | "score";

function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function formatDelta(value?: number): { text: string; className: string } {
  if (value == null || Number.isNaN(value)) return { text: "", className: "" };
  const v = Math.round(value);
  if (v === 0) return { text: "", className: "" };
  const sign = v > 0 ? "+" : "";
  const cls = v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-muted-foreground";
  return { text: `${sign}${v}%`, className: cls };
}

function buildInsight(rows: AiLedQueryResult[], active: AiLedUiSegment): string {
  if (rows.length === 0) return "No AI-led queries detected in this period.";
  const counts: Record<string, number> = { questions: 0, comparisons: 0, long_tail: 0, informational: 0 };
  rows.forEach((r) => r.segments.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1)));
  const dominant = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "questions") as keyof typeof counts;

  const growing = rows
    .filter((r) => (r.impressionsChangePercent ?? 0) > 0)
    .sort((a, b) => (b.impressionsChangePercent ?? 0) - (a.impressionsChangePercent ?? 0))[0];

  const prefix = active === "all" ? "" : `${getAiLedSegmentLabel(active)}: `;

  if (active === "comparisons" || (active === "all" && dominant === "comparisons")) {
    return `${prefix}Comparison and evaluation queries are prominent — users are weighing options.`;
  }
  if (active === "long_tail" || (active === "all" && dominant === "long_tail")) {
    return `${prefix}Long-tail conversational queries are showing up — discovery intent is rising.`;
  }
  if (active === "questions" || (active === "all" && dominant === "questions")) {
    return `${prefix}Growth in question-style queries suggests higher discovery demand.`;
  }
  if (growing) {
    return `${prefix}Top mover: “${growing.query}” (+${Math.round(growing.impressionsChangePercent ?? 0)}% impressions).`;
  }
  return `${prefix}High-intent conversational queries are present — review for quick wins.`;
}

export function AiLedQueriesCard({
  queries,
  siteUrl,
  maxRows = 10,
  className,
}: {
  queries: DataTableRow[];
  siteUrl?: string;
  maxRows?: number;
  className?: string;
}) {
  const [segment, setSegment] = useState<AiLedUiSegment>("all");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const { sortKey, sortDir, onSort } = useTableSort<SortKey>("impressions");

  const scored = useMemo(() => {
    return queries
      .map((r) => {
        const s = scoreAiLedQuery({ query: r.key, siteUrl });
        return {
          query: r.key,
          segments: s.segments,
          score: s.score,
          reasons: s.reasons,
          clicks: r.clicks,
          impressions: r.impressions,
          clicksChangePercent: r.changePercent,
          impressionsChangePercent: r.impressionsChangePercent,
          excluded: s.excluded,
        };
      })
      .filter((r) => !r.excluded)
      .map(({ excluded: _excluded, ...rest }) => rest);
  }, [queries, siteUrl]);

  const segmented = useMemo(() => {
    if (segment === "all") return scored;
    return scored.filter((r) => r.segments.includes(segment));
  }, [scored, segment]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return segmented;
    return segmented.filter((r) => r.query.toLowerCase().includes(q));
  }, [filter, segmented]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "query") return dir * a.query.localeCompare(b.query);
      const aVal = (a as Record<string, unknown>)[sortKey] ?? 0;
      const bVal = (b as Record<string, unknown>)[sortKey] ?? 0;
      return dir * (Number(aVal) - Number(bVal));
    });
  }, [filtered, sortDir, sortKey]);

  const limited = useMemo(() => sorted.slice(0, maxRows), [maxRows, sorted]);
  const insight = useMemo(() => buildInsight(segmented, segment), [segmented, segment]);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">AI-led queries</span>}
      subtitle="Conversational & discovery-style searches"
      className={cn("min-w-0 min-h-[480px]", className)}
      action={
        <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
          {(["all", "questions", "comparisons", "long_tail"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSegment(k)}
              className={
                segment === k
                  ? "rounded px-2 py-1 text-xs font-medium bg-surface text-foreground border border-border"
                  : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              }
              aria-pressed={segment === k}
            >
              {getAiLedSegmentLabel(k)}
            </button>
          ))}
        </div>
      }
    >
      <div className="px-5 pt-2 text-xs text-muted-foreground">{insight}</div>

      <div className="mt-2 max-h-[400px] overflow-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Query" column="query" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[52%]" />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[24%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[24%]" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => {
              const r = limited[i];
              const clicksDelta = formatDelta(r?.clicksChangePercent);
              const imprDelta = formatDelta(r?.impressionsChangePercent);
              return (
                <tr
                  key={r?.query ?? `placeholder-${i}`}
                  className={cn(TABLE_ROW_CLASS, i === 0 && r ? "bg-accent/40 font-medium" : "opacity-95")}
                  aria-hidden={!r}
                >
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r?.query}>
                    {r ? r.query : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r ? (
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatCompact(r.clicks)}</span>
                        {clicksDelta.text ? <span className={cn("text-xs", clicksDelta.className)}>({clicksDelta.text})</span> : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r ? (
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatCompact(r.impressions)}</span>
                        {imprDelta.text ? <span className={cn("text-xs", imprDelta.className)}>({imprDelta.text})</span> : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-border px-5 py-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => setOpen(true)} className="hover:text-foreground underline">
          View full report
        </button>
      </div>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title="AI-led queries"
        subtitle="Conversational & discovery-style searches"
        actions={
          <button
            type="button"
            onClick={() => {
              exportToCsv(
                sorted.map((r) => ({
                  query: r.query,
                  segments: r.segments.join("|"),
                  score: r.score,
                  clicks: r.clicks,
                  clicksDeltaPercent: r.clicksChangePercent,
                  impressions: r.impressions,
                  impressionsDeltaPercent: r.impressionsChangePercent,
                })),
                "ai-led-queries.csv"
              );
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Export CSV
          </button>
        }
        search={
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search queries"
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as AiLedUiSegment)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground"
              aria-label="Segment"
            >
              <option value="all">All</option>
              <option value="questions">Questions</option>
              <option value="comparisons">Comparisons</option>
              <option value="long_tail">Long-tail</option>
            </select>
          </div>
        }
      >
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Query" column="query" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[52%]" />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[24%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[24%]" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No rows to display.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const clicksDelta = formatDelta(r.clicksChangePercent);
                const imprDelta = formatDelta(r.impressionsChangePercent);
                return (
                  <tr key={r.query} className={TABLE_ROW_CLASS}>
                    <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.query}>
                      {r.query}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatCompact(r.clicks)}</span>
                        {clicksDelta.text ? <span className={cn("text-xs", clicksDelta.className)}>({clicksDelta.text})</span> : null}
                      </span>
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatCompact(r.impressions)}</span>
                        {imprDelta.text ? <span className={cn("text-xs", imprDelta.className)}>({imprDelta.text})</span> : null}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ReportModal>
    </TableCard>
  );
}
