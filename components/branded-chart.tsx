"use client";

import { cn } from "@/lib/utils";

interface BrandedChartProps {
  brandedClicks: number;
  nonBrandedClicks: number;
  brandedChangePercent?: number;
  nonBrandedChangePercent?: number;
  className?: string;
}

function formatNum(n: number): string {
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export function BrandedChart({
  brandedClicks,
  nonBrandedClicks,
  brandedChangePercent,
  nonBrandedChangePercent,
  className,
}: BrandedChartProps) {
  const total = brandedClicks + nonBrandedClicks;
  const brandedPct = total > 0 ? (brandedClicks / total) * 100 : 0;

  return (
    <div className={cn(className)}>
      <div className="mb-2 font-semibold text-sm text-foreground">
        Branded vs non‑branded
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Branded</span>
          <span className="font-medium">{formatNum(brandedClicks)}</span>
          {brandedChangePercent != null && (
            <span
              className={cn(
                "tabular-nums",
                brandedChangePercent >= 0 ? "text-positive" : "text-negative"
              )}
            >
              {brandedChangePercent >= 0 ? "+" : ""}
              {brandedChangePercent}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Non‑branded</span>
          <span className="font-medium">{formatNum(nonBrandedClicks)}</span>
          {nonBrandedChangePercent != null && (
            <span
              className={cn(
                "tabular-nums",
                nonBrandedChangePercent >= 0 ? "text-positive" : "text-negative"
              )}
            >
              {nonBrandedChangePercent >= 0 ? "+" : ""}
              {nonBrandedChangePercent}%
            </span>
          )}
        </div>
        <div className="text-muted-foreground">
          {brandedPct.toFixed(1)}% branded
        </div>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden flex">
        <div
          className="h-full bg-blue-500"
          style={{ width: `${brandedPct}%` }}
        />
        <div
          className="h-full bg-slate-400"
          style={{ width: `${100 - brandedPct}%` }}
        />
      </div>
    </div>
  );
}
