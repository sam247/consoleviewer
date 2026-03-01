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
  ctr?: number;
}

interface TrendChartProps {
  data: DataPoint[];
  /** When set and compareToPrior is true, prior series are drawn as dashed/muted overlay */
  priorData?: DataPoint[];
  height?: number;
  showImpressions?: boolean;
  /** When true, show which series (clicks/impressions) from SparkSeries context; overrides showImpressions when set */
  useSeriesContext?: boolean;
  /** When true and priorData is provided, overlay prior period series */
  compareToPrior?: boolean;
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
  priorData,
  height = 80,
  showImpressions = true,
  useSeriesContext = false,
  compareToPrior = false,
  className,
}: TrendChartProps) {
  const { series } = useSparkSeries();

  if (!data?.length) return null;

  const showClicks = useSeriesContext ? series?.clicks !== false : true;
  const showImpr = useSeriesContext ? series?.impressions === true : showImpressions;
  const showCtr = useSeriesContext ? series?.ctr === true : false;
  const showPosition = useSeriesContext ? series?.position === true : false;

  const chartData = useSeriesContext && compareToPrior && priorData?.length
    ? data.map((d, i) => ({
        ...d,
        clicksPrior: priorData[i]?.clicks,
        impressionsPrior: priorData[i]?.impressions,
        ctrPrior: priorData[i]?.ctr,
      }))
    : data;

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
              padding: "8px 12px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
            labelFormatter={(v) => new Date(v).toLocaleDateString()}
          />
          {showClicks && (
            <>
              <Line type="monotone" dataKey="clicks" stroke={CHART_CLICKS} strokeWidth={2.5} dot={false} />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="clicksPrior" stroke={CHART_CLICKS} strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.5} name="Prior" />
              )}
            </>
          )}
          {showImpr && (
            <>
              <Line type="monotone" dataKey="impressions" stroke={CHART_IMPRESSIONS} strokeWidth={1} dot={false} strokeDasharray="3 3" strokeOpacity={0.65} />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="impressionsPrior" stroke={CHART_IMPRESSIONS} strokeWidth={1} dot={false} strokeDasharray="5 5" strokeOpacity={0.4} name="Prior" />
              )}
            </>
          )}
          {showCtr && (
            <>
              <Line type="monotone" dataKey="ctr" stroke={CHART_CTR} strokeWidth={1.5} dot={false} />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="ctrPrior" stroke={CHART_CTR} strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.45} name="Prior" />
              )}
            </>
          )}
          {showPosition && (
            <Line type="monotone" dataKey="position" stroke={CHART_POSITION} strokeWidth={1.5} dot={false} />
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

const SERIES_LABELS: Record<SparkSeriesKey, string> = {
  clicks: "Clicks",
  impressions: "Impressions",
  ctr: "CTR",
  position: "Avg position",
};

function formatTooltipValue(key: SparkSeriesKey, value: number): string {
  if (key === "ctr") return `${value.toFixed(2)}%`;
  if (key === "position") return value.toFixed(1);
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(value);
}

function SparklineTooltip({
  active,
  payload,
  label,
  data,
  visible,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: string }[];
  label?: string;
  data: SparklineDataPoint[];
  visible: typeof SERIES_CONFIG;
}) {
  if (!active || !label || !payload?.length) return null;
  const raw = data.find((d) => d.date === label);
  if (!raw) return null;
  const dateStr = new Date(label).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div
      className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="font-medium text-foreground mb-1.5">{dateStr}</div>
      <div className="flex flex-col gap-0.5 text-muted-foreground">
        {visible.map((s) => {
          const v = raw[s.dataKey];
          if (v == null) return null;
          return (
            <span key={s.key} className="tabular-nums">
              {SERIES_LABELS[s.key]}: {formatTooltipValue(s.key, v as number)}
            </span>
          );
        })}
      </div>
    </div>
  );
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
    <div className="h-20 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={normalizedData}
          margin={{ top: 10, right: 4, left: 4, bottom: 10 }}
        >
          <YAxis hide domain={[0, 1]} allowDataOverflow />
          <Tooltip
            content={({ active, payload, label }) => (
              <SparklineTooltip
                active={active}
                payload={payload}
                label={label != null ? String(label) : undefined}
                data={data}
                visible={visible}
              />
            )}
          />
          {visible.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={`_norm_${s.key}`}
              stroke={s.stroke}
              strokeWidth={1.5}
              strokeOpacity={0.9}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
