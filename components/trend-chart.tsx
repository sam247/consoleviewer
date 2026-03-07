"use client";

import { useEffect, useMemo } from "react";
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
        row.google_clicks = g.clicks;
        row.google_impressions = g.impressions;
        if (g.ctr != null) row.google_ctr = g.ctr;
        if (g.position != null) row.google_position = g.position;
      }
    }
    if (selectedEngines.includes("bing")) {
      const b = bingByDate.get(date);
      if (b) {
        row.bing_clicks = b.clicks;
        row.bing_impressions = b.impressions;
      }
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
  const { series, overlays } = useSparkSeries();
  const chartMargin = buildChartMargin(height, marginOverride);
  // Use context overlay so Bing shows even when parent passes stale selectedEngines (render timing)
  const effectiveEngines = useMemo((): SearchEngine[] => {
    const hasBingData = dataByEngine?.bing && dataByEngine.bing.length > 0;
    if (overlays.bing && hasBingData) {
      return selectedEngines.includes("bing") ? selectedEngines : ([...selectedEngines, "bing"] as SearchEngine[]);
    }
    return selectedEngines;
  }, [overlays.bing, dataByEngine?.bing, selectedEngines]);
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
    if (!usePerEngine || effectiveEngines.length === 0) return [];
    const pairs: { metric: SparkSeriesKey; engine: SearchEngine; dataKey: string; label: string; stroke: string; strokeDasharray?: string; strokeWidth: number }[] = [];
    for (const s of visibleSeries) {
      for (const engine of effectiveEngines) {
        if (engine === "bing" && (s.key === "ctr" || s.key === "position")) continue;
        const dataKey = `${engine}_${s.dataKey}`;
        const metricStyle = METRIC_STYLE[s.key];
        const isBingOverlay = engine === "bing";
        pairs.push({
          metric: s.key,
          engine,
          dataKey,
          label: `${s.label} (${engine === "google" ? "Google" : "Bing"})`,
          stroke: ENGINE_COLORS[engine],
          strokeWidth: metricStyle.strokeWidth,
          strokeDasharray: isBingOverlay ? "6 4" : metricStyle.strokeDasharray,
        });
      }
    }
    return pairs.slice(0, MAX_PER_ENGINE_LINES);
  }, [usePerEngine, effectiveEngines, visibleSeries]);

  // #region agent log
  useEffect(() => {
    const firstRow = mergedDataByEngine[0] as Record<string, unknown> | undefined;
    fetch("http://127.0.0.1:7537/ingest/59d0df41-0732-4759-8555-7b4a3a9b262e", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "76f5b1" },
      body: JSON.stringify({
        sessionId: "76f5b1",
        location: "trend-chart.tsx:TrendChart",
        message: "Chart engine merge state",
        data: {
          usePerEngine,
          dataByEngineHasBing: !!dataByEngine?.bing,
          dataByEngineBingLen: dataByEngine?.bing?.length ?? 0,
          selectedEngines,
          effectiveEngines,
          mergedDataByEngineLen: mergedDataByEngine.length,
          firstRowKeys: firstRow ? Object.keys(firstRow) : [],
          visibleSeriesLen: visibleSeries.length,
          perEngineSeriesToShowLen: perEngineSeriesToShow.length,
        },
        timestamp: Date.now(),
        hypothesisId: "H2-H5",
      }),
    }).catch(() => {});
  }, [usePerEngine, dataByEngine, selectedEngines, effectiveEngines, mergedDataByEngine, visibleSeries.length, perEngineSeriesToShow.length]);
  // #endregion

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
        const out: Record<string, string | number> = { ...point };
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

  useEffect(() => {
    const first = chartData[0] as Record<string, unknown> | undefined;
    fetch("http://127.0.0.1:7537/ingest/59d0df41-0732-4759-8555-7b4a3a9b262e", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "76f5b1" },
      body: JSON.stringify({
        sessionId: "76f5b1",
        location: "trend-chart.tsx:chartData",
        message: "Final chartData",
        data: {
          chartDataLen: chartData.length,
          usePerEngine,
          firstRowKeys: first ? Object.keys(first) : [],
          hasBingKey: first ? "bing_clicks" in first || "bing_impressions" in first : false,
        },
        timestamp: Date.now(),
        hypothesisId: "H5",
      }),
    }).catch(() => {});
  }, [chartData, usePerEngine]);

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
    visibleSeries.some((s) => s.key === "clicks") &&
    visibleSeries.some((s) => s.key === "impressions") &&
    !visibleSeries.some((s) => s.key === "ctr") &&
    !visibleSeries.some((s) => s.key === "position") &&
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
    if (!chartData.length || (!useDualAxis && !useDualAxisPerEngine)) return undefined;
    let min = Infinity;
    let max = -Infinity;
    if (useDualAxisPerEngine) {
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
  }, [chartData, useDualAxis, useDualAxisPerEngine, perEngineSeriesToShow, useNormalized]);

  const rightDomain = useMemo((): [number, number] | undefined => {
    if (!chartData.length || (!useDualAxis && !useDualAxisPerEngine)) return undefined;
    let min = Infinity;
    let max = -Infinity;
    if (useDualAxisPerEngine) {
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
  }, [chartData, useDualAxis, compareToPrior, useDualAxisPerEngine, perEngineSeriesToShow, useNormalized]);

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

  const marginWithDualAxis = (useDualAxis || useDualAxisPerEngine)
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

          {useDualAxis || useDualAxisPerEngine ? (
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
                  dataKey={useNormalized ? `_norm_${s.dataKey}` : s.dataKey}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  strokeDasharray={s.strokeDasharray}
                  dot={false}
                  name={s.label}
                  {...(useDualAxisPerEngine
                    ? { yAxisId: s.metric === "impressions" ? "right" : "left" }
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

const SPARK_CLICKS_AXIS = "clicks";
const SPARK_IMPR_AXIS = "impressions";

export function Sparkline({ data }: { data: SparklineDataPoint[] }) {
  const { series } = useSparkSeries();
  const visible = useMemo(
    () =>
      data?.length
        ? SERIES_CONFIG.filter((s) => series[s.key] && data.some((d) => d[s.dataKey] != null))
        : [],
    [data, series]
  );
  const hasClicks = visible.some((s) => s.key === "clicks");
  const hasImpressions = visible.some((s) => s.key === "impressions");
  const useDualAxis = hasClicks && hasImpressions;

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    if (useDualAxis) {
      const clicksValues = data.map((d) => (d.clicks as number) ?? 0);
      const impressionsValues = data.map((d) => (d.impressions as number) ?? 0);
      const clicksSmoothed = smoothSeries(clicksValues);
      const impressionsSmoothed = smoothSeries(impressionsValues);
      return data.map((point, i) => ({
        date: point.date,
        clicks: clicksSmoothed[i],
        impressions: impressionsSmoothed[i],
      }));
    }
    const out = data.map((point, i) => {
      const row: Record<string, string | number> = { date: point.date };
      visible.forEach((s) => {
        const values = data.map((d) => (d[s.dataKey] as number) ?? 0);
        const smoothed = smoothSeries(values);
        row[`_norm_${s.key}`] = normalizeSeries(smoothed)[i];
      });
      return row;
    });
    return out;
  }, [data, visible, useDualAxis]);

  if (!data?.length) return null;
  if (!visible.length) return null;

  return (
    <ChartPlot height={CHART_PLOT_H.spark} minHeight={CHART_PLOT_H.spark}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={CHART_MARGIN_SPARK}>
          {useDualAxis ? (
            <>
              <YAxis yAxisId={SPARK_CLICKS_AXIS} orientation="left" hide allowDataOverflow />
              <YAxis yAxisId={SPARK_IMPR_AXIS} orientation="right" hide allowDataOverflow />
            </>
          ) : (
            <YAxis hide domain={[0, 1]} allowDataOverflow />
          )}
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
          {useDualAxis ? (
            <>
              {hasClicks && (
                <Line
                  type="monotone"
                  dataKey="clicks"
                  yAxisId={SPARK_CLICKS_AXIS}
                  stroke={CHART_CLICKS}
                  strokeWidth={1.4}
                  dot={false}
                  strokeOpacity={0.9}
                />
              )}
              {hasImpressions && (
                <Line
                  type="monotone"
                  dataKey="impressions"
                  yAxisId={SPARK_IMPR_AXIS}
                  stroke={CHART_IMPRESSIONS}
                  strokeWidth={1.4}
                  dot={false}
                  strokeOpacity={0.9}
                />
              )}
            </>
          ) : (
            visible.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={`_norm_${s.key}`}
                stroke={s.stroke}
                strokeWidth={1.4}
                dot={false}
                strokeOpacity={0.9}
              />
            ))
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartPlot>
  );
}
