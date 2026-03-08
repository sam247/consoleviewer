"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function buildDeterministicSummary(movements: RadarMovementItem[]): string {
  if (!movements.length) return "No significant day-on-day movement right now.";
  const top = movements[0];
  const metricLabel = top.primaryMetric === "clicks" ? "clicks" : "impressions";
  const directionLabel = top.delta >= 0 ? "up" : "down";
  return `${siteLabel(top.siteUrl)} leads movement today (${metricLabel} ${directionLabel} ${Math.abs(Math.round(top.delta))}).`;
}

const RadarIcon = () => (
  <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" opacity="0.65" />
    <path d="M12 12l5.5-3.5" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export function DashboardRadar({
  metrics,
  isLoading,
}: {
  metrics: SiteOverviewMetrics[];
  isLoading?: boolean;
}) {
  const movements = useMemo(() => buildMovements(metrics), [metrics]);
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!movements.length) {
      setSummary(buildDeterministicSummary([]));
      return;
    }
    const fallback = buildDeterministicSummary(movements);
    setSummary(fallback);
    const controller = new AbortController();
    setSummaryLoading(true);
    fetch("/api/ai/movement-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        propertyId: "dashboard",
        signals: movements.map((item) => {
          const metricLabel = item.primaryMetric === "clicks" ? "clicks" : "impressions";
          const delta = Math.round(item.delta);
          return {
            direction: delta >= 0 ? "growing" : "declining",
            sentence: `${siteLabel(item.siteUrl)} ${metricLabel} ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)}`,
          };
        }),
      }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { summary?: string | null };
        return data.summary?.trim() || null;
      })
      .then((aiSummary) => {
        if (aiSummary) setSummary(aiSummary);
      })
      .catch(() => {
        // Keep deterministic fallback summary.
      })
      .finally(() => {
        setSummaryLoading(false);
      });

    return () => controller.abort();
  }, [movements]);

  return (
    <section className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5 md:px-4">
      <div className="flex items-center gap-2 text-xs">
        <RadarIcon />
        {isLoading ? (
          <span className="text-muted-foreground">Scanning movement…</span>
        ) : movements.length === 0 ? (
          <span className="text-muted-foreground">No significant day-on-day movement right now.</span>
        ) : (
          <div className="min-w-0 flex flex-1 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {summaryLoading ? "Generating overview…" : summary}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-accent"
            >
              {expanded ? "Hide details" : "Details"}
            </button>
          </div>
        )}
      </div>
      {!isLoading && movements.length > 0 && expanded && (
        <div className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-0.5">
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
    </section>
  );
}
