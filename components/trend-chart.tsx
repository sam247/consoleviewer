"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  position?: number;
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
  /** When true with useSeriesContext, normalize each series to 0-1 so multiple metrics are visible (dashboard sparkline style) */
  normalizeWhenMultiSeries?: boolean;
  className?: string;
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

const CHART_MARGIN = { top: 6, right: 6, left: 36, bottom: 18 };

/** Normalize a series to 0-1 range so multiple metrics are all visible (each uses full vertical scale) */
function normalizeSeriesValues(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

export function TrendChart({
  data,
  priorData,
  height = 80,
  showImpressions = true,
  useSeriesContext = false,
  compareToPrior = false,
  normalizeWhenMultiSeries = false,
  className,
}: TrendChartProps) {
  const { series } = useSparkSeries();

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
    [useSeriesContext, showClicks, showImpr, showCtr, showPosition]
  );

  const useNormalized =
    normalizeWhenMultiSeries &&
    useSeriesContext &&
    visibleSeries.length > 0 &&
    (data?.length ?? 0) > 0 &&
    visibleSeries.some((s) => (data ?? []).some((d) => (d[s.dataKey] as number) != null));

  const chartData = useMemo(() => {
    const safeData = data ?? [];
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
        const raw = point[s.dataKey] as number | undefined;
        if (raw == null) return;
        const values = safeData.map((d) => (d[s.dataKey] as number) ?? 0);
        const norm = normalizeSeriesValues(values);
        out[`_norm_${s.key}`] = norm[i];
      });
      if (compareToPrior && priorData?.length) {
        visibleSeries.forEach((s) => {
          const raw = priorData[i]?.[s.dataKey] as number | undefined;
          if (raw == null) return;
          const values = priorData.map((d) => (d[s.dataKey] as number) ?? 0);
          const norm = normalizeSeriesValues(values);
          out[`_norm_${s.key}Prior`] = norm[i];
        });
      }
      return out;
    });
  }, [data, priorData, useSeriesContext, compareToPrior, useNormalized, visibleSeries]);

  const priorByDate = useMemo(() => {
    const m = new Map<string, DataPoint>();
    (priorData ?? []).forEach((d) => m.set(d.date, d));
    return m;
  }, [priorData]);

  if (!data?.length) return null;

  if (useNormalized) {
    return (
      <div className={cn("w-full", className)} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical horizontal />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              width={36}
              domain={[0, 1]}
              allowDataOverflow
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                padding: "8px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
              labelFormatter={(v) => new Date(v).toLocaleDateString()}
              content={({ active, payload, label }) => {
                if (!active || !label || !payload?.length) return null;
                const raw = data.find((d) => d.date === label);
                if (!raw) return null;
                return (
                  <div
                    className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="font-medium text-foreground mb-1.5">
                      {new Date(label).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div className="flex flex-col gap-0.5 text-muted-foreground">
                      {visibleSeries.map((s) => {
                        const v = raw[s.dataKey];
                        if (v == null) return null;
                        const fmt =
                          s.key === "ctr"
                            ? `${(v as number).toFixed(2)}%`
                            : s.key === "position"
                              ? (v as number).toFixed(1)
                              : (v as number) >= 1e6
                                ? `${((v as number) / 1e6).toFixed(1)}M`
                                : (v as number) >= 1e3
                                  ? `${((v as number) / 1e3).toFixed(1)}k`
                                  : String(v);
                        return (
                          <span key={s.key} className="tabular-nums">
                            {s.key.charAt(0).toUpperCase() + s.key.slice(1)}: {fmt}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            {visibleSeries.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={`_norm_${s.key}`}
                stroke={s.stroke}
                strokeWidth={s.key === "clicks" ? 2.5 : 1.5}
                strokeOpacity={s.key === "impressions" ? 0.85 : 1}
                dot={false}
                name={s.label}
              />
            ))}
            {compareToPrior &&
              priorData?.length &&
              visibleSeries.map((s) => (
                <Line
                  key={`${s.key}-prior`}
                  type="monotone"
                  dataKey={`_norm_${s.key}Prior`}
                  stroke={s.stroke}
                  strokeWidth={1}
                  strokeOpacity={0.45}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Prior"
                />
              ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const yAxisTickFormatter = (value: number) => {
    const v = Number(value);
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
    if (v < 1 && v > 0) return v.toFixed(2);
    return String(Math.round(v));
  };

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="trend-fill-clicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_CLICKS} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART_CLICKS} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical horizontal />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            width={36}
            hide={false}
            domain={["auto", "auto"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickFormatter={yAxisTickFormatter}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !label || !payload?.length) return null;
              const row = chartData.find((d) => d.date === String(label)) as (DataPoint & { clicksPrior?: number; impressionsPrior?: number; ctrPrior?: number; positionPrior?: number }) | undefined;
              const prior = priorByDate.get(String(label));
              const fmt = (v: number, isPct = false) =>
                isPct ? `${v.toFixed(1)}%` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(Math.round(v));
              const pctChange = (curr: number, prev: number) => (prev === 0 ? null : ((curr - prev) / prev) * 100);
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="font-semibold text-foreground mb-1.5">{new Date(label).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div className="flex flex-col gap-0.5 text-muted-foreground">
                    {row?.clicks != null && (
                      <span className="tabular-nums">
                        Clicks {fmt(row.clicks)}
                        {prior?.clicks != null && (() => {
                          const p = pctChange(row.clicks, prior.clicks);
                          return p != null ? ` (${p >= 0 ? "+" : ""}${p.toFixed(0)}% vs prior)` : "";
                        })()}
                      </span>
                    )}
                    {row?.impressions != null && (
                      <span className="tabular-nums">
                        Impressions {fmt(row.impressions)}
                        {prior?.impressions != null && (() => {
                          const p = pctChange(row.impressions, prior.impressions);
                          return p != null ? ` (${p >= 0 ? "+" : ""}${p.toFixed(0)}% vs prior)` : "";
                        })()}
                      </span>
                    )}
                    {row?.position != null && (
                      <span className="tabular-nums">
                        Position {row.position.toFixed(1)}
                        {prior?.position != null && (() => {
                          const p = pctChange(row.position, prior.position);
                          return p != null ? ` (${p >= 0 ? "+" : ""}${p.toFixed(0)}% vs prior)` : "";
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
          />
          {showClicks && (
            <>
              <Area type="monotone" dataKey="clicks" fill="url(#trend-fill-clicks)" stroke="none" />
              <Line type="monotone" dataKey="clicks" stroke={CHART_CLICKS} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name="Clicks" />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="clicksPrior" stroke={CHART_CLICKS} strokeWidth={1} dot={false} activeDot={false} strokeDasharray="4 4" strokeOpacity={0.5} name="Prior" />
              )}
            </>
          )}
          {showImpr && (
            <>
              <Line type="monotone" dataKey="impressions" stroke={CHART_IMPRESSIONS} strokeWidth={1} dot={false} activeDot={{ r: 4 }} strokeDasharray="3 3" strokeOpacity={0.65} name="Impressions" />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="impressionsPrior" stroke={CHART_IMPRESSIONS} strokeWidth={1} dot={false} activeDot={false} strokeDasharray="5 5" strokeOpacity={0.4} name="Prior" />
              )}
            </>
          )}
          {showCtr && (
            <>
              <Line type="monotone" dataKey="ctr" stroke={CHART_CTR} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} name="CTR" />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="ctrPrior" stroke={CHART_CTR} strokeWidth={1} dot={false} activeDot={false} strokeDasharray="4 4" strokeOpacity={0.45} name="Prior" />
              )}
            </>
          )}
          {showPosition && (
            <>
              <Line type="monotone" dataKey="position" stroke={CHART_POSITION} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} name="Avg position" />
              {compareToPrior && priorData?.length && (
                <Line type="monotone" dataKey="positionPrior" stroke={CHART_POSITION} strokeWidth={1} dot={false} activeDot={false} strokeDasharray="4 4" strokeOpacity={0.45} name="Prior" />
              )}
            </>
          )}
          <Legend align="right" verticalAlign="top" wrapperStyle={{ fontSize: 10 }} formatter={(value) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>} />
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
