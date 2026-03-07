"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableRow, type TrendFilter } from "@/components/data-table";
import type { BandFilter } from "@/components/query-footprint";
import { InfoTooltip } from "@/components/info-tooltip";
import { TableFullViewModal } from "@/components/table-full-view-modal";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";
import { cn } from "@/lib/utils";
import { exportToCsv, formatExportFilename } from "@/lib/export-csv";
import type { PropertyData } from "@/hooks/use-property-data";
import { formatNum } from "@/hooks/use-property-data";
import { PageDetailPanel } from "@/components/page-detail-panel";
import { useEngineSelectionOptional } from "@/contexts/engine-selection-context";

type SavedSegment = { id: string; name: string; pattern: string };
const SEGMENTS_KEY = "consoleview_content_segments";

export function PerformanceTablesSection({
  data,
  queriesRows,
  pagesRows,
  bandFilter,
  onClearBandFilter,
  siteSlug,
  startDate,
  endDate,
  propertyId,
  querySparklines,
  queryAppearances,
}: {
  data: PropertyData;
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  bandFilter: BandFilter;
  onClearBandFilter: () => void;
  siteSlug: string;
  startDate: string;
  endDate: string;
  propertyId?: string;
  querySparklines?: Record<string, number[]>;
  queryAppearances?: Record<string, string[]>;
}) {
  const [queriesTrendFilter, setQueriesTrendFilter] = useState<TrendFilter>("all");
  const [pageDetailUrl, setPageDetailUrl] = useState<string | null>(null);
  const [pagesTrendFilter, setPagesTrendFilter] = useState<TrendFilter>("all");
  const [contentFilterPattern, setContentFilterPattern] = useState("");
  const [contentFilterExclude, setContentFilterExclude] = useState(false);
  const [savedSegments, setSavedSegments] = useState<SavedSegment[]>([]);
  const [contentGroupsFullViewOpen, setContentGroupsFullViewOpen] = useState(false);
  const engineSelection = useEngineSelectionOptional();
  const effectiveEngine = engineSelection?.effectiveEngine ?? "google";

  const applyEngineSelectionToRow = (r: DataTableRow): DataTableRow => {
    if (effectiveEngine === "bing") {
      return {
        ...r,
        clicks: r.clicksBing ?? r.clicks ?? 0,
        impressions: r.impressionsBing ?? r.impressions ?? 0,
        position: r.positionBing ?? r.position,
        clicksGoogle: undefined,
        impressionsGoogle: undefined,
        positionGoogle: undefined,
      };
    }
    return {
      ...r,
      clicksBing: undefined,
      impressionsBing: undefined,
      positionBing: undefined,
    };
  };

  useEffect(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SEGMENTS_KEY) : null;
      if (raw) setSavedSegments(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const newQueriesRows: DataTableRow[] = (data.newQueries ?? []).map((r) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
    position: r.position,
  }));
  const lostQueriesRows: DataTableRow[] = (data.lostQueries ?? []).map((r) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: undefined,
  }));
  const newPagesRows: DataTableRow[] = (data.newPages ?? []).map((r) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  }));
  const lostPagesRows: DataTableRow[] = (data.lostPages ?? []).map((r) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: undefined,
  }));

  const queriesRowsForTable = useMemo(() => {
    let rows = queriesTrendFilter === "new" ? newQueriesRows : queriesTrendFilter === "lost" ? lostQueriesRows : queriesRows;
    rows = rows.map(applyEngineSelectionToRow);
    if (bandFilter) {
      rows = rows.filter((r) => r.position != null && r.position >= bandFilter.min && r.position <= bandFilter.max);
    }
    return rows;
  }, [queriesTrendFilter, queriesRows, newQueriesRows, lostQueriesRows, bandFilter, applyEngineSelectionToRow]);

  const pagesRowsForTable = useMemo(() => {
    if (pagesTrendFilter === "new") return newPagesRows.map(applyEngineSelectionToRow);
    if (pagesTrendFilter === "lost") return lostPagesRows.map(applyEngineSelectionToRow);
    return pagesRows.map(applyEngineSelectionToRow);
  }, [pagesTrendFilter, pagesRows, newPagesRows, lostPagesRows, applyEngineSelectionToRow]);

  const contentGroupsFilteredPages = useMemo(() => {
    const raw = contentFilterPattern.trim();
    if (!raw) return { pages: pagesRows, error: null };
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const patterns: RegExp[] = [];
    for (const p of parts) {
      try {
        patterns.push(new RegExp(p));
      } catch {
        return { pages: pagesRows, error: "Invalid regex" };
      }
    }
    if (patterns.length === 0) return { pages: pagesRows, error: null };
    const match = (key: string) => patterns.some((re) => re.test(key));
    const filtered = contentFilterExclude
      ? pagesRows.filter((p) => !match(p.key))
      : pagesRows.filter((p) => match(p.key));
    return { pages: filtered, error: null };
  }, [pagesRows, contentFilterPattern, contentFilterExclude]);

  const contentGroups = useMemo(() => {
    const source = contentGroupsFilteredPages.pages;
    const groups = new Map<string, { clicks: number; impressions: number; changes: number[] }>();
    for (const p of source) {
      try {
        const pathname = p.key.startsWith("http") ? new URL(p.key).pathname : p.key;
        const segment = pathname.split("/").filter(Boolean)[0] ?? "/";
        const label = segment || "(root)";
        const cur = groups.get(label) ?? { clicks: 0, impressions: 0, changes: [] };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        if (p.changePercent != null) cur.changes.push(p.changePercent);
        groups.set(label, cur);
      } catch {
        const cur = groups.get("(other)") ?? { clicks: 0, impressions: 0, changes: [] };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        if (p.changePercent != null) cur.changes.push(p.changePercent);
        groups.set("(other)", cur);
      }
    }
    return Array.from(groups.entries())
      .map(([label, agg]) => ({
        label,
        clicks: agg.clicks,
        impressions: agg.impressions,
        avgChangePercent: agg.changes.length > 0
          ? Math.round(agg.changes.reduce((s, v) => s + v, 0) / agg.changes.length)
          : undefined,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
  }, [contentGroupsFilteredPages.pages]);

  const saveSegment = () => {
    if (contentGroupsFilteredPages.error || !contentFilterPattern.trim()) return;
    const next: SavedSegment[] = [
      ...savedSegments,
      { id: crypto.randomUUID?.() ?? String(Date.now()), name: contentFilterPattern.trim().slice(0, 30) || "Segment", pattern: contentFilterPattern.trim() },
    ];
    setSavedSegments(next);
    try { localStorage.setItem(SEGMENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const _countriesRows: DataTableRow[] = data.countries?.map((r) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];
  const _devicesRows: DataTableRow[] = data.devices?.map((r) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];

  return (
    <section aria-label="Performance tables" className="space-y-6">
      {propertyId && (
        <PageDetailPanel
          open={!!pageDetailUrl}
          onClose={() => setPageDetailUrl(null)}
          pageUrl={pageDetailUrl}
          propertyId={propertyId}
          startDate={startDate}
          endDate={endDate}
        />
      )}
      {bandFilter && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 rounded px-2 py-0.5">
            Filtered by {bandFilter.min === 1 && bandFilter.max === 3 ? "Top 3" : bandFilter.min === 4 && bandFilter.max === 10 ? "Top 4–10" : bandFilter.min === 11 && bandFilter.max === 20 ? "Top 11–20" : bandFilter.min === 21 && bandFilter.max === 50 ? "Top 21–50" : "Top 50+"}
          </span>
          <button
            type="button"
            onClick={onClearBandFilter}
            className="text-xs text-muted-foreground hover:text-foreground underline focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
          >
            Clear
          </button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/80 mb-1" title="Shortcut coming soon">Press <kbd className="px-0.5 rounded bg-muted/50 font-mono text-[10px]">/</kbd> to search</p>
      <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
        Performance tables
        <InfoTooltip title="Top queries and pages by clicks and impressions" />
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          <DataTable
            title={`Queries · Source: ${effectiveEngine === "google" ? "Google" : "Bing"}`}
            titleTooltip="Top queries by clicks and impressions; filter by trend"
            rows={queryAppearances ? queriesRowsForTable.map((r) => ({ ...r, appearances: queryAppearances[r.key] })) : queriesRowsForTable}
            trendFilter={queriesTrendFilter}
            onTrendFilterChange={setQueriesTrendFilter}
            showFilter
            onExportCsv={() => exportToCsv(queriesRowsForTable as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "queries", startDate, endDate))}
            sparklines={querySparklines}
          />
        </div>
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          <DataTable
            title={`Pages · Source: ${effectiveEngine === "google" ? "Google" : "Bing"}`}
            titleTooltip="Top pages by clicks and impressions; filter by trend"
            rows={pagesRowsForTable}
            trendFilter={pagesTrendFilter}
            onTrendFilterChange={setPagesTrendFilter}
            showFilter
            onExportCsv={() => exportToCsv(pagesRowsForTable as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "pages", startDate, endDate))}
            onRowClick={propertyId ? (row) => setPageDetailUrl(row.key) : undefined}
          />
          {(contentFilterPattern.trim() || contentGroups.length > 0) && (() => {
            const totalGroupClicks = contentGroups.reduce((s, g) => s + g.clicks, 0);
            const totalSiteClicks = pagesRows.reduce((s, p) => s + p.clicks, 0);
            const sharePct = totalSiteClicks > 0 ? Math.round((totalGroupClicks / totalSiteClicks) * 100) : 0;
            const siteTrend = data.summary?.clicksChangePercent;
            const hasGroups = contentGroups.length > 0;
            return (
              <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-[120ms] hover:border-foreground/20 flex flex-col flex-1 min-h-0">
                <div className="border-b border-border px-4 py-2.5 shrink-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">Content groups<InfoTooltip title="Group pages by path segment; filter by regex to analyse a subset" /></h3>
                    {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">Segment mode</span>
                    )}
                    {hasGroups && (
                      <button
                        type="button"
                        onClick={() => exportToCsv(contentGroups.map((g) => ({ label: g.label, clicks: g.clicks, impressions: g.impressions, avgChangePercent: g.avgChangePercent ?? "" })), formatExportFilename(siteSlug, "content-groups", startDate, endDate))}
                        className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
                        title="Export CSV"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {contentGroups.length} groups · {formatNum(totalGroupClicks)} clicks ({sharePct}% of total)
                    {siteTrend != null ? ` · Site trend ${siteTrend >= 0 ? "+" : ""}${siteTrend}%` : " · —"}
                  </p>
                  <label className="block text-xs text-muted-foreground mt-2 mb-1">Filter by path or URL regex (comma = OR)</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. ^/blog/"
                      value={contentFilterPattern}
                      onChange={(e) => setContentFilterPattern(e.target.value)}
                      className={cn(
                        "flex-1 min-w-[140px] rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        contentGroupsFilteredPages.error ? "border-negative" : "border-border"
                      )}
                    />
                    <div className="flex rounded border border-border bg-muted/30 p-0.5">
                      <button
                        type="button"
                        onClick={() => setContentFilterExclude(false)}
                        className={cn("rounded px-2 py-0.5 text-xs font-medium transition-colors duration-[120ms]", !contentFilterExclude ? "bg-background text-foreground border border-input" : "text-muted-foreground hover:bg-accent")}
                      >
                        Include
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentFilterExclude(true)}
                        className={cn("rounded px-2 py-0.5 text-xs font-medium transition-colors duration-[120ms]", contentFilterExclude ? "bg-background text-foreground border border-input" : "text-muted-foreground hover:bg-accent")}
                      >
                        Exclude
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={saveSegment}
                      disabled={!!contentGroupsFilteredPages.error || !contentFilterPattern.trim()}
                      className="rounded border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-[120ms]"
                    >
                      Save as segment
                    </button>
                    {contentGroupsFilteredPages.error && (
                      <span className="text-xs text-negative shrink-0">Invalid regex</span>
                    )}
                  </div>
                  {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && (() => {
                    const matched = contentGroupsFilteredPages.pages;
                    const n = matched.length;
                    const totalClicks = pagesRows.reduce((s, p) => s + p.clicks, 0);
                    const totalImpr = pagesRows.reduce((s, p) => s + p.impressions, 0);
                    const matchedClicks = matched.reduce((s, p) => s + p.clicks, 0);
                    const matchedImpr = matched.reduce((s, p) => s + p.impressions, 0);
                    const pctClicks = totalClicks > 0 ? Math.round((matchedClicks / totalClicks) * 100) : 0;
                    const pctImpr = totalImpr > 0 ? Math.round((matchedImpr / totalImpr) * 100) : 0;
                    const siteChanges = pagesRows.filter((p) => p.changePercent != null).map((p) => p.changePercent!);
                    const matchedChanges = matched.filter((p) => p.changePercent != null).map((p) => p.changePercent!);
                    const siteAvg = siteChanges.length ? Math.round(siteChanges.reduce((a, b) => a + b, 0) / siteChanges.length) : null;
                    const matchedAvg = matchedChanges.length ? Math.round(matchedChanges.reduce((a, b) => a + b, 0) / matchedChanges.length) : null;
                    const deltaVsSite = siteAvg != null && matchedAvg != null ? matchedAvg - siteAvg : null;
                    return (
                      <p className="text-xs text-muted-foreground mt-1">
                        {n} pages matched · {pctClicks}% of clicks · {pctImpr}% of impressions
                        {deltaVsSite != null ? ` · Matched Δ vs site: ${deltaVsSite >= 0 ? "+" : ""}${deltaVsSite}%` : " · Matched Δ vs site: —"}
                      </p>
                    );
                  })()}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: "/blog", pattern: "^/blog" },
                      { label: "/products", pattern: "^/products" },
                      { label: "/category", pattern: "^/category" },
                      { label: "?utm", pattern: "\\?utm" },
                    ].map(({ label, pattern }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setContentFilterPattern(pattern)}
                        className="rounded border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms]"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {savedSegments.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Saved:</span>
                      {savedSegments.map((seg) => (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => setContentFilterPattern(seg.pattern)}
                          className="rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms] truncate max-w-[120px]"
                          title={seg.pattern}
                        >
                          {seg.name || seg.pattern.slice(0, 15)}
                        </button>
                      ))}
                    </div>
                  )}
                  {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && data.daily?.length > 0 && (() => {
                    const spark = (data.daily as { date: string; clicks: number }[]).slice(-14);
                    const vals = spark.map((d) => d.clicks);
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const range = max - min || 1;
                    const pts = vals.map((v, i) => `${(i / (vals.length - 1 || 1)) * 80},${24 - ((v - min) / range) * 20}`);
                    return (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground shrink-0">Site trend (proxy)</span>
                        <svg width={80} height={24} className="shrink-0" aria-hidden>
                          <polyline fill="none" stroke="var(--chart-clicks)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={pts.join(" ")} />
                        </svg>
                      </div>
                    );
                  })()}
                  {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && (
                    <p className="text-xs text-muted-foreground mt-1">Grouped by: path (filtered)</p>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                  <table className={TABLE_BASE_CLASS}>
                    <thead className={TABLE_HEAD_CLASS}>
                      <tr>
                        <th className={cn("px-4 font-semibold text-left min-w-0 w-[40%]", TABLE_CELL_Y)}>Name</th>
                        <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Clicks</th>
                        <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Impr.</th>
                        <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasGroups ? (
                        contentGroups.slice(0, 10).map((g) => (
                          <tr key={g.label} className={TABLE_ROW_CLASS}>
                            <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={g.label}>/{g.label}</td>
                            <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>{formatNum(g.clicks)}</td>
                            <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>{formatNum(g.impressions)}</td>
                            <td className={cn("px-4 text-right", TABLE_CELL_Y)}>
                              {g.avgChangePercent != null ? (
                                <span className={cn("tabular-nums", g.avgChangePercent >= 0 ? "text-positive" : "text-negative")}>
                                  {g.avgChangePercent >= 0 ? "+" : ""}{g.avgChangePercent}%
                                </span>
                              ) : "–"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                            No groups match the filter. Try a different path or regex.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {contentGroups.length > 10 && (
                    <div className="border-t border-border px-4 py-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setContentGroupsFullViewOpen(true)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
                      >
                        View {contentGroups.length - 10} more
                      </button>
                    </div>
                  )}
                  <TableFullViewModal
                    open={contentGroupsFullViewOpen}
                    onClose={() => setContentGroupsFullViewOpen(false)}
                    title="Content groups"
                    rows={contentGroups.map((g) => ({ key: g.label, clicks: g.clicks, impressions: g.impressions, changePercent: g.avgChangePercent ?? undefined }))}
                    hasPosition={false}
                    onExportCsv={() => exportToCsv(contentGroups.map((g) => ({ label: g.label, clicks: g.clicks, impressions: g.impressions, avgChangePercent: g.avgChangePercent ?? "" })), formatExportFilename(siteSlug, "content-groups", startDate, endDate))}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
