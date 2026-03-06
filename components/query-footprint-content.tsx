"use client";

import { useEffect, useState } from "react";
import {
  ReferenceLine,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/info-tooltip";
import { ChartPlot } from "@/components/ui/chart-plot";
import {
  CHART_AXIS_TICK,
  CHART_MARGIN_SPARK,
  CHART_PLOT_H,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
  createDateTickFormatter,
} from "@/components/ui/chart-frame";
export type BandFilter = { min: number; max: number } | null;

type FootprintView = "total" | "bands";

interface QueryFootprintContentProps {
  view: FootprintView;
  setView: (v: FootprintView) => void;
  total: number;
  bands: { label: string; min: number; max: number; count: number; color: string; deltaPercent?: number }[];
  maxBandCount: number;
  sparkData: { date: string; clicks: number }[];
  queryCounting?: { total: number; top10: number; top3: number };
  queryCountingDaily?: { date: string; totalQueries: number; top10: number; top3: number }[];
  pillStats: { label: string; value: number; deltaPercent?: number }[];
  rootClassName: string;
  onBandSelect?: (band: BandFilter) => void;
  selectedBand: BandFilter;
  compareToPrior?: boolean;
}

export function QueryFootprintContent({
  view,
  setView,
  total,
  bands,
  maxBandCount,
  sparkData,
  queryCounting,
  queryCountingDaily = [],
  pillStats,
  rootClassName,
  onBandSelect,
  selectedBand,
  compareToPrior,
}: QueryFootprintContentProps) {
  const [barMounted, setBarMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBarMounted(true), 50);
    return () => clearTimeout(t);
  }, []);
  const sparkTickFormatter = createDateTickFormatter(sparkData.length);

  return (
    <div className={rootClassName}>
      <div className="border-b border-border px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">
            Query footprint
            <InfoTooltip title="Distribution of queries by ranking band (Top 3, 4–10, etc.)" />
          </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribution by ranking band
              {compareToPrior && (
                <span className="ml-1.5 text-muted-foreground/80">· Comparing to prior period</span>
              )}
            </p>
          </div>
          <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
            {(["total", "bands"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-[120ms]",
                  view === v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {v === "total" ? "Total" : "By ranking band"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col px-4 pt-3 pb-3 min-w-0 overflow-visible">
        {view === "total" ? (
          <div className="flex flex-col gap-3">
            <div className="flex h-2 w-full rounded-sm overflow-hidden bg-muted/30 shrink-0">
              {bands.map((b) => (
                <div
                  key={b.label}
                  className="h-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-[120ms]"
                  style={{
                    width: total ? `${(b.count / total) * 100}%` : "0%",
                    minWidth: b.count > 0 ? "4px" : 0,
                  }}
                  title={`${b.label}: ${b.count} queries${total ? ` (${Math.round((b.count / total) * 100)}%)` : ""}`}
                  onClick={() => onBandSelect?.({ min: b.min, max: b.max })}
                  onKeyDown={(e) => e.key === "Enter" && onBandSelect?.({ min: b.min, max: b.max })}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="h-full transition-[transform] duration-300 ease-out"
                    style={{
                      transform: barMounted ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                      background: b.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 w-full min-w-0">
              {pillStats.map((stat) => {
                const isAll = stat.label === "Total";
                const band: BandFilter = isAll ? null : stat.label === "Top 3" ? { min: 1, max: 3 } : stat.label === "Top 10" ? { min: 1, max: 10 } : stat.label === "Top 20" ? { min: 1, max: 20 } : null;
                const isSelected = isAll ? selectedBand === null : (selectedBand != null && band != null && selectedBand.min === band.min && selectedBand.max === band.max);
                const handleClick = () => onBandSelect?.(band ?? null);
                return (
                  <button
                    key={stat.label}
                    type="button"
                    className={cn(
                      "flex flex-col rounded px-2 py-1.5 text-left transition-colors duration-[120ms] min-w-0",
                      (onBandSelect != null) && "cursor-pointer hover:bg-accent/50",
                      isSelected && "ring-2 ring-foreground/30 bg-accent/50"
                    )}
                    onClick={onBandSelect ? handleClick : undefined}
                    title={total ? `${stat.label}: ${stat.value} queries (${stat.label !== "Total" ? Math.round((stat.value / total) * 100) + "%" : "total"})` : undefined}
                  >
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className="text-xl font-semibold tabular-nums text-foreground leading-tight">
                      {stat.value}
                      {total > 0 && stat.label !== "Total" && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({Math.round((stat.value / total) * 100)}%)
                        </span>
                      )}
                    </span>
                    <span className={cn(
                      "text-[10px] mt-0.5 tabular-nums",
                      stat.deltaPercent != null
                        ? stat.deltaPercent >= 0
                          ? "text-positive"
                          : "text-negative"
                        : "text-muted-foreground/80"
                    )}>
                      {stat.deltaPercent != null ? `${stat.deltaPercent >= 0 ? "+" : ""}${stat.deltaPercent}% vs prior` : "— vs prior"}
                    </span>
                  </button>
                );
              })}
            </div>
            <ChartPlot
              height={CHART_PLOT_H.spark}
              minHeight={CHART_PLOT_H.spark}
              isEmpty={sparkData.length === 0}
              emptyMessage="No recent trend data."
              className="shrink-0"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData} margin={CHART_MARGIN_SPARK}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis
                    dataKey="date"
                    tick={CHART_AXIS_TICK}
                    tickFormatter={sparkTickFormatter}
                    minTickGap={12}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    padding={{ left: 2, right: 2 }}
                  />
                  <YAxis hide tick={CHART_AXIS_TICK} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), "Clicks"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="var(--chart-clicks)"
                    strokeWidth={1.6}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPlot>
          </div>
        ) : (
          <div className="space-y-2.5">
            {bands.map((b) => {
              const isSelected = selectedBand != null && selectedBand.min === b.min && selectedBand.max === b.max;
              const pct = total ? Math.round((b.count / total) * 100) : 0;
              return (
                <button
                  key={b.label}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 w-full rounded px-1 py-0.5 -mx-1 transition-all duration-[120ms] text-left",
                    onBandSelect && "cursor-pointer hover:bg-accent/60",
                    isSelected && "ring-2 ring-foreground/30 bg-accent/50"
                  )}
                  onClick={() => onBandSelect?.({ min: b.min, max: b.max })}
                  title={`${b.label}: ${b.count} queries (${pct}%) — click to filter table`}
                >
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{b.label}</span>
                  <div className="flex-1 h-5 rounded-sm bg-muted/40 overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-sm transition-[width] duration-300 ease-out"
                      style={{
                        width: barMounted ? `${(b.count / maxBandCount) * 100}%` : "0%",
                        background: b.color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-foreground w-8 text-right">{b.count}</span>
                  {total > 0 && (
                    <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                      {pct}%
                    </span>
                  )}
                  <span className={cn(
                    "text-[10px] w-14 text-right shrink-0 tabular-nums",
                    b.deltaPercent != null ? (b.deltaPercent >= 0 ? "text-positive" : "text-negative") : "text-muted-foreground/80"
                  )}>
                    {b.deltaPercent != null ? `${b.deltaPercent >= 0 ? "+" : ""}${b.deltaPercent}% vs prior` : "— vs prior"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {queryCounting && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                Total queries <span className="ml-1 font-semibold tabular-nums text-foreground">{queryCounting.total}</span>
              </span>
              <span>
                Top 10 <span className="ml-1 font-semibold tabular-nums text-foreground">{queryCounting.top10}</span>
              </span>
              <span>
                Top 3 <span className="ml-1 font-semibold tabular-nums text-foreground">{queryCounting.top3}</span>
              </span>
            </div>
            <div className="mt-2">
              <ChartPlot
                height={CHART_PLOT_H.spark}
                minHeight={CHART_PLOT_H.spark}
                isEmpty={queryCountingDaily.length === 0}
                emptyMessage="No query-count trend data for this range."
                className="shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={queryCountingDaily} margin={CHART_MARGIN_SPARK}>
                    <CartesianGrid {...CHART_GRID_PROPS} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.55} />
                    <XAxis
                      dataKey="date"
                      tick={CHART_AXIS_TICK}
                      tickFormatter={(d: string) =>
                        new Date(d).toLocaleDateString("en-GB", { month: "numeric", day: "numeric" })
                      }
                      minTickGap={14}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      padding={{ left: 2, right: 2 }}
                    />
                    <YAxis hide tick={CHART_AXIS_TICK} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(v: number | undefined, key?: string) => [
                        (v ?? 0).toLocaleString(),
                        key === "totalQueries" ? "Total queries" : key === "top10" ? "Top 10" : (key ?? "Value"),
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalQueries"
                      stroke="var(--chart-impressions)"
                      strokeWidth={1.8}
                      strokeDasharray="5 4"
                      dot={false}
                      name="Total queries"
                    />
                    <Line
                      type="monotone"
                      dataKey="top10"
                      stroke="var(--chart-clicks)"
                      strokeWidth={2.2}
                      dot={false}
                      name="Top 10"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPlot>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
