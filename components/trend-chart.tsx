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
import type { AnalyticsSeries } from "@/lib/analytics-series-normalize";
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
  analyticsSeries?: AnalyticsSeries[];
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
const CHART_ENGINE_BING_CLICKS = "var(--chart-engine-bing-clicks)";
const CHART_ENGINE_BING_IMPRESSIONS = "var(--chart-engine-bing-impressions)";

const ENGINE_COLORS: Record<SearchEngine, string> = {
  google: CHART_ENGINE_GOOGLE,
  bing: CHART_ENGINE_BING,
};

function getEngineMetricStroke(engine: SearchEngine, metric: SparkSeriesKey): string {
  if (engine === "google") {
    const metricColor = SERIES_CONFIG.find((s) => s.key === metric)?.stroke;
    return metricColor ?? CHART_ENGINE_GOOGLE;
  }
  if (engine === "bing") {
    return metric === "impressions" ? CHART_ENGINE_BING_IMPRESSIONS : CHART_ENGINE_BING_CLICKS;
  }
  return ENGINE_COLORS[engine];
}

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

const NORMALIZED_DOMAIN: [number, number] = [-0.06, 1.06];

/** Light 3-point moving average to soften spikey sparse series (e.g. Bing zero-filled days) without changing shape much for dense data. */
export function smoothSeries(values: number[], window = 3): number[] {
  if (values.length < window) return values;
  const half = Math.floor(window / 2);
  return values.map((v, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j];
      count += 1;
    }
    return count ? sum / count : v;
  });
}

