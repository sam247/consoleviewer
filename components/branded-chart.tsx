"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
} from "@/components/ui/chart-frame";

interface DailyPoint {
  date: string;
  clicks?: number;
  impressions?: number;
}

interface BrandedChartProps {
  brandedClicks: number;
  nonBrandedClicks: number;
  brandedChangePercent?: number;
  nonBrandedChangePercent?: number;
  /** Daily series for trend graph; uses clicks when present */
  daily?: DailyPoint[];
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
  daily,
  className,
}: BrandedChartProps) {
  const total = brandedClicks + nonBrandedClicks;
  const brandedPct = total > 0 ? (brandedClicks / total) * 100 : 0;
  const chartData = (daily ?? []).map((d) => ({
    date: d.date,
    clicks: d.clicks ?? 0,
    impressions: d.impressions ?? 0,
  }));

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="mb-1.5 font-semibold text-sm text-foreground">Branded vs non-branded</div>
      <p className="text-xs text-muted-foreground mb-1.5">Compared to prior period</p>
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
      <div className="mt-1.5 h-2 w-full rounded-full bg-muted overflow-hidden flex shrink-0">
        <div
          className="h-full bg-blue-500"
          style={{ width: `${brandedPct}%` }}
        />
        <div
          className="h-full bg-slate-400"
          style={{ width: `${100 - brandedPct}%` }}
        />
      </div>
      {chartData.length >= 2 && (
        <div className="mt-4 w-full min-w-0 flex-1 min-h-0 flex flex-col">
          <p className="text-[10px] text-muted-foreground mb-1 shrink-0">Clicks over time</p>
          <div className="w-full flex-1 min-h-[140px]" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 18 }}
            >
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                dataKey="date"
                tick={CHART_AXIS_TICK}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                width={32}
                domain={["dataMin", "dataMax"]}
                tick={CHART_AXIS_TICK}
                tickFormatter={(v) => (Number(v) >= 1e3 ? `${(Number(v) / 1e3).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Clicks"]}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="var(--chart-clicks)"
                strokeWidth={2}
                dot={false}
                name="Clicks"
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
