"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  ChartFrame,
  createDateTickFormatter,
} from "@/components/ui/chart-frame";

interface DailyPoint {
  date: string;
  position?: number;
}

interface PositionVolatilityChartProps {
  daily: DailyPoint[];
  className?: string;
}

function findCrossings(daily: DailyPoint[], threshold: number): string[] {
  const out: string[] = [];
  for (let i = 1; i < daily.length; i++) {
    const prev = daily[i - 1].position;
    const curr = daily[i].position;
    if (prev == null || curr == null) continue;
    if ((prev > threshold && curr <= threshold) || (prev <= threshold && curr > threshold)) {
      out.push(daily[i].date);
    }
  }
  return out;
}

export function PositionVolatilityChart({ daily, className }: PositionVolatilityChartProps) {
  const dataWithPosition = useMemo(
    () => daily.filter((d) => d.position != null).map((d) => ({ ...d, position: d.position as number })),
    [daily]
  );

  const crossings10 = useMemo(() => findCrossings(dataWithPosition, 10), [dataWithPosition]);
  const crossings20 = useMemo(() => findCrossings(dataWithPosition, 20), [dataWithPosition]);

  const summaryStats = useMemo(() => {
    const positions = dataWithPosition.map((d) => d.position);
    if (!positions.length) return null;
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const dayOverDay = positions.slice(1).map((p, i) => Math.abs(p - positions[i]));
    const maxSpike = dayOverDay.length > 0 ? Math.max(...dayOverDay) : 0;
    return { min, max, maxSpike };
  }, [dataWithPosition]);

  const tickFormatter = useMemo(() => createDateTickFormatter(dataWithPosition.length), [dataWithPosition.length]);

  return (
    <ChartFrame
      title="Position volatility"
      subtitle="Site avg position over time · Top 10 / Top 20 thresholds"
      className={cn("flex min-h-0 flex-col", className)}
      bodyClassName="flex flex-1 flex-col gap-2"
    >
      <div>
        {summaryStats ? (
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            Position drift: {(summaryStats.max - summaryStats.min).toFixed(1)} (range {summaryStats.min.toFixed(1)}–
            {summaryStats.max.toFixed(1)}) · Max spike: {summaryStats.maxSpike.toFixed(1)}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">No average position values available in this range.</p>
        )}
        {(crossings10.length > 0 || crossings20.length > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {crossings10.length > 0 && `Top 10 crossings: ${crossings10.length}. `}
            {crossings20.length > 0 && `Top 20 crossings: ${crossings20.length}.`}
          </p>
        )}
      </div>

      <ChartPlot
        height={CHART_PLOT_H.secondary}
        minHeight={CHART_EMPTY_STATE_MIN_H.secondary}
        isEmpty={dataWithPosition.length === 0}
        emptyMessage="No position data in this range."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataWithPosition} margin={CHART_MARGIN_SECONDARY}>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              dataKey="date"
              tick={CHART_AXIS_TICK}
              tickFormatter={tickFormatter}
              minTickGap={14}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              width={CHART_Y_AXIS_WIDTH_SECONDARY}
              domain={["dataMin", "dataMax"]}
              tick={CHART_AXIS_TICK}
              tickFormatter={(v) => String(Number(v).toFixed(1))}
              reversed
              tickLine={false}
              axisLine={false}
              tickMargin={6}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={CHART_TOOLTIP_STYLE}
              labelFormatter={(v) =>
                new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
              }
              formatter={(value: number | undefined) => [(value ?? 0).toFixed(1), "Position"]}
            />
            <ReferenceLine
              y={10}
              stroke="var(--chart-ctr)"
              strokeDasharray="4 4"
              strokeOpacity={0.75}
              strokeWidth={1}
            />
            <ReferenceLine
              y={20}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="position"
              stroke="var(--chart-position)"
              strokeWidth={1.8}
              dot={false}
              name="Avg position"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartPlot>
    </ChartFrame>
  );
}
