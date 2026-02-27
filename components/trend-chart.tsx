"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

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

/** Compact sparkline for overview cards */
export function Sparkline({ data }: { data: DataPoint[] }) {
  if (!data?.length) return null;

  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="clicks"
            stroke={CHART_CLICKS}
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="impressions"
            stroke={CHART_IMPRESSIONS}
            strokeWidth={1}
            dot={false}
            strokeDasharray="2 2"
            strokeOpacity={0.6}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
