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
    const growing = queriesRows.filter((r) => (r.changePercent ?? 0) > 0).sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
    return growing[0];
  }, [queriesRows]);
  const topDecayingQuery = useMemo(() => {
    const decaying = queriesRows.filter((r) => (r.changePercent ?? 0) < 0).sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
    return decaying[0];
  }, [queriesRows]);
  const topGrowingPage = useMemo(() => {
    const growing = pagesRows.filter((r) => (r.changePercent ?? 0) > 0).sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
    return growing[0];
  }, [pagesRows]);
  const topDecayingPage = useMemo(() => {
    const decaying = pagesRows.filter((r) => (r.changePercent ?? 0) < 0).sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
    return decaying[0];
  }, [pagesRows]);

  return (
    <section aria-label="Movement intelligence" className="rounded-lg bg-muted/30 border border-border/50 px-4 py-3">
      <h2 className="text-sm font-semibold text-foreground mb-3">Movement intelligence</h2>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["all", "growing", "decaying", "new", "lost"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTrendFilterChange(t)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                trendFilter === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {(topGrowingQuery || topDecayingQuery || topGrowingPage || topDecayingPage) && (
          <span className="text-border" aria-hidden>|</span>
        )}
        {topGrowingQuery && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="text-positive shrink-0" aria-hidden>↑</span>
            Top growing query: <span className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom" title={topGrowingQuery.key}>{topGrowingQuery.key}</span>
            <span className="text-positive ml-1">+{topGrowingQuery.changePercent}%</span>
          </div>
        )}
        {topDecayingQuery && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="text-negative shrink-0" aria-hidden>↓</span>
            Top decaying query: <span className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom" title={topDecayingQuery.key}>{topDecayingQuery.key}</span>
            <span className="text-negative ml-1">{topDecayingQuery.changePercent}%</span>
          </div>
        )}
        {topGrowingPage && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="text-positive shrink-0" aria-hidden>↑</span>
            Top growing page: <span className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom" title={topGrowingPage.key}>{topGrowingPage.key}</span>
            <span className="text-positive ml-1">+{topGrowingPage.changePercent}%</span>
          </div>
        )}
        {topDecayingPage && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="text-negative shrink-0" aria-hidden>↓</span>
            Top decaying page: <span className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom" title={topDecayingPage.key}>{topDecayingPage.key}</span>
            <span className="text-negative ml-1">{topDecayingPage.changePercent}%</span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-sm text-muted-foreground max-w-prose">AI summary coming soon.</p>
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

  const queriesRows: DataTableRow[] = data?.queries?.map((r: { key: string; clicks: number; impressions: number; changePercent: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];
  const pagesRows: DataTableRow[] = data?.pages?.map((r: { key: string; clicks: number; impressions: number; changePercent: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];
  const newQueriesRows: DataTableRow[] = (data?.newQueries ?? []).map((r: { key: string; clicks: number; impressions: number; changePercent?: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
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
    const groups = new Map<string, { clicks: number; impressions: number }>();
    for (const p of pagesRows) {
      try {
        const pathname = p.key.startsWith("http") ? new URL(p.key).pathname : p.key;
        const segment = pathname.split("/").filter(Boolean)[0] ?? "/";
        const label = segment || "(root)";
        const cur = groups.get(label) ?? { clicks: 0, impressions: 0 };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        groups.set(label, cur);
      } catch {
        const cur = groups.get("(other)") ?? { clicks: 0, impressions: 0 };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        groups.set("(other)", cur);
      }
    }
    return Array.from(groups.entries())
      .map(([label, agg]) => ({ label, ...agg }))
      .sort((a, b) => b.clicks - a.clicks);
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
          <div className="space-y-8">
            <SkeletonBox className="h-24 border-b border-border pb-6" />
            <SkeletonBox className="h-80" />
            <SkeletonBox className="h-20" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-6">
                <SkeletonBox className="h-64" />
                <SkeletonBox className="h-64" />
              </div>
              <div className="flex flex-col gap-6">
                <SkeletonBox className="h-64" />
                <SkeletonBox className="h-64" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Section A — Header metric row (compact) */}
            <section aria-label="Overview" className="border-b border-border pb-6">
              <HeaderMetricRow summary={data?.summary} formatNum={formatNum} />
            </section>

            {/* Section B — Trend */}
            {data?.daily?.length > 0 && (
              <section aria-label="Trend">
                <div className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-foreground/20">
                  <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                    <h2 className="text-sm font-semibold text-foreground">Performance over time</h2>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compareToPrior}
                          onChange={(e) => setCompareToPrior(e.target.checked)}
                          className="rounded border-border"
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
                  />
                </div>
              </section>
            )}

            {/* Section C — Movement Intelligence */}
            <MovementIntelligence
              queriesRows={queriesRows}
              pagesRows={pagesRows}
              trendFilter={trendFilter}
              onTrendFilterChange={setTrendFilter}
            />

            {/* Tracked Keywords (collapsible, mock) */}
            <TrackedKeywordsSection keywords={getMockTrackedKeywords(siteUrl)} />

            {/* Section F — Performance tables + Query Counting + Content Groups */}
            <section aria-label="Performance tables" className="space-y-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">Performance tables</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-6 min-w-0">
                  <DataTable
                    title="Queries"
                    rows={queriesRowsForTable}
                    trendFilter={trendFilter}
                    onTrendFilterChange={setTrendFilter}
                    showFilter
                  />
                  <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Query counting</h3>
                    <div className="flex flex-wrap gap-4 text-sm">
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
                <div className="flex flex-col gap-6 min-w-0">
                  <DataTable
                    title="Pages"
                    rows={pagesRowsForTable}
                    trendFilter={trendFilter}
                    onTrendFilterChange={setTrendFilter}
                    showFilter
                  />
                  {contentGroups.length > 0 && (
                    <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 p-0">
                      <div className="border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold text-foreground">Content groups</h3>
                      </div>
                      <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-surface border-b border-border">
                            <tr className="text-left text-muted-foreground">
                              <th className="px-4 py-2 font-semibold">Group</th>
                              <th className="px-4 py-2 font-semibold text-right">Clicks</th>
                              <th className="px-4 py-2 font-semibold text-right">Impressions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contentGroups.map((g) => (
                              <tr key={g.label} className="border-b border-border/50 last:border-0">
                                <td className="px-4 py-2 text-foreground">{g.label}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{formatNum(g.clicks)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{formatNum(g.impressions)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {countriesRows.length > 0 && <DataTable title="Countries" rows={countriesRows} showFilter={false} />}
                {devicesRows.length > 0 && <DataTable title="Devices" rows={devicesRows} showFilter={false} />}
              </div>
            </section>

            {/* Segmentation (Branded) */}
            {data?.branded && (
              <section aria-label="Segmentation">
                <h2 className="text-sm font-semibold text-foreground mb-3">Segmentation</h2>
                <div className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-foreground/20">
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
