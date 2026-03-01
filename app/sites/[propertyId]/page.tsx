"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { TrendChart } from "@/components/trend-chart";
import { DataTable, type DataTableRow, type TrendFilter } from "@/components/data-table";
import { BrandedChart } from "@/components/branded-chart";
import { SparkToggles } from "@/components/spark-toggles";
import { TrackedKeywordsSection } from "@/components/tracked-keywords-section";
import { QueryFootprint } from "@/components/query-footprint";
import { OpportunityIntelligence } from "@/components/opportunity-intelligence";
import { useDateRange } from "@/contexts/date-range-context";
import { decodePropertyId } from "@/types/gsc";
import { getMockTrackedKeywords } from "@/lib/mock-rank";
import { cn } from "@/lib/utils";

async function fetchSiteDetail(
  siteUrl: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
) {
  const params = new URLSearchParams({
    site: siteUrl,
    startDate,
    endDate,
    priorStartDate,
    priorEndDate,
  });
  const res = await fetch(`/api/analytics/detail?${params}`);
  if (!res.ok) throw new Error("Failed to fetch site detail");
  return res.json();
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface animate-pulse", className)}>
      <div className="h-6 w-1/3 rounded bg-muted m-3" />
      <div className="h-4 w-2/3 rounded bg-muted m-3" />
    </div>
  );
}

type Summary = {
  clicks: number;
  impressions: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
  position?: number;
  positionChangePercent?: number;
  ctr?: number;
  ctrChangePercent?: number;
  queryCount?: number;
  queryCountChangePercent?: number;
};

function HeaderMetricRow({
  summary,
  formatNum,
}: {
  summary: Summary | null | undefined;
  formatNum: (n: number) => string;
}) {
  if (!summary) return null;
  const ctr = summary.ctr ?? (summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0);
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Clicks</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatNum(summary.clicks)}</span>
        {summary.clicksChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.clicksChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.clicksChangePercent >= 0 ? "+" : ""}{summary.clicksChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Impr.</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatNum(summary.impressions)}</span>
        {summary.impressionsChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.impressionsChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.impressionsChangePercent >= 0 ? "+" : ""}{summary.impressionsChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">CTR</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{ctr.toFixed(2)}%</span>
        {summary.ctrChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.ctrChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.ctrChangePercent >= 0 ? "+" : ""}{summary.ctrChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Avg pos.</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {summary.position != null ? summary.position.toFixed(1) : "—"}
        </span>
        {summary.positionChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.positionChangePercent <= 0 ? "text-positive" : "text-negative")}>
            {summary.positionChangePercent >= 0 ? "+" : ""}{summary.positionChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Queries</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {summary.queryCount != null ? formatNum(summary.queryCount) : "—"}
        </span>
        {summary.queryCountChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.queryCountChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.queryCountChangePercent >= 0 ? "+" : ""}{summary.queryCountChangePercent}%
          </span>
        )}
      </div>
    </div>
  );
}

function buildInsightSentence(
  type: "query" | "page",
  direction: "growing" | "decaying",
  row: DataTableRow
): string {
  const label = type === "query" ? `The query '${row.key}'` : `The page '${row.key}'`;
  const pct = Math.abs(row.changePercent ?? 0);
  const posInfo =
    row.position != null
      ? direction === "growing" && row.position <= 10
        ? ` and is in the top 10 (pos ${row.position.toFixed(1)})`
        : ` at position ${row.position.toFixed(1)}`
      : "";
  if (direction === "growing") {
    return `${label} gained +${pct}% clicks${posInfo}.`;
  }
  return `${label} lost ${pct}% clicks${posInfo}.`;
}

