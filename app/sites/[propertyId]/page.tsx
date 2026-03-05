"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { SkeletonBox } from "@/components/skeleton-box";
import { QueryFootprint, type BandFilter } from "@/components/query-footprint";
import { AiQuerySignalsCard } from "@/components/ai-query-signals-card";
import { usePropertyData } from "@/hooks/use-property-data";
import { cn } from "@/lib/utils";

import { OverviewSection } from "@/components/sections/overview-section";
import { TrendSection } from "@/components/sections/trend-section";
import { InsightsSection } from "@/components/sections/insights-section";
import { VolatilityBrandedSection } from "@/components/sections/volatility-branded-section";
import { OpportunitySection } from "@/components/sections/opportunity-section";
import { IndexCannibalisationSection } from "@/components/sections/index-cannibalisation-section";
import { PerformanceTablesSection } from "@/components/sections/performance-tables-section";
import { AddMetricSection } from "@/components/sections/add-metric-section";

export default function SiteDetailPage({
  params,
}: {
  params: { propertyId: string };
}) {
  const { propertyId } = params;

  const {
    data,
    queriesRows,
    pagesRows,
    queryCounting,
    dailyForCharts,
    siteUrl,
    siteSlug,
    startDate,
    endDate,
    isLoading,
    error,
    cannibalisationData,
    cannibalisationLoading,
    cannibalisationError,
  } = usePropertyData(propertyId);

  const [bandFilter, setBandFilter] = useState<BandFilter>(null);
  const [contentMounted, setContentMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setContentMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header shareScope="project" shareScopeId={propertyId} />
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
      <Header shareScope="project" shareScopeId={propertyId} />
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
            <div className="space-y-5">
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
            <div className={cn("space-y-4 transition-opacity duration-200", contentMounted ? "opacity-100" : "opacity-0")}>
              <OverviewSection summary={data.summary} queryCounting={queryCounting} endDate={endDate} />

              {data.daily.length > 0 && (
                <TrendSection
                  data={data}
                  queriesRows={queriesRows}
                  dailyForCharts={dailyForCharts}
                  siteSlug={siteSlug}
                  startDate={startDate}
                  endDate={endDate}
                  bandFilter={bandFilter}
                  onBandSelect={setBandFilter}
                />
              )}

              <InsightsSection
                queriesRows={queriesRows}
                daily={data.daily}
                propertyId={propertyId}
                siteSlug={siteSlug}
                startDate={startDate}
                endDate={endDate}
              />

              {data.daily.length > 0 && (
                <VolatilityBrandedSection
                  data={data}
                  daily={data.daily}
                  propertyId={propertyId}
                />
              )}

              {!data.daily.length && queriesRows.length > 0 && (
                <>
                  <QueryFootprint
                    queries={queriesRows}
                    daily={dailyForCharts}
                    onBandSelect={setBandFilter}
                    selectedBand={bandFilter}
                  />
                  <AiQuerySignalsCard queries={queriesRows} />
                </>
              )}

              <OpportunitySection
                queriesRows={queriesRows}
                pagesRows={pagesRows}
                siteSlug={siteSlug}
                startDate={startDate}
                endDate={endDate}
                propertyId={propertyId}
              />

              <IndexCannibalisationSection
                propertyId={propertyId}
                pagesRows={pagesRows}
                cannibalisationData={cannibalisationData}
                cannibalisationLoading={cannibalisationLoading}
                cannibalisationError={cannibalisationError ?? null}
              />

              <PerformanceTablesSection
                data={data}
                queriesRows={queriesRows}
                pagesRows={pagesRows}
                dailyForCharts={dailyForCharts}
                queryCounting={queryCounting}
                bandFilter={bandFilter}
                onClearBandFilter={() => setBandFilter(null)}
                siteSlug={siteSlug}
                startDate={startDate}
                endDate={endDate}
              />

              <AddMetricSection
                countriesRows={data.countries}
                devicesRows={data.devices}
                siteSlug={siteSlug}
                startDate={startDate}
                endDate={endDate}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
