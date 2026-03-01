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

interface DailyPoint {
  date: string;
  position?: number;
}

interface PositionVolatilityChartProps {
  daily: DailyPoint[];
  className?: string;
  height?: number;
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

export function PositionVolatilityChart({ daily, className, height = 110 }: PositionVolatilityChartProps) {
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
    <div className={cn("rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20", className)}>
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Position volatility</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Site avg position over time · Top 10 / Top 20 thresholds
        </p>
        {summaryStats && (
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Avg position drift: {summaryStats.max - summaryStats.min} (range {summaryStats.min.toFixed(1)}–{summaryStats.max.toFixed(1)}) · Max spike: {summaryStats.maxSpike.toFixed(1)}
          </p>
        )}
        {(crossings10.length > 0 || crossings20.length > 0) && (
          <p className="text-xs text-muted-foreground mt-1">
            {crossings10.length > 0 && `Entered top 10: ${crossings10.map((d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })).join(", ")}. `}
            {crossings20.length > 0 && `Crossed pos 20: ${crossings20.map((d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })).join(", ")}.`}
          </p>
        )}
      </div>
      <div className="px-4 py-2.5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataWithPosition} margin={{ top: 4, right: 8, left: 36, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              width={36}
              domain={["auto", "auto"]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => String(Number(v).toFixed(1))}
              reversed
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={{
                fontSize: 11,
                padding: "6px 10px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
              labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              formatter={(value: number | undefined) => [(value ?? 0).toFixed(1), "Position"]}
            />
            <ReferenceLine y={10} stroke="var(--chart-ctr)" strokeDasharray="3 3" strokeOpacity={0.8} />
            <ReferenceLine y={20} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeOpacity={0.6} />
            <Line
              type="monotone"
              dataKey="position"
              stroke="var(--chart-position)"
              strokeWidth={2}
              strokeOpacity={1}
              dot={false}
              name="Avg position"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
