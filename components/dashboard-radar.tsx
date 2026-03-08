"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { SiteOverviewMetrics } from "@/types/gsc";
import { encodePropertyId } from "@/types/gsc";

interface RadarMovementItem {
  siteUrl: string;
  primaryMetric: "clicks" | "impressions";
  delta: number;
  score: number;
}

function siteLabel(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) return siteUrl.replace("sc-domain:", "");
  return siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function safeDailyDelta(
  daily: { date: string; clicks: number; impressions: number }[] | undefined,
  key: "clicks" | "impressions"
): number {
  if (!daily || daily.length < 2) return 0;
  const latest = daily[daily.length - 1]?.[key] ?? 0;
  const prev = daily[daily.length - 2]?.[key] ?? 0;
  return latest - prev;
}

function buildMovements(metrics: SiteOverviewMetrics[]): RadarMovementItem[] {
  const IMPRESSIONS_WEIGHT = 0.1;
  return metrics
    .map((item) => {
      const clicksDelta = safeDailyDelta(item.daily, "clicks");
      const impressionsDelta = safeDailyDelta(item.daily, "impressions");
      const clickScore = Math.abs(clicksDelta);
      const impressionScore = Math.abs(impressionsDelta) * IMPRESSIONS_WEIGHT;
      const primaryMetric: RadarMovementItem["primaryMetric"] =
        clickScore >= impressionScore ? "clicks" : "impressions";
      const delta = primaryMetric === "clicks" ? clicksDelta : impressionsDelta;
      const score = Math.max(clickScore, impressionScore);
      return {
        siteUrl: item.siteUrl,
        primaryMetric,
        delta,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export function DashboardRadar({
  metrics,
  isLoading,
}: {
  metrics: SiteOverviewMetrics[];
  isLoading?: boolean;
}) {
  const movements = useMemo(() => buildMovements(metrics), [metrics]);

  return (
    <section className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5 md:px-4">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">Radar</span>
        {isLoading ? (
          <span className="text-muted-foreground">Scanning movement…</span>
        ) : movements.length === 0 ? (
          <span className="text-muted-foreground">No significant day-on-day movement right now.</span>
        ) : (
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
            {movements.map((item) => {
              const positive = item.delta > 0;
              const metricLabel = item.primaryMetric === "clicks" ? "Clicks" : "Impr";
              const propertyId = encodePropertyId(item.siteUrl);
              return (
                <Link
                  key={`${item.siteUrl}-${item.primaryMetric}`}
                  href={`/sites/${propertyId}`}
                  className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                >
                  <span className="font-medium">{siteLabel(item.siteUrl)}</span>
                  <span className="mx-1 text-muted-foreground">•</span>
                  <span>{metricLabel}</span>
                  <span className={positive ? "ml-1 text-positive" : "ml-1 text-negative"}>
                    {positive ? "+" : ""}
                    {Math.round(item.delta)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
