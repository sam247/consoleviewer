"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { TrendChart } from "@/components/trend-chart";
import { DataTable } from "@/components/data-table";
import { BrandedChart } from "@/components/branded-chart";
import { useDateRange } from "@/contexts/date-range-context";
import { decodePropertyId } from "@/types/gsc";
import type { DataTableRow } from "@/components/data-table";
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
    <div className={cn("rounded-lg border border-border bg-background animate-pulse", className)}>
      <div className="h-6 w-1/3 rounded bg-muted m-3" />
      <div className="h-4 w-2/3 rounded bg-muted m-3" />
    </div>
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
        <div className="mb-4">
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
          <div className="space-y-4">
            <div className="flex gap-4">
              <SkeletonBox className="h-20 flex-1" />
              <SkeletonBox className="h-20 flex-1" />
            </div>
            <SkeletonBox className="h-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <SkeletonBox key={i} className="h-64" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-6 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">Clicks</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {data?.summary && formatNum(data.summary.clicks)}
                </div>
                {data?.summary?.clicksChangePercent != null && (
                  <span
                    className={cn(
                      "text-sm",
                      data.summary.clicksChangePercent >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {data.summary.clicksChangePercent >= 0 ? "+" : ""}
                    {data.summary.clicksChangePercent}%
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Impressions</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {data?.summary && formatNum(data.summary.impressions)}
                </div>
                {data?.summary?.impressionsChangePercent != null && (
                  <span
                    className={cn(
                      "text-sm",
                      data.summary.impressionsChangePercent >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {data.summary.impressionsChangePercent >= 0 ? "+" : ""}
                    {data.summary.impressionsChangePercent}%
                  </span>
                )}
              </div>
            </div>

            {data?.daily?.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-4 mb-6">
                <div className="text-sm font-medium text-foreground mb-2">
                  Trend
                </div>
                <TrendChart data={data.daily} height={220} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <DataTable title="Queries" rows={queriesRows} />
              <DataTable title="Pages" rows={pagesRows} />
              <DataTable title="Countries" rows={countriesRows} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <DataTable title="Devices" rows={devicesRows} />
              {data?.branded && (
                <div className="lg:col-span-2">
                  <BrandedChart
                    brandedClicks={data.branded.brandedClicks}
                    nonBrandedClicks={data.branded.nonBrandedClicks}
                    brandedChangePercent={data.branded.brandedChangePercent}
                    nonBrandedChangePercent={data.branded.nonBrandedChangePercent}
                  />
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}
