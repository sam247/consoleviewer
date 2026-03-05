"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartPlot } from "@/components/ui/chart-plot";
import {
  CHART_AXIS_TICK,
  CHART_EMPTY_STATE_MIN_H,
  CHART_GRID_PROPS,
  CHART_MARGIN_SECONDARY,
  CHART_PLOT_H,
  CHART_TOOLTIP_STYLE,
  CHART_Y_AXIS_WIDTH_SECONDARY,
  createDateTickFormatter,
} from "@/components/ui/chart-frame";

interface DailyPoint {
  date: string;
  brandedClicks?: number;
  nonBrandedClicks?: number;
}

interface BrandedChartProps {
  brandedClicks: number;
  nonBrandedClicks: number;
  brandedChangePercent?: number;
  nonBrandedChangePercent?: number;
  daily?: DailyPoint[];
  className?: string;
}

function formatNum(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(value);
}

function formatSignedPercent(value?: number): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${value >= 0 ? "+" : ""}${value}%`;
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

  const brandedTrend = (daily ?? [])
    .filter((d) => d.brandedClicks != null || d.nonBrandedClicks != null)
    .map((d) => ({
      date: d.date,
      brandedClicks: d.brandedClicks ?? 0,
      nonBrandedClicks: d.nonBrandedClicks ?? 0,
    }));

  const hasBrandedTrend = brandedTrend.length >= 2;
  const dateTickFormatter = createDateTickFormatter(brandedTrend.length || 30);

  const splitBars = [
    {
      label: "Branded",
      value: brandedClicks > 0 ? brandedClicks : 1,
      rawValue: brandedClicks,
      color: "var(--chart-clicks)",
    },
    {
      label: "Non-branded",
      value: nonBrandedClicks > 0 ? nonBrandedClicks : 1,
      rawValue: nonBrandedClicks,
      color: "var(--chart-impressions)",
    },
  ];

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="mb-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5">
          <span className="text-xs text-muted-foreground">Branded</span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums text-foreground">{formatNum(brandedClicks)}</span>
            {formatSignedPercent(brandedChangePercent) && (
              <span className={cn("text-xs tabular-nums", brandedChangePercent! >= 0 ? "text-positive" : "text-negative")}>{formatSignedPercent(brandedChangePercent)}</span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5">
          <span className="text-xs text-muted-foreground">Non-branded</span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums text-foreground">{formatNum(nonBrandedClicks)}</span>
            {formatSignedPercent(nonBrandedChangePercent) && (
              <span className={cn("text-xs tabular-nums", nonBrandedChangePercent! >= 0 ? "text-positive" : "text-negative")}>{formatSignedPercent(nonBrandedChangePercent)}</span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5">
          <span className="text-xs text-muted-foreground">Branded share</span>
          <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{brandedPct.toFixed(1)}%</div>
        </div>
      </div>

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-[var(--chart-clicks)]" style={{ width: `${brandedPct}%` }} />
      </div>

      <div className="mb-1 text-[11px] text-muted-foreground">{hasBrandedTrend ? "Branded trend over time" : "Branded split"}</div>

      <ChartPlot
        height={CHART_PLOT_H.spark}
        minHeight={CHART_EMPTY_STATE_MIN_H.spark}
      >
        <ResponsiveContainer width="100%" height="100%">
          {hasBrandedTrend ? (
            <LineChart data={brandedTrend} margin={CHART_MARGIN_SECONDARY}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                dataKey="date"
                tick={CHART_AXIS_TICK}
                tickFormatter={dateTickFormatter}
                minTickGap={14}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                padding={{ left: 2, right: 2 }}
              />
              <YAxis
                width={CHART_Y_AXIS_WIDTH_SECONDARY}
                tick={CHART_AXIS_TICK}
                tickFormatter={(v) => (Number(v) >= 1e3 ? `${(Number(v) / 1e3).toFixed(1)}k` : String(v))}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(v) =>
                  new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                }
              />
              <Line type="monotone" dataKey="brandedClicks" stroke="var(--chart-clicks)" strokeWidth={1.9} dot={false} />
              <Line type="monotone" dataKey="nonBrandedClicks" stroke="var(--chart-impressions)" strokeWidth={1.3} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={splitBars} margin={CHART_MARGIN_SECONDARY}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={6} />
              <YAxis
                width={CHART_Y_AXIS_WIDTH_SECONDARY}
                tick={CHART_AXIS_TICK}
                tickFormatter={(v) => (Number(v) >= 1e3 ? `${(Number(v) / 1e3).toFixed(1)}k` : String(v))}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(_value: number | undefined, _name, item) => [String((item.payload as { rawValue?: number })?.rawValue ?? 0), "Clicks"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={42}>
                {splitBars.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </ChartPlot>
    </div>
  );
}
