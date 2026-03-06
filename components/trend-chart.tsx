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

export type SearchEngine = "google" | "bing";

interface TrendChartProps {
  data: DataPoint[];
  priorData?: DataPoint[];
  /** When provided with selectedEngines, chart renders per-engine series (metric = line style, engine = colour). */
  dataByEngine?: { google: DataPoint[]; bing?: DataPoint[] };
  selectedEngines?: SearchEngine[];
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
const CHART_ENGINE_GOOGLE = "var(--chart-engine-google)";
const CHART_ENGINE_BING = "var(--chart-engine-bing)";

const ENGINE_COLORS: Record<SearchEngine, string> = {
  google: CHART_ENGINE_GOOGLE,
  bing: CHART_ENGINE_BING,
};

/** Metric → line style (strokeDasharray, strokeWidth). */
const METRIC_STYLE: Record<SparkSeriesKey, { strokeDasharray?: string; strokeWidth: number }> = {
  clicks: { strokeWidth: 2.5 },
  impressions: { strokeDasharray: "6 4", strokeWidth: 2 },
  ctr: { strokeDasharray: "2 2", strokeWidth: 1.2 },
  position: { strokeWidth: 1.2 },
};

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

const MAX_PER_ENGINE_LINES = 4;

function buildMergedDataByEngine(
  dataByEngine: { google: DataPoint[]; bing?: DataPoint[] },
  selectedEngines: SearchEngine[]
): Record<string, string | number>[] {
  const google = dataByEngine.google ?? [];
  const bing = dataByEngine.bing ?? [];
  const dateSet = new Set<string>([
    ...google.map((d) => d.date),
    ...bing.map((d) => d.date),
  ]);
  const dates = Array.from(dateSet).sort();
  const byDate = (arr: DataPoint[]) => {
    const m = new Map(arr.map((d) => [d.date, d]));
    return m;
  };
  const googleByDate = byDate(google);
  const bingByDate = byDate(bing);

  return dates.map((date) => {
    const row: Record<string, string | number> = { date };
    if (selectedEngines.includes("google")) {
      const g = googleByDate.get(date);
      if (g) {
        row.clicks_google = g.clicks;
        row.impressions_google = g.impressions;
        if (g.ctr != null) row.ctr_google = g.ctr;
        if (g.position != null) row.position_google = g.position;
      }
    }
    if (selectedEngines.includes("bing")) {
      const b = bingByDate.get(date);
      if (b) {
        row.clicks_bing = b.clicks;
        row.impressions_bing = b.impressions;
        if (b.ctr != null) row.ctr_bing = b.ctr;
        if (b.position != null) row.position_bing = b.position;
      }
    }
    return row;
  });
}

export function TrendChart({
  data,
  priorData,
  dataByEngine,
  selectedEngines = ["google"],
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
  const usePerEngine = dataByEngine != null && selectedEngines.length > 0;
  const mergedDataByEngine = useMemo(
    () =>
      dataByEngine && selectedEngines.length
        ? buildMergedDataByEngine(dataByEngine, selectedEngines)
        : [],
    [dataByEngine, selectedEngines]
  );
  const dateTickFormatter = useMemo(
    () =>
      createDateTickFormatter(
        usePerEngine ? mergedDataByEngine.length : (data?.length ?? 0)
      ),
    [usePerEngine, mergedDataByEngine.length, data?.length]
  );
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

  const perEngineSeriesToShow = useMemo(() => {
    if (!usePerEngine || selectedEngines.length === 0) return [];
    const pairs: { metric: SparkSeriesKey; engine: SearchEngine; dataKey: string; label: string; stroke: string; strokeDasharray?: string; strokeWidth: number }[] = [];
    for (const s of visibleSeries) {
      for (const engine of selectedEngines) {
        const dataKey = `${s.dataKey}_${engine}` as keyof SparklineDataPoint;
        pairs.push({
          metric: s.key,
          engine,
          dataKey: `${s.dataKey}_${engine}`,
          label: `${s.label} (${engine === "google" ? "Google" : "Bing"})`,
          stroke: ENGINE_COLORS[engine],
          ...METRIC_STYLE[s.key],
        });
      }
    }
    return pairs.slice(0, MAX_PER_ENGINE_LINES);
  }, [usePerEngine, selectedEngines, visibleSeries]);

  const useNormalized =
    !usePerEngine &&
    normalizeWhenMultiSeries &&
    useSeriesContext &&
    visibleSeries.length > 0 &&
    (data?.length ?? 0) > 0;

  const chartData = useMemo(() => {
    if (usePerEngine && mergedDataByEngine.length > 0) return mergedDataByEngine;

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
  }, [compareToPrior, data, priorData, useNormalized, useSeriesContext, visibleSeries, usePerEngine, mergedDataByEngine]);

  const useDualAxis =
    !usePerEngine &&
    !useNormalized &&
    showClicks &&
    showImpr &&
    !showCtr &&
    !showPosition &&
    (data?.length ?? 0) > 0;

  const yDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length) return undefined;
    const keys = usePerEngine
      ? (["clicks_google", "clicks_bing", "impressions_google", "impressions_bing", "ctr_google", "ctr_bing", "position_google", "position_bing"] as const)
      : (["clicks", "impressions", "ctr", "position"] as (keyof DataPoint)[]);
    let min = Infinity;
    let max = -Infinity;

    chartData.forEach((d) => {
      keys.forEach((k) => {
        const v = (d as Record<string, unknown>)[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      });
    });

    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, usePerEngine]);

