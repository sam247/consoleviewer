"use client";

import { useMemo } from "react";
import { classifyQuery } from "@/lib/ai-query-detection";
import type { DataTableRow } from "@/components/data-table";
import { cn } from "@/lib/utils";

interface AiQuerySignalsCardProps {
  queries: DataTableRow[];
  daily?: { date: string; impressions?: number; clicks?: number }[];
}

export function AiQuerySignalsCard({ queries, daily }: AiQuerySignalsCardProps) {
  const stats = useMemo(() => {
    const totalQueries = queries.length;
    const totalClicks = queries.reduce((s, r) => s + r.clicks, 0);
    const longForm = queries.filter(
      (r) => classifyQuery(r.key) === "long" || classifyQuery(r.key) === "both"
    );
    const conversational = queries.filter(
      (r) =>
        classifyQuery(r.key) === "conversational" ||
        classifyQuery(r.key) === "both"
    );
    const longFormClicks = longForm.reduce((s, r) => s + r.clicks, 0);
    const pctLongQueries =
      totalQueries > 0
        ? Math.round((longForm.length / totalQueries) * 100)
        : 0;
    const pctLongClicks =
      totalClicks > 0 ? Math.round((longFormClicks / totalClicks) * 100) : 0;
    const pctConvQueries =
      totalQueries > 0
        ? Math.round((conversational.length / totalQueries) * 100)
        : 0;

    const llmStyle = queries.filter(
      (r) => classifyQuery(r.key) !== "none"
    );
    const top5 = [...llmStyle]
      .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
      .slice(0, 5);

    return {
      pctLongQueries,
      pctLongClicks,
      pctConvQueries,
      top5,
      sparkData: daily?.slice(-14).map((d) => d.impressions ?? d.clicks ?? 0) ?? [],
    };
  }, [queries, daily]);

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-2.5 transition-colors hover:border-foreground/20">
      <div className="border-b border-border pb-2.5 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">
            AI-Style Query Signals
          </h3>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
            Experimental
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          Long-form: {stats.pctLongQueries}% of queries, {stats.pctLongClicks}%
          of clicks · Conversational: {stats.pctConvQueries}% of queries
        </p>
      </div>
      {stats.sparkData.length > 0 && (
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[10px] text-muted-foreground shrink-0">
            Site trend (proxy)
          </span>
          <Sparkline values={stats.sparkData} className="shrink-0" />
        </div>
      )}
      {stats.top5.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Top 5 LLM-style queries</p>
          <ul className="text-xs space-y-0.5">
            {stats.top5.map((r) => (
              <li
                key={r.key}
                className="truncate text-foreground tabular-nums"
                title={r.key}
              >
                <span className="text-muted-foreground mr-1">
                  {r.impressions != null ? r.impressions.toLocaleString() : "—"} impr
                </span>
                {r.key}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map(
    (v, i) =>
      `${(i / (values.length - 1 || 1)) * 80},${24 - ((v - min) / range) * 20}`
  );
  return (
    <svg width={80} height={24} className={cn(className)} aria-hidden>
      <polyline
        fill="none"
        stroke="var(--chart-impressions)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}
