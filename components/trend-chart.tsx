"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useSparkSeries, type SparkSeriesKey } from "@/contexts/spark-series-context";
import { cn } from "@/lib/utils";

export interface SparklineDataPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
}

interface DataPoint {
  date: string;
  clicks: number;
  impressions: number;
}

interface TrendChartProps {
  data: DataPoint[];
  height?: number;
  showImpressions?: boolean;
  className?: string;
}

const CHART_CLICKS = "var(--chart-clicks)";
const CHART_IMPRESSIONS = "var(--chart-impressions)";
const CHART_CTR = "var(--chart-ctr)";
const CHART_POSITION = "var(--chart-position)";

const SERIES_CONFIG: { key: SparkSeriesKey; dataKey: keyof SparklineDataPoint; stroke: string }[] = [
  { key: "clicks", dataKey: "clicks", stroke: CHART_CLICKS },
  { key: "impressions", dataKey: "impressions", stroke: CHART_IMPRESSIONS },
  { key: "ctr", dataKey: "ctr", stroke: CHART_CTR },
  { key: "position", dataKey: "position", stroke: CHART_POSITION },
];

export function TrendChart({
  data,
  height = 80,
  showImpressions = true,
  className,
}: TrendChartProps) {
  if (!data?.length) return null;

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
            labelFormatter={(v) => new Date(v).toLocaleDateString()}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke={CHART_CLICKS}
            strokeWidth={1.5}
            dot={false}
          />
          {showImpressions && (
            <Line
              type="monotone"
              dataKey="impressions"
              stroke={CHART_IMPRESSIONS}
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="3 3"
              strokeOpacity={0.85}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compact sparkline for overview cards: first series = hard base, rest = faint (SEO Gets style) */
export function Sparkline({ data }: { data: SparklineDataPoint[] }) {
  const { series } = useSparkSeries();
  if (!data?.length) return null;

  const visible = SERIES_CONFIG.filter((s) => series[s.key] && data.some((d) => d[s.dataKey] != null));
  if (visible.length === 0) return null;

  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          {visible.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.dataKey}
              stroke={s.stroke}
              strokeWidth={i === 0 ? 2.5 : 1}
              strokeOpacity={i === 0 ? 1 : 0.35}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