function MovementIntelligence({
  queriesRows,
  pagesRows,
  trendFilter,
  onTrendFilterChange,
}: {
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  trendFilter: TrendFilter;
  onTrendFilterChange: (t: TrendFilter) => void;
}) {
  const topGrowingQuery = useMemo(() => {
    return queriesRows
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  }, [queriesRows]);
  const topDecayingQuery = useMemo(() => {
    return queriesRows
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  }, [queriesRows]);
  const topGrowingPage = useMemo(() => {
    return pagesRows
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  }, [pagesRows]);
  const topDecayingPage = useMemo(() => {
    return pagesRows
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  }, [pagesRows]);

  const signals = [
    topGrowingQuery && { direction: "growing" as const, sentence: buildInsightSentence("query", "growing", topGrowingQuery) },
    topDecayingQuery && { direction: "decaying" as const, sentence: buildInsightSentence("query", "decaying", topDecayingQuery) },
    topGrowingPage && { direction: "growing" as const, sentence: buildInsightSentence("page", "growing", topGrowingPage) },
    topDecayingPage && { direction: "decaying" as const, sentence: buildInsightSentence("page", "decaying", topDecayingPage) },
  ].filter(Boolean) as { direction: "growing" | "decaying"; sentence: string }[];

  // Bold numeric parts in sentence: +N%, -N%, "top N", "pos N.N"
  const boldMetrics = (sentence: string) => {
    const parts = sentence.split(/([+-]?\d+(?:\.\d+)?%|top \d+|pos \d+(?:\.\d+)?)/gi);
    return parts.map((part, i) =>
      /^([+-]?\d+(?:\.\d+)?%|top \d+|pos \d+(?:\.\d+)?)$/i.test(part) ? (
        <span key={i} className="font-semibold text-foreground">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <section aria-label="Movement intelligence" className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Movement intelligence</h2>
        <div className="flex gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          {(["all", "growing", "decaying", "new", "lost"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTrendFilterChange(t)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium capitalize transition-colors duration-150",
                trendFilter === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {signals.length > 0 && (
        <div className="px-4 py-2.5 space-y-1 border-b border-border/50">
          {signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className={cn("mt-px shrink-0 text-xs", s.direction === "growing" ? "text-positive" : "text-negative")}>
                {s.direction === "growing" ? "↑" : "↓"}
              </span>
              <span>{boldMetrics(s.sentence)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-border/40">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-medium">AI summary</p>
        <p className="text-sm text-muted-foreground/60 italic">
          Detailed opportunity and trend summary will appear here. Coming soon.
        </p>
      </div>
    </section>
  );
}

export default function SiteDetailPage({
  params,
}: {
  params: { propertyId: string };
}) {
  const { propertyId } = params;
  const siteUrl = decodePropertyId(propertyId);
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "siteDetail",
      siteUrl,
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
    ],
    queryFn: () =>
      fetchSiteDetail(
        siteUrl,
        startDate,
        endDate,
        priorStartDate,
        priorEndDate
      ),
  });

  const [trendFilter, setTrendFilter] = useState<TrendFilter>("all");
  const [compareToPrior, setCompareToPrior] = useState(false);

  const queriesRows = useMemo<DataTableRow[]>(
    () =>
      data?.queries?.map((r: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }) => ({
        key: r.key,
        clicks: r.clicks,
        impressions: r.impressions,
        changePercent: r.changePercent,
        position: r.position,
      })) ?? [],
    [data?.queries]
  );
  const pagesRows = useMemo<DataTableRow[]>(
    () =>
      data?.pages?.map((r: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }) => ({
        key: r.key,
        clicks: r.clicks,
        impressions: r.impressions,
        changePercent: r.changePercent,
        position: r.position,
      })) ?? [],
    [data?.pages]
  );
  const newQueriesRows: DataTableRow[] = (data?.newQueries ?? []).map((r: { key: string; clicks: number; impressions: number; changePercent?: number; position?: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
    position: r.position,
  }));
  const lostQueriesRows: DataTableRow[] = (data?.lostQueries ?? []).map((r: { key: string; clicks: number; impressions: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: undefined,
  }));
  const newPagesRows: DataTableRow[] = (data?.newPages ?? []).map((r: { key: string; clicks: number; impressions: number; changePercent?: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  }));
  const lostPagesRows: DataTableRow[] = (data?.lostPages ?? []).map((r: { key: string; clicks: number; impressions: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: undefined,
  }));
  const queriesRowsForTable = useMemo(() => {
    if (trendFilter === "new") return newQueriesRows;
    if (trendFilter === "lost") return lostQueriesRows;
    return queriesRows;
  }, [trendFilter, queriesRows, newQueriesRows, lostQueriesRows]);
  const pagesRowsForTable = useMemo(() => {
    if (trendFilter === "new") return newPagesRows;
    if (trendFilter === "lost") return lostPagesRows;
    return pagesRows;
  }, [trendFilter, pagesRows, newPagesRows, lostPagesRows]);

  const queryCounting = useMemo(() => {
    const q = data?.queries ?? [];
    const withPos = q as { position?: number }[];
    return {
      total: q.length,
      top10: withPos.filter((r) => r.position != null && r.position <= 10).length,
      top3: withPos.filter((r) => r.position != null && r.position <= 3).length,
    };
  }, [data?.queries]);

  const contentGroups = useMemo(() => {
    const groups = new Map<string, { clicks: number; impressions: number; changes: number[] }>();
    for (const p of pagesRows) {
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
  }, [pagesRows]);

  const countriesRows: DataTableRow[] = data?.countries?.map((r: { key: string; clicks: number; impressions: number; changePercent: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];
  const devicesRows: DataTableRow[] = data?.devices?.map((r: { key: string; clicks: number; impressions: number; changePercent: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error instanceof Error ? error.message : "Something went wrong"}
          </div>
          <Link href="/" className="text-sm text-foreground underline mt-2 inline-block">
            Back to overview
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Overview
          </Link>
          <h1 className="mt-1 text-lg font-medium text-foreground truncate">
            {siteUrl}
          </h1>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <SkeletonBox className="h-24 border-b border-border pb-4" />
            <SkeletonBox className="h-80" />
            <SkeletonBox className="h-20" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <SkeletonBox className="h-64" />
                <SkeletonBox className="h-64" />
              </div>
              <div className="flex flex-col gap-5">
                <SkeletonBox className="h-64" />
                <SkeletonBox className="h-64" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section A — Header metric row + footprint summary */}
            <section aria-label="Overview" className="border-b border-border pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <HeaderMetricRow summary={data?.summary} formatNum={formatNum} />
                <div className="shrink-0 text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Queries in band</div>
                  <div className="text-sm font-semibold tabular-nums text-foreground mt-0.5">
                    Top 10: {queryCounting.top10} · Top 3: {queryCounting.top3}
                  </div>
                </div>
              </div>
            </section>

            {/* Section B — Trend */}
            {data?.daily?.length > 0 && (
              <section aria-label="Trend">
                <div className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-foreground/20">
                  <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-foreground">Performance over time</h2>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer transition-colors duration-150">
                        <input
                          type="checkbox"
                          checked={compareToPrior}
                          onChange={(e) => setCompareToPrior(e.target.checked)}
                          className="rounded border-border transition-all duration-150"
                        />
                        Compare to previous
                      </label>
                      <SparkToggles />
                    </div>
                  </div>
                  <TrendChart
                    data={data.daily}
                    priorData={data?.priorDaily}
                    height={280}
                    showImpressions
                    useSeriesContext
                    compareToPrior={compareToPrior}
                    normalizeWhenMultiSeries
                  />
                </div>
              </section>
            )}

            {/* Query Footprint */}
            {queriesRows.length > 0 && (
              <QueryFootprint
                queries={queriesRows}
                daily={data?.daily ?? []}
              />
            )}

            {/* Opportunity Intelligence */}
            {queriesRows.length > 0 && (
              <OpportunityIntelligence queries={queriesRows} />
            )}

            {/* Movement Intelligence */}
            <MovementIntelligence
              queriesRows={queriesRows}
              pagesRows={pagesRows}
              trendFilter={trendFilter}
              onTrendFilterChange={setTrendFilter}
            />

            {/* Tracked Keywords (collapsible, mock) */}
            <TrackedKeywordsSection keywords={getMockTrackedKeywords(siteUrl)} />

            {/* Section F — Performance tables + Query Counting + Content Groups */}
            <section aria-label="Performance tables" className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">Performance tables</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="flex flex-col gap-5 min-w-0">
                  <DataTable
                    title="Queries"
                    rows={queriesRowsForTable}
                    trendFilter={trendFilter}
                    onTrendFilterChange={setTrendFilter}
                    showFilter
                  />
                  <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 p-3">
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">Query counting</h3>
                    <p className="text-xs text-muted-foreground mb-2">Queries in top 10</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total queries</span>
                        <span className="ml-2 font-semibold tabular-nums text-foreground">{queryCounting.total}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Top 10</span>
                        <span className="ml-2 font-semibold tabular-nums text-foreground">{queryCounting.top10}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Top 3</span>
                        <span className="ml-2 font-semibold tabular-nums text-foreground">{queryCounting.top3}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-5 min-w-0">
                  <DataTable
                    title="Pages"
                    rows={pagesRowsForTable}
                    trendFilter={trendFilter}
                    onTrendFilterChange={setTrendFilter}
                    showFilter
                  />
                  {contentGroups.length > 0 && (() => {
                    const maxClicks = Math.max(...contentGroups.map((g) => g.clicks), 1);
                    const totalGroupClicks = contentGroups.reduce((s, g) => s + g.clicks, 0);
                    return (
                      <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20">
                        <div className="border-b border-border px-4 py-2.5">
                          <h3 className="text-sm font-semibold text-foreground">Content groups</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {contentGroups.length} groups · {formatNum(totalGroupClicks)} clicks
                          </p>
                        </div>
                        <div className="px-4 py-2.5 space-y-2">
                          {contentGroups.map((g) => (
                            <div key={g.label}>
                              <div className="flex items-center justify-between gap-3 mb-0.5">
                                <span className="text-xs font-medium text-foreground truncate max-w-[120px]" title={g.label}>
                                  /{g.label}
                                </span>
                                <div className="flex items-center gap-2 text-xs tabular-nums shrink-0 text-right">
                                  <span className="text-foreground">{formatNum(g.clicks)}</span>
                                  {g.avgChangePercent != null && (
                                    <span className={cn(g.avgChangePercent >= 0 ? "text-positive" : "text-negative")}>
                                      Δ {g.avgChangePercent >= 0 ? "+" : ""}{g.avgChangePercent}%
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">{formatNum(g.impressions)} impr.</span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${(g.clicks / maxClicks) * 100}%`,
                                    background: "var(--chart-clicks)",
                                    opacity: 0.65,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                {countriesRows.length > 0 && <DataTable title="Countries" rows={countriesRows} showFilter={false} />}
                {devicesRows.length > 0 && <DataTable title="Devices" rows={devicesRows} showFilter={false} />}
              </div>
            </section>

            {/* Segmentation (Branded) */}
            {data?.branded && (
              <section aria-label="Segmentation">
                <h2 className="text-sm font-semibold text-foreground mb-2">Segmentation</h2>
                <div className="rounded-lg border border-border bg-surface p-3 transition-colors hover:border-foreground/20">
                  <BrandedChart
                    brandedClicks={data.branded.brandedClicks}
                    nonBrandedClicks={data.branded.nonBrandedClicks}
                    brandedChangePercent={data.branded.brandedChangePercent}
                    nonBrandedChangePercent={data.branded.nonBrandedChangePercent}
                  />
                </div>
              </section>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