  const leftDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length || !useDualAxis) return undefined;
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((d) => {
      const v = d.clicks;
      if (typeof v === "number" && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      const vp = (d as Record<string, number>).clicksPrior;
      if (typeof vp === "number" && Number.isFinite(vp)) {
        min = Math.min(min, vp);
        max = Math.max(max, vp);
      }
    });
    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, useDualAxis]);

  const rightDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length || !useDualAxis) return undefined;
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((d) => {
      const v = d.impressions;
      if (typeof v === "number" && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      if (compareToPrior && (d as Record<string, number>).impressionsPrior != null) {
        const vp = (d as Record<string, number>).impressionsPrior;
        if (Number.isFinite(vp)) {
          min = Math.min(min, vp);
          max = Math.max(max, vp);
        }
      }
    });
    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, useDualAxis, compareToPrior]);

  const hasData = usePerEngine ? mergedDataByEngine.length > 0 : (data?.length ?? 0) > 0;
  if (!hasData) {
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

  const marginWithDualAxis = useDualAxis
    ? { ...chartMargin, right: (chartMargin.right ?? 6) + yAxisWidth }
    : chartMargin;

  return (
    <ChartPlot height={height} minHeight={height} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={marginWithDualAxis}>
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

          {useDualAxis ? (
            <>
              <YAxis
                yAxisId="left"
                width={yAxisWidth}
                domain={leftDomain ?? ["auto", "auto"]}
                tick={CHART_AXIS_TICK}
                tickCount={5}
                tickFormatter={(value) => compactNumber(Number(value))}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                width={yAxisWidth}
                domain={rightDomain ?? ["auto", "auto"]}
                tick={CHART_AXIS_TICK}
                tickCount={5}
                tickFormatter={(value) => compactNumber(Number(value))}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
              />
            </>
          ) : (
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
          )}

          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 3" }}
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

          {usePerEngine
            ? perEngineSeriesToShow.map((s) => (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  strokeDasharray={s.strokeDasharray}
                  dot={false}
                  name={s.label}
                />
              ))
            : null}

          {!usePerEngine && useNormalized
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
          {!usePerEngine && useNormalized && compareToPrior && priorData?.length
            ? visibleSeries.map((s) => (
                <Line
                  key={`${s.key}-prior`}
                  type="monotone"
                  dataKey={`_norm_${s.key}Prior`}
                  stroke={s.stroke}
                  strokeWidth={1}
                  strokeDasharray="5 4"
                  strokeOpacity={0.45}
                  dot={false}
                  name={`${s.label} (prior)`}
                />
              ))
            : null}

          {showClicks && !useNormalized && !usePerEngine && (
            <>
              <Area
                type="monotone"
                dataKey="clicks"
                fill="url(#trend-fill-clicks)"
                stroke="none"
                {...(useDualAxis && { yAxisId: "left" })}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke={CHART_CLICKS}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1.5, fill: CHART_CLICKS, stroke: "var(--surface)" }}
                name="Clicks"
                {...(useDualAxis && { yAxisId: "left" })}
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
                  {...(useDualAxis && { yAxisId: "left" })}
                />
              )}
            </>
          )}

          {showImpr && !useNormalized && !usePerEngine && (
            <>
              <Line
                type="monotone"
                dataKey="impressions"
                stroke={CHART_IMPRESSIONS}
                strokeWidth={2}
                strokeDasharray={showClicks ? "6 4" : undefined}
                dot={false}
                strokeOpacity={0.85}
                name="Impressions"
                {...(useDualAxis && { yAxisId: "right" })}
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
                  {...(useDualAxis && { yAxisId: "right" })}
                />
              )}
            </>
          )}

          {showCtr && !useNormalized && !usePerEngine && (
            <Line
              type="monotone"
              dataKey="ctr"
              stroke={CHART_CTR}
              strokeWidth={1.2}
              dot={false}
              name="CTR"
            />
          )}

          {showPosition && !useNormalized && !usePerEngine && (
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
