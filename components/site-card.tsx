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
      title={metrics.siteUrl}
      className={cn(
        "block rounded-lg border border-border bg-surface p-5 transition-all duration-150 cursor-pointer",
        "hover:border-foreground/20 hover:shadow-sm hover:-translate-y-0.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <div
        className="mb-4 font-medium text-foreground truncate text-sm"
        title={metrics.siteUrl}
      >
        {displayUrl(metrics.siteUrl)}
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {formatNum(metrics.clicks)}
        </span>
        <ChangeBadge value={metrics.clicksChangePercent} size="sm" />
      </div>
      <p className="text-xs text-muted-foreground mb-3">Clicks</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatNum(metrics.impressions)}
        </span>
        <ChangeBadge value={metrics.impressionsChangePercent} size="xs" />
      </div>
      <p className="text-xs text-muted-foreground mb-4">Impressions</p>
      <div className="pt-1">
        <Sparkline data={metrics.daily} />
      </div>
    </Link>
  );
}

function ChangeBadge({
  value,
  size = "sm",
}: {
  value: number;
  size?: "xs" | "sm";
}) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={cn(
        size === "xs" ? "text-xs" : "text-sm",
        "text-right tabular-nums",
        positive ? "text-positive" : "text-negative"
      )}
    >
      {positive ? "+" : ""}{value}%
    </span>
  );
}
