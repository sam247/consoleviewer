"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { AiPanelShell } from "@/components/ai-panel-shell";
import { SkeletonBox } from "@/components/skeleton-box";
import { usePropertyData } from "@/hooks/use-property-data";
import { cn } from "@/lib/utils";

import { ProjectViewTabs, type ProjectViewTab } from "@/components/project-view-tabs";
import { ProjectSimplifiedTrendSection } from "@/components/sections/project-simplified-trend-section";
import { ProjectSimplifiedTrackersSection } from "@/components/sections/project-simplified-trackers-section";
import { ProjectSimplifiedChangeTablesSection } from "@/components/sections/project-simplified-change-tables-section";
import { ContentPerformanceCard } from "@/components/content-performance-card";
import { QuickWinsCard } from "@/components/quick-wins-card";
import { ProjectAnalysisTab } from "@/components/sections/project-analysis-tab";
import { LightSignalsStrip } from "@/components/light-signals-strip";
import { CustomizeDashboardCard } from "@/components/customize-dashboard-card";
import { SiteIdentity } from "@/components/site-identity";
import { PerformanceSnapshotStrip } from "@/components/performance-snapshot-strip";

export default function SiteDetailPage({
  params,
}: {
  params: { propertyId: string };
}) {
  const { propertyId } = params;
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as ProjectViewTab | null) ?? "overview";

  const {
    data,
    queriesRows,
    pagesRows,
    queryCounting,
    siteUrl,
    siteSlug,
    startDate,
    endDate,
    sparklines,
    queryAppearances,
    isLoading,
    error,
    cannibalisationData,
    cannibalisationLoading,
    cannibalisationError,
  } = usePropertyData(propertyId);

  const [bandFilter, setBandFilter] = useState<null | { min: number; max: number }>(null);
  const [contentMounted, setContentMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setContentMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header shareScope="project" shareScopeId={propertyId} showDateRangeSelect={false} aiScope="project" aiPropertyId={propertyId} />
        <main className="flex-1 p-4 md:p-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error instanceof Error ? error.message : "Something went wrong"}
          </div>
          <Link href="/" className="text-sm text-foreground underline mt-2 inline-block">
            Back to overview
          </Link>
        </main>
        <AiPanelShell />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
        <Header
          shareScope="project"
          shareScopeId={propertyId}
          showDateRangeSelect={false}
          aiScope="project"
          aiPropertyId={propertyId}
          aiSiteUrl={siteUrl}
        />
        <main className="flex-1 p-3 md:p-6">
          <div className="mx-auto max-w-[86rem]">
          <div className="mb-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Overview
            </Link>
            <div className="mt-1">
              <SiteIdentity siteUrl={siteUrl} textClassName="text-lg font-medium text-foreground" faviconSize={22} />
            </div>
            {tab !== "analysis" && !isLoading && (
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <LightSignalsStrip summary={data.summary} newQueries={data.newQueries} lostQueries={data.lostQueries} pagesRows={pagesRows} />
                </div>
                <PerformanceSnapshotStrip summary={data.summary} className="lg:pl-4" />
              </div>
            )}
            <div className="mt-3">
              <ProjectViewTabs />
            </div>
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
            <div className={cn("space-y-8 transition-opacity duration-200", contentMounted ? "opacity-100" : "opacity-0")}>
              {tab === "analysis" ? (
                <ProjectAnalysisTab
                  propertyId={propertyId}
                  data={data}
                  queriesRows={queriesRows}
                  pagesRows={pagesRows}
                  queryCounting={queryCounting}
                  endDate={endDate}
                  startDate={startDate}
                  siteSlug={siteSlug}
                  bandFilter={bandFilter}
                  onBandSelect={setBandFilter}
                  onClearBandFilter={() => setBandFilter(null)}
                  querySparklines={sparklines}
                  queryAppearances={queryAppearances}
                  cannibalisationData={cannibalisationData}
                  cannibalisationLoading={cannibalisationLoading}
                  cannibalisationError={cannibalisationError ?? null}
                />
              ) : (
                <>
                  <div id="overview-performance">
                    <ProjectSimplifiedTrendSection data={data} propertyId={propertyId} />
                  </div>
                  <div id="overview-ai-led">
                    <ProjectSimplifiedTrackersSection propertyId={propertyId} queriesRows={queriesRows} siteUrl={siteUrl} />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
                    <div id="overview-content-performance">
                      <ContentPerformanceCard propertyId={propertyId} />
                    </div>
                    <div id="overview-quick-wins">
                      <QuickWinsCard queries={queriesRows} avgCtr={data.summary?.ctr ?? 0} />
                    </div>
                  </div>
                  <ProjectSimplifiedChangeTablesSection propertyId={propertyId} queriesRows={queriesRows} pagesRows={pagesRows} />
                  <CustomizeDashboardCard propertyId={propertyId} />
                </>
              )}
            </div>
          )}
          </div>
        </main>
        <AiPanelShell />
      </div>
  );
}
