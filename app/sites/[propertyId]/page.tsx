"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { TrendChart } from "@/components/trend-chart";
import { DataTable, type DataTableRow, type TrendFilter } from "@/components/data-table";
import { BrandedChart } from "@/components/branded-chart";
import { useDateRange } from "@/contexts/date-range-context";
import { decodePropertyId } from "@/types/gsc";
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

function ExecutiveSummary({
  data,
  formatNum,
}: {
  data: { summary?: { clicks: number; impressions: number; clicksChangePercent?: number; impressionsChangePercent?: number } };
  formatNum: (n: number) => string;
}) {
  const s = data?.summary;
  if (!s) return null;
  const ctrPct = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Clicks</div>
        <div className="text-3xl font-semibold tabular-nums text-foreground mt-0.5">
          {formatNum(s.clicks)}
        </div>
        {s.clicksChangePercent != null && (
          <span
            className={cn(
              "text-sm tabular-nums",
              s.clicksChangePercent >= 0 ? "text-positive" : "text-negative"
            )}
          >
            {s.clicksChangePercent >= 0 ? "+" : ""}
            {s.clicksChangePercent}%
          </span>
        )}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Impressions</div>
        <div className="text-2xl font-semibold tabular-nums text-foreground mt-0.5">
          {formatNum(s.impressions)}
        </div>
        {s.impressionsChangePercent != null && (
          <span
            className={cn(
              "text-sm tabular-nums",
              s.impressionsChangePercent >= 0 ? "text-positive" : "text-negative"
            )}
          >
            {s.impressionsChangePercent >= 0 ? "+" : ""}
            {s.impressionsChangePercent}%
          </span>
        )}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">CTR</div>
        <div className="text-2xl font-semibold tabular-nums text-foreground mt-0.5">
          {ctrPct.toFixed(2)}%
        </div>
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
  const topDecayingPage = useMemo(() => {
    const decaying = pagesRows.filter((r) => (r.changePercent ?? 0) < 0).sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
    return decaying[0];
  }, [pagesRows]);

  return (
    <section aria-label="Movement intelligence">
      <h2 className="text-sm font-semibold text-foreground mb-3">Movement intelligence</h2>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-1">
          {(["all", "growing", "decaying"] as const).map((t) => (
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
        {topGrowingQuery && (
          <div className="text-xs text-muted-foreground">
            Top growing query: <span className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom" title={topGrowingQuery.key}>{topGrowingQuery.key}</span>
            <span className="text-positive ml-1">+{topGrowingQuery.changePercent}%</span>
          </div>
        )}
        {topDecayingPage && (
          <div className="text-xs text-muted-foreground">
            Top decaying page: <span className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom" title={topDecayingPage.key}>{topDecayingPage.key}</span>
            <span className="text-negative ml-1">{topDecayingPage.changePercent}%</span>
          </div>
        )}
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
          <div className="space-y-10">
            <div className="flex gap-6">
              <SkeletonBox className="h-24 flex-1" />
              <SkeletonBox className="h-24 flex-1" />
            </div>
            <SkeletonBox className="h-72" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <SkeletonBox key={i} className="h-64" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Section A — Executive Summary */}
            <section aria-label="Executive summary">
              <ExecutiveSummary data={data} formatNum={formatNum} />
            </section>

            {/* Section B — Trend */}
            {data?.daily?.length > 0 && (
              <section aria-label="Trend">
                <div className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-foreground/20">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Performance over time</h2>
                  <TrendChart data={data.daily} height={260} showImpressions />
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

            {/* Section D — Performance Tables */}
            <section aria-label="Performance tables">
              <h2 className="text-sm font-semibold text-foreground mb-4">Performance tables</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <DataTable
                  title="Queries"
                  rows={queriesRows}
                  trendFilter={trendFilter}
                  onTrendFilterChange={setTrendFilter}
                  showFilter={false}
                />
                <DataTable
                  title="Pages"
                  rows={pagesRows}
                  trendFilter={trendFilter}
                  onTrendFilterChange={setTrendFilter}
                  showFilter={false}
                />
                <DataTable title="Countries" rows={countriesRows} />
              </div>
            </section>

            {/* Section E — Segmentation */}
            {(data?.branded || devicesRows.length > 0) && (
              <section aria-label="Segmentation">
                <h2 className="text-sm font-semibold text-foreground mb-4">Segmentation</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {data?.branded && (
                    <div className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-foreground/20">
                      <BrandedChart
                        brandedClicks={data.branded.brandedClicks}
                        nonBrandedClicks={data.branded.nonBrandedClicks}
                        brandedChangePercent={data.branded.brandedChangePercent}
                        nonBrandedChangePercent={data.branded.nonBrandedChangePercent}
                      />
                    </div>
                  )}
                  {devicesRows.length > 0 && (
                    <DataTable title="Devices" rows={devicesRows} />
                  )}
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
