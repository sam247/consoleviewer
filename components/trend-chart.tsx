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

/** Normalize a series to 0-1 range so multiple metrics are all visible (each uses full vertical scale) */
function normalizeSeries(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

/** Compact sparkline: each enabled metric normalized to its own scale so all are visible in different colours (SEO Gets style) */
export function Sparkline({ data }: { data: SparklineDataPoint[] }) {
  const { series } = useSparkSeries();
  if (!data?.length) return null;

  const visible = SERIES_CONFIG.filter((s) => series[s.key] && data.some((d) => d[s.dataKey] != null));
  if (visible.length === 0) return null;

  const normalizedData = data.map((point, i) => {
    const out: Record<string, string | number> = { date: point.date };
    visible.forEach((s) => {
      const raw = point[s.dataKey];
      if (raw == null) return;
      const values = data.map((d) => (d[s.dataKey] as number) ?? 0);
      const norm = normalizeSeries(values);
      out[`_norm_${s.key}`] = norm[i];
    });
    return out;
  });

  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalizedData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={[0, 1]} />
          {visible.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={`_norm_${s.key}`}
              stroke={s.stroke}
              strokeWidth={i === 0 ? 2.5 : 1.5}
              strokeOpacity={i === 0 ? 1 : 0.7}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
