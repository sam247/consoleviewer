"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSparkSeries } from "@/contexts/spark-series-context";
import type { PropertyData } from "@/hooks/use-property-data";

type MetricKey = "clicks" | "impressions" | "ctr" | "position";

function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

function formatSignedPercent(value?: number): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (value == null || Number.isNaN(value)) return { text: "", tone: "neutral" };
  const v = Math.round(value);
  if (v === 0) return { text: "0%", tone: "neutral" };
  return { text: `${v > 0 ? "+" : ""}${v}%`, tone: v > 0 ? "positive" : "negative" };
}

function arrow(value?: number): string {
  if (value == null || Number.isNaN(value)) return "";
  if (value > 0) return "↑";
  if (value < 0) return "↓";
  return "→";
}

function classify(value?: number): "up" | "down" | "flat" {
  if (value == null || Number.isNaN(value)) return "flat";
  if (value > 2) return "up";
  if (value < -2) return "down";
  return "flat";
}

function buildContextLine(summary: NonNullable<PropertyData["summary"]>, visible: MetricKey[]): string {
  const clicks = classify(summary.clicksChangePercent);
  const impr = classify(summary.impressionsChangePercent);
  const ctr = visible.includes("ctr") ? classify(summary.ctrChangePercent) : "flat";
  const pos = visible.includes("position") ? classify(summary.positionChangePercent) : "flat";

  const showCtr = visible.includes("ctr") && summary.ctrChangePercent != null;
  const showPos = visible.includes("position") && summary.positionChangePercent != null;

  if (clicks === "down" && impr === "down" && showCtr && ctr === "down") return "Clicks & impressions down — CTR softening";
  if (clicks === "down" && impr !== "down" && showCtr && ctr === "down") return "Clicks down, CTR down — visibility steady";
  if (impr === "up" && showCtr && ctr === "down") return "Visibility up — CTR slipping";
  if (clicks === "down" && showPos && pos === "flat") return "Demand falling faster than rankings";
  if (clicks === "up" && impr === "up") return "Demand and visibility improving";
  if (clicks === "flat" && impr === "flat") return "Performance stable in this period";
  return "Mixed movement across core metrics";
}

export function PerformanceSnapshotSummary({
  summary,
  className,
}: {
  summary: PropertyData["summary"] | null | undefined;
  className?: string;
}) {
  const { series } = useSparkSeries();
  const visible = useMemo(() => {
    const out: MetricKey[] = [];
    if (series.clicks) out.push("clicks");
    if (series.impressions) out.push("impressions");
    if (series.ctr) out.push("ctr");
    if (series.position) out.push("position");
    return out;
  }, [series.clicks, series.ctr, series.impressions, series.position]);

  const context = useMemo(() => (summary ? buildContextLine(summary, visible) : ""), [summary, visible]);
  if (!summary) return null;
  return <div className={cn("text-xs text-muted-foreground", className)}>{context}</div>;
}

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: { text: string; tone: "positive" | "negative" | "neutral"; arrow: string };
}) {
  const toneClass =
    delta.tone === "positive" ? "text-positive" : delta.tone === "negative" ? "text-negative" : "text-muted-foreground";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
      {delta.text ? (
        <span className={cn("text-[11px] tabular-nums", toneClass)}>
          {delta.arrow} {delta.text}
        </span>
      ) : null}
    </div>
  );
}

export function PerformanceSnapshotStrip({
  summary,
  className,
}: {
  summary: PropertyData["summary"] | null | undefined;
  className?: string;
}) {
  const { series } = useSparkSeries();

  const visible = useMemo(() => {
    const out: MetricKey[] = [];
    if (series.clicks) out.push("clicks");
    if (series.impressions) out.push("impressions");
    if (series.ctr) out.push("ctr");
    if (series.position) out.push("position");
    return out;
  }, [series.clicks, series.ctr, series.impressions, series.position]);


  const clicksDelta = formatSignedPercent(summary?.clicksChangePercent);
  const imprDelta = formatSignedPercent(summary?.impressionsChangePercent);
  const ctrDelta = formatSignedPercent(summary?.ctrChangePercent);
  const posDelta = formatSignedPercent(summary?.positionChangePercent);

  if (!summary) return null;

  return (
    <div className={cn("max-w-[560px]", className)}>
      <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1 leading-none">
        {visible.includes("clicks") && (
          <Metric
            label="Clicks"
            value={formatCompact(summary.clicks)}
            delta={{ text: clicksDelta.text, tone: clicksDelta.tone, arrow: arrow(summary.clicksChangePercent) }}
          />
        )}
        {visible.includes("impressions") && (
          <Metric
            label="Impr."
            value={formatCompact(summary.impressions)}
            delta={{ text: imprDelta.text, tone: imprDelta.tone, arrow: arrow(summary.impressionsChangePercent) }}
          />
        )}
        {visible.includes("ctr") && summary.ctr != null && (
          <Metric
            label="CTR"
            value={`${summary.ctr.toFixed(2)}%`}
            delta={{ text: ctrDelta.text, tone: ctrDelta.tone, arrow: arrow(summary.ctrChangePercent) }}
          />
        )}
        {visible.includes("position") && summary.position != null && (
          <Metric
            label="Pos"
            value={summary.position.toFixed(1)}
            delta={{ text: posDelta.text, tone: posDelta.tone, arrow: arrow(summary.positionChangePercent) }}
          />
        )}
      </div>
    </div>
  );
}
