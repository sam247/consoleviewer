"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/use-table-sort";
import { ReportModal } from "@/components/report-modal";
import { exportToCsv } from "@/lib/export-csv";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";
import { MetricSparkline } from "@/components/metric-sparkline";
import { useDateRange } from "@/contexts/date-range-context";

type GroupRow = {
  key: string;
  label: string;
  pages: number;
  clicks: number;
  impressions: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
  share: number;
  trend: number[];
};

type ContentPerformanceResponse = {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  suggestedPatterns?: { pattern: string; label: string }[];
  active?: { include: string[]; exclude: string[] };
  groups: GroupRow[];
};

type SortKey = "label" | "clicks" | "impressions" | "share";

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

function buildInsight(rows: GroupRow[]): string {
  if (!rows.length) return "No content groups detected in this period.";
  const top = [...rows].sort((a, b) => b.share - a.share)[0];
  if (!top) return "No content groups detected in this period.";
  const sharePct = Math.round(top.share * 100);
  const change = top.impressionsChangePercent;
  const tone = change == null ? "flat" : Math.abs(change) < 2 ? "flat" : change > 0 ? "up" : "down";
  const verb = tone === "down" ? "declining" : tone === "up" ? "rising" : "flattening";
  return `${top.label} dominates visibility (${sharePct}%) but ${verb}`;
}

