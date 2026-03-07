"use client";

import { cn } from "@/lib/utils";

export interface SearchEngineShareCardProps {
  googleClicks: number;
  bingClicks: number;
  googleImpressions?: number;
  bingImpressions?: number;
  className?: string;
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export function SearchEngineShareCard({
  googleClicks,
  bingClicks,
  googleImpressions = 0,
  bingImpressions = 0,
  className,
}: SearchEngineShareCardProps) {
  const totalClicks = googleClicks + bingClicks;
  const totalImpressions = googleImpressions + bingImpressions;
  const googlePct = totalClicks > 0 ? Math.round((googleClicks / totalClicks) * 100) : 0;
  const bingPct = totalClicks > 0 ? Math.round((bingClicks / totalClicks) * 100) : 0;

  if (totalClicks === 0 && totalImpressions === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]",
        className
      )}
      aria-label="Search engine traffic share"
    >
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
        Search engine traffic
      </h3>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full bg-[#4285f4]"
            aria-hidden
          />
          <span className="text-muted-foreground">Google</span>
          <span className="font-medium tabular-nums text-foreground">
            {totalClicks > 0 ? `${googlePct}%` : "—"}
          </span>
          {totalClicks > 0 && (
            <span className="text-muted-foreground text-xs">
              ({formatNum(googleClicks)} clicks)
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full bg-[#008373]"
            aria-hidden
          />
          <span className="text-muted-foreground">Bing</span>
          <span className="font-medium tabular-nums text-foreground">
            {totalClicks > 0 ? `${bingPct}%` : "—"}
          </span>
          {totalClicks > 0 && (
            <span className="text-muted-foreground text-xs">
              ({formatNum(bingClicks)} clicks)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
