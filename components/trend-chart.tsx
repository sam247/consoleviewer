"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSparkSeries, type SparkSeriesKey } from "@/contexts/spark-series-context";
import { ChartPlot } from "@/components/ui/chart-plot";
import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_MARGIN_PRIMARY,
  CHART_MARGIN_SECONDARY,
  CHART_MARGIN_SPARK,
  CHART_PLOT_H,
  CHART_TOOLTIP_STYLE,
  CHART_Y_AXIS_WIDTH_PRIMARY,
  CHART_Y_AXIS_WIDTH_SECONDARY,
  createDateTickFormatter,
} from "@/components/ui/chart-frame";

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
  position?: number;
}

export type ChartAnnotation = { id?: string; date: string; label: string; color?: string };

interface TrendChartProps {
  data: DataPoint[];
  priorData?: DataPoint[];
  height?: number;
  showImpressions?: boolean;
  useSeriesContext?: boolean;
  compareToPrior?: boolean;
  normalizeWhenMultiSeries?: boolean;
  margin?: { top?: number; right?: number; left?: number; bottom?: number };
  className?: string;
  annotations?: ChartAnnotation[];
}

const CHART_CLICKS = "var(--chart-clicks)";
const CHART_IMPRESSIONS = "var(--chart-impressions)";
const CHART_CTR = "var(--chart-ctr)";
const CHART_POSITION = "var(--chart-position)";

const SERIES_CONFIG: { key: SparkSeriesKey; dataKey: keyof SparklineDataPoint; stroke: string; label: string }[] = [
  { key: "clicks", dataKey: "clicks", stroke: CHART_CLICKS, label: "Clicks" },
  { key: "impressions", dataKey: "impressions", stroke: CHART_IMPRESSIONS, label: "Impressions" },
  { key: "ctr", dataKey: "ctr", stroke: CHART_CTR, label: "CTR" },
  { key: "position", dataKey: "position", stroke: CHART_POSITION, label: "Avg position" },
];

