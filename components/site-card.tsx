"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { SiteOverviewMetrics } from "@/types/gsc";
import { encodePropertyId } from "@/types/gsc";
import { Sparkline } from "./trend-chart";
import { useDateRange } from "@/contexts/date-range-context";
import { cn } from "@/lib/utils";

interface SiteCardProps {
  metrics: SiteOverviewMetrics;
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function displayUrl(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || siteUrl;
}

export function SiteCard({ metrics }: SiteCardProps) {
  const propertyId = encodePropertyId(metrics.siteUrl);
  const href = `/sites/${propertyId}`;
  const queryClient = useQueryClient();
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();

  const prefetchDetail = () => {
    queryClient.prefetchQuery({
      queryKey: [
        "siteDetail",
        metrics.siteUrl,
        startDate,
        endDate,
        priorStartDate,
        priorEndDate,
      ],
      queryFn: async () => {
        const params = new URLSearchParams({
          site: metrics.siteUrl,
          startDate,
          endDate,
          priorStartDate,
          priorEndDate,
        });
        const res = await fetch(`/api/analytics/detail?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      },
    });
  };

  return (
    <Link
      href={href}
      onMouseEnter={prefetchDetail}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--background)] p-4",
        "hover:border-[var(--foreground)]/20 hover:bg-[var(--accent)] transition-colors"
      )}
    >
      <div className="mb-2 font-medium text-[var(--foreground)] truncate">
        {displayUrl(metrics.siteUrl)}
      </div>
      <div className="flex items-baseline gap-3 text-sm">
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted-foreground)]">Clicks</span>
          <span className="font-medium">{formatNum(metrics.clicks)}</span>
          <ChangeBadge value={metrics.clicksChangePercent} />
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted-foreground)]">Impressions</span>
          <span className="font-medium">{formatNum(metrics.impressions)}</span>
          <ChangeBadge value={metrics.impressionsChangePercent} />
        </span>
      </div>
      <div className="mt-3">
        <Sparkline data={metrics.daily} />
      </div>
    </Link>
  );
}

function ChangeBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={cn(
        "text-xs",
        positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {positive ? "+" : ""}{value}%
    </span>
  );
}