export function ContentPerformanceCard({ propertyId, className }: { propertyId: string; className?: string }) {
  const { startDate, endDate } = useDateRange();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [patternInput, setPatternInput] = useState("");
  const [includePatterns, setIncludePatterns] = useState<string[]>([]);
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
  const { sortKey, sortDir, onSort } = useTableSort<SortKey>("share");

  const storageKey = `consoleview_content_segments_${propertyId}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { include?: string[]; exclude?: string[] };
      if (Array.isArray(parsed.include)) setIncludePatterns(parsed.include);
      if (Array.isArray(parsed.exclude)) setExcludePatterns(parsed.exclude);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ include: includePatterns, exclude: excludePatterns }));
    } catch {}
  }, [excludePatterns, includePatterns, storageKey]);

  const { data, isLoading } = useQuery({
    queryKey: ["contentPerformance", propertyId, startDate, endDate, includePatterns, excludePatterns],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("startDate", startDate);
      sp.set("endDate", endDate);
      includePatterns.forEach((p) => sp.append("include", p));
      excludePatterns.forEach((p) => sp.append("exclude", p));
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/content-performance?${sp.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load content performance");
      return (await res.json()) as ContentPerformanceResponse;
    },
    enabled: Boolean(propertyId && startDate && endDate),
  });

  const all = useMemo(() => data?.groups ?? [], [data?.groups]);
  const suggested = useMemo(() => data?.suggestedPatterns ?? [], [data?.suggestedPatterns]);
  const insight = useMemo(() => buildInsight(all), [all]);

  const addInclude = (pattern: string) => {
    const p = pattern.trim();
    if (!p) return;
    setIncludePatterns((prev) => (prev.includes(p) ? prev : [...prev, p]));
  };
  const addExclude = (pattern: string) => {
    const p = pattern.trim();
    if (!p) return;
    setExcludePatterns((prev) => (prev.includes(p) ? prev : [...prev, p]));
  };
  const removeInclude = (pattern: string) => setIncludePatterns((prev) => prev.filter((x) => x !== pattern));
  const removeExclude = (pattern: string) => setExcludePatterns((prev) => prev.filter((x) => x !== pattern));

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  }, [all, filter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "label") return dir * a.label.localeCompare(b.label);
      const aVal = (a as Record<string, unknown>)[sortKey] ?? 0;
      const bVal = (b as Record<string, unknown>)[sortKey] ?? 0;
      return dir * (Number(aVal) - Number(bVal));
    });
  }, [filtered, sortDir, sortKey]);

  const topRows = useMemo(() => sorted.slice(0, 6), [sorted]);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Content performance</span>}
      subtitle="How different parts of your site are performing"
      className={cn("min-w-0 min-h-[480px]", className)}
    >
      <div className="px-5 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={patternInput}
            onChange={(e) => setPatternInput(e.target.value)}
            placeholder="Enter URL pattern or regex…"
            className="h-9 flex-1 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              addInclude(patternInput);
              setPatternInput("");
            }}
            disabled={!patternInput.trim()}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Include
          </button>
          <button
            type="button"
            onClick={() => {
              addExclude(patternInput);
              setPatternInput("");
            }}
            disabled={!patternInput.trim()}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Exclude
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {includePatterns.map((p) => (
            <button
              key={`inc-${p}`}
              type="button"
              onClick={() => removeInclude(p)}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground hover:bg-accent"
              aria-label={`Remove include ${p}`}
              title={`Include: ${p}`}
            >
              {p}
              <span className="ml-2 text-muted-foreground">×</span>
            </button>
          ))}
          {excludePatterns.map((p) => (
            <button
              key={`exc-${p}`}
              type="button"
              onClick={() => removeExclude(p)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Remove exclude ${p}`}
              title={`Exclude: ${p}`}
            >
              - {p}
              <span className="ml-2">×</span>
            </button>
          ))}
        </div>

        {suggested.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {suggested.map((s) => (
              <button
                key={s.pattern}
                type="button"
                onClick={() => addInclude(s.pattern)}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                title={`Add segment: ${s.pattern}`}
              >
                {s.pattern}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pt-2 text-xs text-muted-foreground">{insight}</div>

      <div className="mt-2 max-h-[400px] overflow-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Group" column="label" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[34%]" />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[18%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[18%]" />
              <SortableHeader label="Share" column="share" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[12%]" />
              <th className={cn("px-5 font-semibold text-right w-[18%]", TABLE_CELL_Y)}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && topRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : topRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No content groups available.
                </td>
              </tr>
            ) : (
              topRows.map((r) => {
                const clicksDelta = formatDelta(r.clicksChangePercent);
                const imprDelta = formatDelta(r.impressionsChangePercent);
                return (
                  <tr
                    key={r.key}
                    className={cn(TABLE_ROW_CLASS, "opacity-95", topRows[0]?.key === r.key ? "bg-accent/40 font-medium" : "")}
                  >
                    <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.key}>
                      {r.label}
                    </td>
                    <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatCompact(r.clicks)}</span>
                        {clicksDelta.text ? <span className={cn("text-xs", clicksDelta.className)}>({clicksDelta.text})</span> : null}
                      </span>
                    </td>
                    <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatCompact(r.impressions)}</span>
                        {imprDelta.text ? <span className={cn("text-xs", imprDelta.className)}>({imprDelta.text})</span> : null}
                      </span>
                    </td>
                    <td className={cn("px-5 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                      {(r.share * 100).toFixed(0)}%
                    </td>
                    <td className={cn("px-5", TABLE_CELL_Y)}>
                      <div className="flex items-center justify-end">
                        <MetricSparkline values={r.trend} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-border px-5 py-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => setOpen(true)} className="hover:text-foreground underline" disabled={!all.length}>
          View full report
        </button>
      </div>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title="Content performance"
        subtitle="How different parts of your site are performing"
        actions={
          <button
            type="button"
            onClick={() => {
              exportToCsv(
                sorted.map((r) => ({
                  group: r.label,
                  key: r.key,
                  pages: r.pages,
                  clicks: r.clicks,
                  clicksDeltaPercent: r.clicksChangePercent,
                  impressions: r.impressions,
                  impressionsDeltaPercent: r.impressionsChangePercent,
                  sharePercent: r.share * 100,
                })),
                "content-performance.csv"
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
            placeholder="Filter groups"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      >
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Group" column="label" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[32%]" />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[18%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[18%]" />
              <SortableHeader label="Share" column="share" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[12%]" />
              <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No rows to display.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const clicksDelta = formatDelta(r.clicksChangePercent);
                const imprDelta = formatDelta(r.impressionsChangePercent);
                return (
                  <tr key={r.key} className={TABLE_ROW_CLASS}>
                    <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.key}>
                      {r.label}
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
                    <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                      {(r.share * 100).toFixed(1)}%
                    </td>
                    <td className={cn("px-4", TABLE_CELL_Y)}>
                      <div className="flex items-center justify-end">
                        <MetricSparkline values={r.trend} />
                      </div>
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
