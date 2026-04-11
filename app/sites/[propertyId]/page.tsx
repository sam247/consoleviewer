"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { AiPanelShell } from "@/components/ai-panel-shell";
import { SkeletonBox } from "@/components/skeleton-box";
import { usePropertyData } from "@/hooks/use-property-data";
import { cn } from "@/lib/utils";

import { ProjectSimplifiedTrendSection } from "@/components/sections/project-simplified-trend-section";
import { ProjectSimplifiedTrackersSection } from "@/components/sections/project-simplified-trackers-section";
import { ProjectSimplifiedChangeTablesSection } from "@/components/sections/project-simplified-change-tables-section";
import { ContentPerformanceCard } from "@/components/content-performance-card";
import { QuickWinsCard } from "@/components/quick-wins-card";
import { LightSignalsStrip } from "@/components/light-signals-strip";
import { CustomizeDashboardCard } from "@/components/customize-dashboard-card";
import { SiteIdentity } from "@/components/site-identity";
import { PerformanceSnapshotStrip, PerformanceSnapshotSummary } from "@/components/performance-snapshot-strip";
import { EmailSummaryGenerator } from "@/components/email-summary-generator";

function formatHeaderDate(value?: string) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function calcLagDays(endDate?: string) {
  if (!endDate) return null;
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const utcEnd = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const days = Math.max(0, Math.floor((utcNow - utcEnd) / (24 * 60 * 60 * 1000)));
  return days;
}

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
    siteUrl,
    isLoading,
    error,
    endDate,
    startDate,
  } = usePropertyData(propertyId);

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
          extraActions={
            <EmailSummaryGenerator
              domain={siteUrl ?? ""}
              startDate={startDate}
              endDate={endDate}
              summary={data?.summary ?? null}
              newQueries={data?.newQueries ?? []}
              lostQueries={data?.lostQueries ?? []}
              pagesRows={pagesRows}
              queriesRows={queriesRows}
            />
          }
        />
        <main className="flex-1 p-3 md:p-6">
          <div className="mx-auto max-w-[86rem]">
          <div className="mb-4">
            {!isLoading ? (
              <>
                <div className="mb-1">
                  <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                    ← Overview
                  </Link>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <SiteIdentity siteUrl={siteUrl} textClassName="text-lg font-medium text-foreground" faviconSize={22} />
                  <PerformanceSnapshotStrip summary={data.summary} className="shrink-0 w-[560px]" />
                </div>

                <div className="mt-1 flex items-start justify-between gap-6">
                  <div className="text-xs text-muted-foreground">
                    <span>Updated: {formatHeaderDate(endDate) ?? "—"}</span>
                    <span className="mx-2">•</span>
                    <span>Refresh: daily</span>
                    {(() => {
                      const lag = calcLagDays(endDate);
                      if (!lag || lag < 2) return null;
                      return (
                        <>
                          <span className="mx-2">•</span>
                          <span>Data lag: {lag}d</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="min-w-0 flex justify-end">
                    <LightSignalsStrip
                      summary={data.summary}
                      newQueries={data.newQueries}
                      lostQueries={data.lostQueries}
                      pagesRows={pagesRows}
                      className="justify-end min-w-0 max-h-[52px] overflow-hidden"
                    />
                  </div>
                </div>

                <PerformanceSnapshotSummary summary={data.summary} className="mt-2" />
              </>
            ) : null}
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
                    <QuickWinsCard queries={queriesRows} />
                  </div>
                </div>
                <ProjectSimplifiedChangeTablesSection propertyId={propertyId} queriesRows={queriesRows} pagesRows={pagesRows} />
                <CustomizeDashboardCard propertyId={propertyId} />
              </>
            </div>
          )}
          </div>
        </main>
        <AiPanelShell />
      </div>
  );
}
