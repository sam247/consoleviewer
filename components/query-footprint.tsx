"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";

interface QueryFootprintProps {
  queries: DataTableRow[];
  daily: { date: string; clicks: number }[];
  className?: string;
}

type FootprintView = "total" | "bands";

const BANDS = [
  { label: "Top 3", min: 1, max: 3, color: "var(--chart-clicks)" },
  { label: "4–10", min: 4, max: 10, color: "var(--chart-impressions)" },
  { label: "11–20", min: 11, max: 20, color: "var(--chart-ctr)" },
  { label: "21–50", min: 21, max: 50, color: "var(--chart-position)" },
  { label: "50+", min: 51, max: Infinity, color: "var(--muted-foreground)" },
];

function countInBand(queries: DataTableRow[], min: number, max: number): number {
  return queries.filter((r) => r.position != null && r.position >= min && r.position <= max).length;
}

export function QueryFootprint({ queries, daily, className }: QueryFootprintProps) {
  const [view, setView] = useState<FootprintView>("total");

  const withPosition = useMemo(() => queries.filter((r) => r.position != null), [queries]);
  const total = queries.length;
  const top3 = useMemo(() => countInBand(withPosition, 1, 3), [withPosition]);
  const top10 = useMemo(() => countInBand(withPosition, 1, 10), [withPosition]);
  const top20 = useMemo(() => countInBand(withPosition, 1, 20), [withPosition]);

  const bands = useMemo(
    () => BANDS.map((b) => ({ ...b, count: countInBand(withPosition, b.min, b.max) })),
    [withPosition]
  );

  const maxBandCount = Math.max(...bands.map((b) => b.count), 1);

  const sparkData = useMemo(
    () => daily.slice(-14).map((d) => ({ date: d.date, clicks: d.clicks })),
    [daily]
  );

  return (
    <div className={cn("rounded-lg border border-border bg-surface transition-colors hover:border-foreground/20 overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Query footprint</span>
          <span className="text-xs text-muted-foreground tabular-nums">{total} total queries</span>
        </div>
        <div className="flex gap-1">
          {(["total", "bands"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {v === "total" ? "Total" : "By ranking band"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {view === "total" ? (
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex gap-4 flex-wrap">
              {[
                { label: "Top 3", value: top3 },
                { label: "Top 10", value: top10 },
                { label: "Top 20", value: top20 },
                { label: "Total", value: total },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground leading-tight">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
            {sparkData.length > 0 && (
              <div className="flex-1 min-w-[120px] h-14 self-end">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                      }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), "Clicks"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      stroke="var(--chart-clicks)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {bands.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-12 shrink-0">{b.label}</span>
                <div className="flex-1 h-5 rounded-sm bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-300"
                    style={{
                      width: `${(b.count / maxBandCount) * 100}%`,
                      background: b.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums text-foreground w-8 text-right">{b.count}</span>
                {total > 0 && (
                  <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                    {Math.round((b.count / total) * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