/** Smooth clicks/impressions in a daily array when series is sparse (>40% zero days). Used so Bing chart matches dashboard and WMT. */
export function smoothDailyIfSparse<T extends { date: string; clicks?: number; impressions?: number; ctr?: number; position?: number }>(
  daily: T[],
  zeroRatioThreshold = 0.4
): T[] {
  if (!daily.length) return daily;
  const zeroDays = daily.filter((d) => (d.clicks ?? 0) === 0).length;
  if (zeroDays / daily.length < zeroRatioThreshold) return daily;
  const smooth = (arr: number[]) => smoothSeries(arr);
  const clicks = smooth(daily.map((d) => d.clicks ?? 0));
  const impressions = smooth(daily.map((d) => d.impressions ?? 0));
  return daily.map((d, i) => ({
    ...d,
    clicks: clicks[i],
    impressions: impressions[i],
    ctr: impressions[i] > 0 ? (clicks[i] / impressions[i]) * 100 : (d.ctr ?? 0),
  })) as T[];
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

type SparklineSeriesDescriptor = {
  id: string;
  label: string;
  metric: SparkSeriesKey;
  dataKey: string;
  rawValueKey?: string;
  stroke: string;
  strokeDasharray?: string;
  strokeWidth: number;
  connectNulls?: boolean;
};

function SparklineTooltip({
  active,
  label,
  payload,
  rows,
  visible,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: Record<string, string | number | null> }>;
  rows: Record<string, string | number | null>[];
  visible: SparklineSeriesDescriptor[];
}) {
  if (!active) return null;
  const fromPayload =
    payload && payload.length > 0 && payload[0]?.payload
      ? payload[0].payload
      : null;
  const raw =
    fromPayload ??
    (label ? rows.find((d) => d.date === label) ?? null : null);
  if (!raw) return null;
  const dateValue = typeof raw.date === "string" ? raw.date : label;
  if (!dateValue) return null;

  return (
    <div
      className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
      style={CHART_TOOLTIP_STYLE}
    >
      <div className="mb-1.5 font-medium text-foreground">
        {new Date(dateValue).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div className="flex flex-col gap-0.5 text-muted-foreground">
        {visible.map((s) => {
          const rawKey = s.rawValueKey ?? `_raw_${s.dataKey}`;
          const rawValue = raw[rawKey];
          const v = typeof rawValue === "number" ? rawValue : raw[s.dataKey];
          if (typeof v !== "number") return null;
          return (
            <span key={s.id} className="tabular-nums">
              {s.label}: {formatTooltipValue(s.metric, v)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function buildMergedDataByEngine(
  dataByEngine: { google: DataPoint[]; bing?: DataPoint[] },
  selectedEngines: SearchEngine[]
): Record<string, string | number | null>[] {
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
    const row: Record<string, string | number | null> = { date };
    if (selectedEngines.includes("google")) {
      const g = googleByDate.get(date);
      if (g) {
        row.google_clicks = g.clicks;
        row.google_impressions = g.impressions;
        if (g.ctr != null) row.google_ctr = g.ctr;
        if (g.position != null) row.google_position = g.position;
      }
    }
    if (selectedEngines.includes("bing")) {
      const b = bingByDate.get(date);
      row.bing_clicks = b ? b.clicks : null;
      row.bing_impressions = b ? b.impressions : null;
    }
    return row;
  });
}

function buildMergedDataFromSeries(
  series: AnalyticsSeries[],
  selectedEngines: SearchEngine[]
): Record<string, string | number>[] {
  const dateSet = new Set<string>();
  const keyed = new Map<string, number | null>();
  for (const s of series) {
    if (!selectedEngines.includes(s.source)) continue;
    for (const p of s.values) {
      dateSet.add(p.date);
      keyed.set(`${p.date}:${s.metric}_${s.source}`, p.value);
    }
  }
  return Array.from(dateSet)
    .sort()
    .map((date) => {
      const row: Record<string, string | number> = { date };
      for (const source of selectedEngines) {
        const metrics = source === "bing" ? (["clicks", "impressions"] as const) : (["clicks", "impressions", "ctr", "position"] as const);
        for (const metric of metrics) {
          const key = `${date}:${metric}_${source}`;
          const value = keyed.get(key);
          if (value != null) row[`${source}_${metric}`] = value;
        }
      }
      return row;
    });
}

export function TrendChart({
  data,
  priorData,
  analyticsSeries,
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
  const effectiveEngines = selectedEngines;
  const usePerEngine = (analyticsSeries != null || dataByEngine != null) && effectiveEngines.length > 0;
  const mergedDataByEngine = useMemo(
    () => {
      if (!effectiveEngines.length) return [];
      // When Bing overlay is on, use dataByEngine so bing_clicks/bing_impressions are present
      if (dataByEngine?.bing && effectiveEngines.includes("bing")) return buildMergedDataByEngine(dataByEngine, effectiveEngines);
      if (analyticsSeries && analyticsSeries.length) return buildMergedDataFromSeries(analyticsSeries, effectiveEngines);
      if (dataByEngine) return buildMergedDataByEngine(dataByEngine, effectiveEngines);
      return [];
    },
    [dataByEngine, effectiveEngines, analyticsSeries]
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
  const showImpr = useSeriesContext ? series?.impressions !== false : showImpressions;
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
    if (!usePerEngine || effectiveEngines.length === 0) return [];
    const pairs: { metric: SparkSeriesKey; engine: SearchEngine; dataKey: string; label: string; stroke: string; strokeDasharray?: string; strokeWidth: number }[] = [];
    for (const engine of effectiveEngines) {
      const engineMetrics =
        engine === "google"
          ? visibleSeries
          : SERIES_CONFIG.filter((s) => s.key === "clicks" || s.key === "impressions");
      for (const s of engineMetrics) {
        const dataKey = `${engine}_${s.dataKey}`;
        const metricStyle = METRIC_STYLE[s.key];
        const isBingOverlay = engine === "bing";
        const bingDash = isBingOverlay && s.key === "impressions" ? "6 4" : undefined;
        pairs.push({
          metric: s.key,
          engine,
          dataKey,
          label: `${s.label} (${engine === "google" ? "Google" : "Bing"})`,
          stroke: getEngineMetricStroke(engine, s.key),
          strokeWidth: metricStyle.strokeWidth,
          strokeDasharray: isBingOverlay ? bingDash : metricStyle.strokeDasharray,
        });
      }
    }
    return pairs;
  }, [usePerEngine, effectiveEngines, visibleSeries]);

  const useNormalized =
    (
      normalizeWhenMultiSeries ||
      (
        useSeriesContext &&
        visibleSeries.some((s) => s.key === "ctr" || s.key === "position") &&
        visibleSeries.some((s) => s.key === "clicks" || s.key === "impressions")
      )
    ) &&
    useSeriesContext &&
    visibleSeries.length > 0 &&
    (usePerEngine ? mergedDataByEngine.length > 0 : (data?.length ?? 0) > 0);

  const chartData = useMemo(() => {
    if (usePerEngine && mergedDataByEngine.length > 0) {
      if (!useNormalized) return mergedDataByEngine;
      return mergedDataByEngine.map((point, i) => {
        const out: Record<string, string | number | null> = { ...point };
        perEngineSeriesToShow.forEach((s) => {
          const values = mergedDataByEngine.map((d) => {
            const v = (d as Record<string, unknown>)[s.dataKey];
            return typeof v === "number" ? v : 0;
          });
          out[`_norm_${s.dataKey}`] = normalizeSeries(values)[i];
        });
        return out;
      });
    }

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
  }, [compareToPrior, data, priorData, useNormalized, useSeriesContext, visibleSeries, usePerEngine, mergedDataByEngine, perEngineSeriesToShow]);

  const useDualAxis =
    !usePerEngine &&
    !useNormalized &&
    showClicks &&
    showImpr &&
    !showCtr &&
    !showPosition &&
    (data?.length ?? 0) > 0;

  const useDualAxisPerEngine =
    usePerEngine &&
    !useNormalized &&
    perEngineSeriesToShow.some((s) => s.metric === "clicks") &&
    perEngineSeriesToShow.some((s) => s.metric === "impressions") &&
    !perEngineSeriesToShow.some((s) => s.metric === "ctr") &&
    !perEngineSeriesToShow.some((s) => s.metric === "position") &&
    mergedDataByEngine.length > 0;

  // When only one metric (e.g. Clicks) but two engines, use left=Google right=Bing so Bing isn't flattened
  const useDualAxisBySource =
    usePerEngine &&
    !useNormalized &&
    !useDualAxisPerEngine &&
    effectiveEngines.length === 2 &&
    perEngineSeriesToShow.length === 1 &&
    mergedDataByEngine.length > 0;

  const yDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length) return undefined;
    const keys = usePerEngine
      ? perEngineSeriesToShow.map((s) => (useNormalized ? `_norm_${s.dataKey}` : s.dataKey))
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
  }, [chartData, usePerEngine, perEngineSeriesToShow, useNormalized]);

  const leftDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length || (!useDualAxis && !useDualAxisPerEngine && !useDualAxisBySource)) return undefined;
    let min = Infinity;
    let max = -Infinity;
    if (useDualAxisBySource) {
      const firstEngine = effectiveEngines[0];
      const leftKeys = perEngineSeriesToShow
        .filter((s) => s.engine === firstEngine)
        .map((s) => (useNormalized ? `_norm_${s.dataKey}` : s.dataKey));
      chartData.forEach((d) => {
        leftKeys.forEach((k) => {
          const v = (d as Record<string, unknown>)[k];
          if (typeof v === "number" && Number.isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        });
      });
    } else if (useDualAxisPerEngine) {
      const clickKeys = perEngineSeriesToShow
        .filter((s) => s.metric === "clicks")
        .map((s) => (useNormalized ? `_norm_${s.dataKey}` : s.dataKey));
      chartData.forEach((d) => {
        clickKeys.forEach((k) => {
          const v = (d as Record<string, unknown>)[k];
          if (typeof v === "number" && Number.isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        });
      });
    } else {
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
    }
    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, useDualAxis, useDualAxisPerEngine, useDualAxisBySource, effectiveEngines, perEngineSeriesToShow, useNormalized]);

  const rightDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length || (!useDualAxis && !useDualAxisPerEngine && !useDualAxisBySource)) return undefined;
    let min = Infinity;
    let max = -Infinity;
    if (useDualAxisBySource) {
      const secondEngine = effectiveEngines[1];
      const rightKeys = perEngineSeriesToShow
        .filter((s) => s.engine === secondEngine)
        .map((s) => (useNormalized ? `_norm_${s.dataKey}` : s.dataKey));
      chartData.forEach((d) => {
        rightKeys.forEach((k) => {
          const v = (d as Record<string, unknown>)[k];
          if (typeof v === "number" && Number.isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        });
      });
    } else if (useDualAxisPerEngine) {
      const impressionKeys = perEngineSeriesToShow
        .filter((s) => s.metric === "impressions")
        .map((s) => (useNormalized ? `_norm_${s.dataKey}` : s.dataKey));
      chartData.forEach((d) => {
        impressionKeys.forEach((k) => {
          const v = (d as Record<string, unknown>)[k];
          if (typeof v === "number" && Number.isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        });
      });
    } else {
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
    }
    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, useDualAxis, compareToPrior, useDualAxisPerEngine, useDualAxisBySource, effectiveEngines, perEngineSeriesToShow, useNormalized]);

  const hasSelectedSeries = usePerEngine
    ? perEngineSeriesToShow.length > 0
    : useSeriesContext
      ? visibleSeries.length > 0
      : true;

  if (!hasSelectedSeries) {
    return (
      <ChartPlot
        height={height}
        minHeight={height}
        isEmpty
        emptyMessage="No metrics selected."
        className={className}
      />
    );
  }

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

  const marginWithDualAxis = (useDualAxis || useDualAxisPerEngine || useDualAxisBySource)
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

          {useDualAxis || useDualAxisPerEngine || useDualAxisBySource ? (
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
              domain={useNormalized ? NORMALIZED_DOMAIN : yDomain ?? ["auto", "auto"]}
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
                  dataKey={useNormalized ? `_norm_${s.dataKey}` : s.dataKey}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  strokeDasharray={s.strokeDasharray}
                  connectNulls={s.engine === "bing"}
                  dot={false}
                  name={s.label}
                  {...(useDualAxisPerEngine
                    ? { yAxisId: s.metric === "impressions" ? "right" : "left" }
                    : useDualAxisBySource
                      ? { yAxisId: s.engine === effectiveEngines[0] ? "left" : "right" }
                      : {})}
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
                  strokeDasharray="2 2"
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
                  strokeDasharray="2 2"
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
                  strokeDasharray="2 2"
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

const SPARK_CLICKS_AXIS = "clicks";
const SPARK_IMPR_AXIS = "impressions";

function formatSparkMonthDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function Sparkline({
  data,
  bingOverlayData,
}: {
  data: SparklineDataPoint[];
  bingOverlayData?: SparklineDataPoint[];
}) {
  const { series, engines } = useSparkSeries();
  const hasGoogleData = data?.length > 0;
  const hasBingData = Boolean(engines.bing && bingOverlayData?.length);
  const googleCoreHidden = !series.clicks && !series.impressions;
  const bingOnly = googleCoreHidden && engines.bing;

  const googleVisible = useMemo(
    () =>
      hasGoogleData
        ? SERIES_CONFIG.filter(
            (s) => series[s.key] && data.some((d) => d[s.dataKey] != null)
          )
        : [],
    [data, hasGoogleData, series]
  );

  const visible = useMemo((): SparklineSeriesDescriptor[] => {
    const out: SparklineSeriesDescriptor[] = [];
    if (!bingOnly) {
      for (const s of googleVisible) {
        out.push({
          id: `google_${s.key}`,
          label: `${s.label} (Google)`,
          metric: s.key,
          dataKey: `google_${s.key}`,
          rawValueKey: `_raw_google_${s.key}`,
          stroke: s.stroke,
          strokeWidth: 1.4,
        });
      }
    }
    if (hasBingData) {
      out.push({
        id: "bing_clicks",
        label: "Clicks (Bing)",
        metric: "clicks",
        dataKey: "bing_clicks",
        rawValueKey: "_raw_bing_clicks",
        stroke: CHART_ENGINE_BING_CLICKS,
        strokeWidth: 1.4,
        connectNulls: true,
      });
      out.push({
        id: "bing_impressions",
        label: "Impressions (Bing)",
        metric: "impressions",
        dataKey: "bing_impressions",
        rawValueKey: "_raw_bing_impressions",
        stroke: CHART_ENGINE_BING_IMPRESSIONS,
        strokeWidth: 1.4,
        strokeDasharray: "6 4",
        connectNulls: true,
      });
    }
    return out;
  }, [bingOnly, googleVisible, hasBingData]);

  const useDualAxis = useMemo(() => {
    const hasClicks = visible.some((s) => s.metric === "clicks");
    const hasImpressions = visible.some((s) => s.metric === "impressions");
    const hasOther = visible.some((s) => s.metric === "ctr" || s.metric === "position");
    return hasClicks && hasImpressions && !hasOther;
  }, [visible]);

  const chartData = useMemo(() => {
    const google = data ?? [];
    const bing = bingOverlayData ?? [];
    const dateSet = new Set<string>([
      ...google.map((d) => d.date),
      ...bing.map((d) => d.date),
    ]);
    const dates = Array.from(dateSet).sort();
    if (!dates.length || !visible.length) return [];

    const buildSeriesMap = (
      source: SparklineDataPoint[],
      metric: keyof SparklineDataPoint,
      smooth = true
    ): Map<string, number> => {
      if (!source.length) return new Map();
      const values = source.map((d) => (d[metric] as number) ?? 0);
      const outValues = smooth ? smoothSeries(values) : values;
      const out = new Map<string, number>();
      source.forEach((d, i) => out.set(d.date, outValues[i]));
      return out;
    };

    const byKey: Record<string, Map<string, number>> = {
      google_clicks: buildSeriesMap(google, "clicks"),
      google_clicks__raw: buildSeriesMap(google, "clicks", false),
      google_impressions: buildSeriesMap(google, "impressions"),
      google_impressions__raw: buildSeriesMap(google, "impressions", false),
      google_ctr: buildSeriesMap(google, "ctr"),
      google_ctr__raw: buildSeriesMap(google, "ctr", false),
      google_position: buildSeriesMap(google, "position"),
      google_position__raw: buildSeriesMap(google, "position", false),
      bing_clicks: buildSeriesMap(bing, "clicks"),
      bing_clicks__raw: buildSeriesMap(bing, "clicks", false),
      bing_impressions: buildSeriesMap(bing, "impressions"),
      bing_impressions__raw: buildSeriesMap(bing, "impressions", false),
    };

    const rows = dates.map((date) => {
      const row: Record<string, string | number | null> = { date };
      for (const s of visible) {
        const v = byKey[s.dataKey]?.get(date);
        const rawKey = s.dataKey.replace(/^/, "_raw_");
        const rawSeries = byKey[`${s.dataKey}__raw`];
        const rawV = rawSeries?.get(date);
        if (typeof rawV === "number") row[rawKey] = rawV;
        if (typeof v === "number") {
          row[s.dataKey] = v;
        } else if (s.dataKey.startsWith("bing_")) {
          row[s.dataKey] = null;
        }
      }
      return row;
    });

    if (useDualAxis) return rows;

    return rows.map((row, i) => {
      const out = { ...row };
      for (const s of visible) {
        const values = rows.map((r) => {
          const v = r[s.dataKey];
          return typeof v === "number" ? v : 0;
        });
        out[`_norm_${s.dataKey}`] = normalizeSeries(values)[i];
      }
      return out;
    });
  }, [data, bingOverlayData, useDualAxis, visible]);

  const sparkClicksDomain = useMemo((): [number, number] | undefined => {
    if (!useDualAxis || !chartData.length) return undefined;
    const clickKeys = visible.filter((s) => s.metric === "clicks").map((s) => s.dataKey);
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((row) => {
      clickKeys.forEach((k) => {
        const v = (row as Record<string, unknown>)[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      });
    });
    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, useDualAxis, visible]);

  const sparkImprDomain = useMemo((): [number, number] | undefined => {
    if (!useDualAxis || !chartData.length) return undefined;
    const imprKeys = visible.filter((s) => s.metric === "impressions").map((s) => s.dataKey);
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((row) => {
      imprKeys.forEach((k) => {
        const v = (row as Record<string, unknown>)[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      });
    });
    if (min === Infinity || max === -Infinity) return undefined;
    const pad = Math.max(0, (max - min) * 0.06) || (max !== 0 ? Math.abs(max) * 0.06 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [chartData, useDualAxis, visible]);

  const xTicks = useMemo(() => {
    const first = chartData[0]?.date;
    const last = chartData[chartData.length - 1]?.date;
    if (!first) return [] as string[];
    if (!last || last === first) return [first];
    return [first, last];
  }, [chartData]);

  if (!chartData.length || !visible.length) return null;

  return (
    <ChartPlot height={CHART_PLOT_H.spark} minHeight={CHART_PLOT_H.spark}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={CHART_MARGIN_SPARK}>
          <CartesianGrid {...CHART_GRID_PROPS} strokeOpacity={0.22} />
          <XAxis
            dataKey="date"
            ticks={xTicks}
            tickFormatter={(v) => formatSparkMonthDay(String(v))}
            interval={0}
            tickLine={false}
            axisLine={{ stroke: "var(--border)", strokeOpacity: 0.55 }}
            tick={{ ...CHART_AXIS_TICK, fontSize: 9 }}
            height={14}
          />
          {useDualAxis ? (
            <>
              <YAxis
                yAxisId={SPARK_CLICKS_AXIS}
                orientation="left"
                hide
                width={0}
                allowDataOverflow
                domain={sparkClicksDomain ?? ["auto", "auto"]}
              />
              <YAxis
                yAxisId={SPARK_IMPR_AXIS}
                orientation="right"
                hide
                width={0}
                allowDataOverflow
                domain={sparkImprDomain ?? ["auto", "auto"]}
              />
            </>
          ) : (
            <YAxis hide width={0} domain={NORMALIZED_DOMAIN} allowDataOverflow />
          )}
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            content={({ active, label, payload }) => (
              <SparklineTooltip
                active={active}
                label={label != null ? String(label) : undefined}
                payload={payload as Array<{ payload?: Record<string, string | number | null> }> | undefined}
                rows={chartData}
                visible={visible}
              />
            )}
          />
          {visible.map((s) => {
            const yAxisId =
              useDualAxis
                ? (s.metric === "impressions" ? SPARK_IMPR_AXIS : SPARK_CLICKS_AXIS)
                : undefined;
            return (
              <Line
                key={s.id}
                type="monotone"
                dataKey={useDualAxis ? s.dataKey : `_norm_${s.dataKey}`}
                {...(useDualAxis ? { yAxisId } : {})}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
                strokeDasharray={s.strokeDasharray}
                connectNulls={s.connectNulls}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1.5, stroke: "var(--surface)", fill: s.stroke }}
                strokeOpacity={0.9}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ChartPlot>
  );
}