function normalizeSeries(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

function compactNumber(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  if (value < 1 && value > 0) return value.toFixed(2);
  return String(Math.round(value));
}

function formatTooltipValue(key: SparkSeriesKey, value: number): string {
  if (key === "ctr") return `${value.toFixed(2)}%`;
  if (key === "position") return value.toFixed(1);
  return compactNumber(value);
}

function buildChartMargin(height: number, marginOverride?: TrendChartProps["margin"]) {
  const base = height >= CHART_PLOT_H.primary ? CHART_MARGIN_PRIMARY : CHART_MARGIN_SECONDARY;
  return marginOverride ? { ...base, ...marginOverride } : base;
}

function SparklineTooltip({
  active,
  label,
  data,
  visible,
}: {
  active?: boolean;
  label?: string;
  data: SparklineDataPoint[];
  visible: typeof SERIES_CONFIG;
}) {
  if (!active || !label) return null;
  const raw = data.find((d) => d.date === label);
  if (!raw) return null;

  return (
    <div
      className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
      style={CHART_TOOLTIP_STYLE}
    >
      <div className="mb-1.5 font-medium text-foreground">
        {new Date(label).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div className="flex flex-col gap-0.5 text-muted-foreground">
        {visible.map((s) => {
          const v = raw[s.dataKey];
          if (v == null) return null;
          return (
            <span key={s.key} className="tabular-nums">
              {s.label}: {formatTooltipValue(s.key, v as number)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function TrendChart({
  data,
  priorData,
  height = CHART_PLOT_H.secondary,
  showImpressions = true,
  useSeriesContext = false,
  compareToPrior = false,
  normalizeWhenMultiSeries = false,
  margin: marginOverride,
  className,
  annotations = [],
}: TrendChartProps) {
  const { series } = useSparkSeries();
  const chartMargin = buildChartMargin(height, marginOverride);
  const dateTickFormatter = useMemo(() => createDateTickFormatter(data?.length ?? 0), [data?.length]);
  const yAxisWidth = height >= CHART_PLOT_H.primary ? CHART_Y_AXIS_WIDTH_PRIMARY : CHART_Y_AXIS_WIDTH_SECONDARY;

  const showClicks = useSeriesContext ? series?.clicks !== false : true;
  const showImpr = useSeriesContext ? series?.impressions === true : showImpressions;
  const showCtr = useSeriesContext ? series?.ctr === true : false;
  const showPosition = useSeriesContext ? series?.position === true : false;

  const visibleSeries = useMemo(
    () =>
      useSeriesContext
        ? SERIES_CONFIG.filter((s) => {
            if (s.key === "clicks") return showClicks;
            if (s.key === "impressions") return showImpr;
            if (s.key === "ctr") return showCtr;
            if (s.key === "position") return showPosition;
            return false;
          })
        : [],
    [showClicks, showCtr, showImpr, showPosition, useSeriesContext]
  );

  const useNormalized =
    normalizeWhenMultiSeries &&
    useSeriesContext &&
    visibleSeries.length > 0 &&
    (data?.length ?? 0) > 0;

  const chartData = useMemo(() => {
    const safeData = data ?? [];
    if (!safeData.length) return [];

    if (!useNormalized) {
      if (useSeriesContext && compareToPrior && priorData?.length) {
        return safeData.map((d, i) => ({
          ...d,
          clicksPrior: priorData[i]?.clicks,
          impressionsPrior: priorData[i]?.impressions,
          ctrPrior: priorData[i]?.ctr,
          positionPrior: priorData[i]?.position,
        }));
      }
      return safeData;
    }

    return safeData.map((point, i) => {
      const out: Record<string, string | number | undefined> = { ...point };
      visibleSeries.forEach((s) => {
        const values = safeData.map((d) => (d[s.dataKey] as number) ?? 0);
        out[`_norm_${s.key}`] = normalizeSeries(values)[i];
      });
      if (compareToPrior && priorData?.length) {
        visibleSeries.forEach((s) => {
          const values = priorData.map((d) => (d[s.dataKey] as number) ?? 0);
          out[`_norm_${s.key}Prior`] = normalizeSeries(values)[i];
        });
      }
      return out;
    });
  }, [compareToPrior, data, priorData, useNormalized, useSeriesContext, visibleSeries]);

  const yDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length) return undefined;
    const keys: (keyof DataPoint)[] = ["clicks", "impressions", "ctr", "position"];
    let min = Infinity;
    let max = -Infinity;

    chartData.forEach((d) => {
      keys.forEach((k) => {
        const v = d[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      });
    });

    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData]);

  if (!data?.length) {
    return (
      <ChartPlot
        height={height}
        minHeight={height}
        isEmpty
        emptyMessage="No performance data in this range."
        className={className}
      />
    );
  }

  return (
    <ChartPlot height={height} minHeight={height} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id="trend-fill-clicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_CLICKS} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_CLICKS} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid {...CHART_GRID_PROPS} />
          <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.55} />
          {annotations.map((a) => (
            <ReferenceLine
              key={a.id ?? a.date + a.label}
              x={a.date}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 2"
              label={{ value: a.label, position: "insideTopRight", fontSize: 10 }}
            />
          ))}
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
            width={yAxisWidth}
            domain={useNormalized ? [0, 1] : yDomain ?? ["auto", "auto"]}
            tick={CHART_AXIS_TICK}
            tickCount={5}
            tickFormatter={(value) => (useNormalized ? `${Math.round(Number(value) * 100)}%` : compactNumber(Number(value)))}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
          />

          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelFormatter={(v) =>
              new Date(v).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            }
            formatter={(value: number | string | undefined, name) => {
              const n = typeof value === "number" ? value : Number(value ?? 0);
              const key = String(name).toLowerCase();
              if (useNormalized || key.includes("_norm_")) {
                return [`${(n * 100).toFixed(1)}%`, String(name).replace(/^_norm_/, "")];
              }
              if (key.includes("ctr")) return [`${n.toFixed(2)}%`, "CTR"];
              if (key.includes("position")) return [n.toFixed(1), "Avg position"];
              return [compactNumber(n), String(name)];
            }}
          />

          {useNormalized
            ? visibleSeries.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={`_norm_${s.key}`}
                  stroke={s.stroke}
                  strokeWidth={s.key === "clicks" ? 2 : 1.3}
                  strokeOpacity={s.key === "impressions" ? 0.9 : 1}
                  dot={false}
                  name={s.label}
                />
              ))
            : null}

          {showClicks && !useNormalized && (
            <>
              <Area type="monotone" dataKey="clicks" fill="url(#trend-fill-clicks)" stroke="none" />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke={CHART_CLICKS}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1.5, fill: CHART_CLICKS, stroke: "var(--surface)" }}
                name="Clicks"
              />
              {compareToPrior && priorData?.length && (
                <Line
                  type="monotone"
                  dataKey="clicksPrior"
                  stroke={CHART_CLICKS}
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="5 4"
                  strokeOpacity={0.5}
                  name="Clicks (prior)"
                />
              )}
            </>
          )}

          {showImpr && !useNormalized && (
            <>
              <Line
                type="monotone"
                dataKey="impressions"
                stroke={CHART_IMPRESSIONS}
                strokeWidth={1.2}
                dot={false}
                strokeOpacity={0.85}
                name="Impressions"
              />
              {compareToPrior && priorData?.length && (
                <Line
                  type="monotone"
                  dataKey="impressionsPrior"
                  stroke={CHART_IMPRESSIONS}
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="5 4"
                  strokeOpacity={0.45}
                  name="Impressions (prior)"
                />
              )}
            </>
          )}

          {showCtr && !useNormalized && (
            <Line
              type="monotone"
              dataKey="ctr"
              stroke={CHART_CTR}
              strokeWidth={1.2}
              dot={false}
              name="CTR"
            />
          )}

          {showPosition && !useNormalized && (
            <Line
              type="monotone"
              dataKey="position"
              stroke={CHART_POSITION}
              strokeWidth={1.2}
              dot={false}
              name="Avg position"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartPlot>
  );
}

export function Sparkline({ data }: { data: SparklineDataPoint[] }) {
  const { series } = useSparkSeries();
  if (!data?.length) return null;

  const visible = SERIES_CONFIG.filter((s) => series[s.key] && data.some((d) => d[s.dataKey] != null));
  if (!visible.length) return null;

  const normalizedData = data.map((point, i) => {
    const out: Record<string, string | number> = { date: point.date };
    visible.forEach((s) => {
      const values = data.map((d) => (d[s.dataKey] as number) ?? 0);
      out[`_norm_${s.key}`] = normalizeSeries(values)[i];
    });
    return out;
  });

  return (
    <ChartPlot height={CHART_PLOT_H.spark} minHeight={CHART_PLOT_H.spark}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalizedData} margin={CHART_MARGIN_SPARK}>
          <YAxis hide domain={[0, 1]} allowDataOverflow />
          <Tooltip
            content={({ active, label }) => (
              <SparklineTooltip
                active={active}
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
              strokeWidth={1.4}
              dot={false}
              strokeOpacity={0.9}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartPlot>
  );
}
