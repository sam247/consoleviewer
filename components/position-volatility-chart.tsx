"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartFrame,
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
} from "@/components/ui/chart-frame";

interface DailyPoint {
  date: string;
  position?: number;
}

interface PositionVolatilityChartProps {
  daily: DailyPoint[];
  className?: string;
}

/** Detect dates where position crosses a threshold (e.g. 10 or 20) */
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
    () => daily.filter((d) => d.position != null).map((d) => ({ ...d, position: d.position! })),
    [daily]
  );
  const crossings10 = useMemo(() => findCrossings(dataWithPosition, 10), [dataWithPosition]);
  const crossings20 = useMemo(() => findCrossings(dataWithPosition, 20), [dataWithPosition]);

  const summaryStats = useMemo(() => {
    const positions = dataWithPosition.map((d) => d.position);
    if (positions.length === 0) return null;
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const dayOverDay = positions.slice(1).map((p, i) => Math.abs(p - positions[i]));
    const maxSpike = dayOverDay.length > 0 ? Math.max(...dayOverDay) : 0;
    return { min, max, maxSpike };
  }, [dataWithPosition]);

  if (dataWithPosition.length === 0) return null;

  return (
    <ChartFrame
      title="Position volatility"
      subtitle="Site avg position over time · Top 10 / Top 20 thresholds"
      className={cn("flex flex-col min-h-[280px]", className)}
      bodyClassName="shrink-0"
    >
      <div>
        {summaryStats && (
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Avg position drift: {summaryStats.max - summaryStats.min} (range {summaryStats.min.toFixed(1)}–{summaryStats.max.toFixed(1)}) · Max spike: {summaryStats.maxSpike.toFixed(1)}
          </p>
        )}
        {(crossings10.length > 0 || crossings20.length > 0) && (
          <p className="text-xs text-muted-foreground mt-1">
            {crossings10.length > 0 && `Top 10 crossings: ${crossings10.length}. `}
            {crossings20.length > 0 && `Top 20 crossings: ${crossings20.length}.`}
          </p>
        )}
      </div>
      <div className="shrink-0 min-w-0 pt-1" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dataWithPosition} margin={{ top: 6, right: 8, left: 22, bottom: 14 }}>
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
              width={34}
              domain={["dataMin", "dataMax"]}
              tick={CHART_AXIS_TICK}
              tickFormatter={(v) => String(Number(v).toFixed(1))}
              reversed
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={CHART_TOOLTIP_STYLE}
              labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              formatter={(value: number | undefined) => [(value ?? 0).toFixed(1), "Position"]}
            />
            <ReferenceLine y={10} stroke="var(--chart-ctr)" strokeDasharray="2 3" strokeOpacity={0.75} strokeWidth={1} />
            <ReferenceLine y={20} stroke="var(--muted-foreground)" strokeDasharray="2 3" strokeOpacity={0.55} strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="position"
              stroke="var(--chart-position)"
              strokeWidth={1.8}
              strokeOpacity={1}
              dot={false}
              name="Avg position"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
