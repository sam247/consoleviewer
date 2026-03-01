"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
export type BandFilter = { min: number; max: number } | null;

const BANDS = [
  { label: "Top 3", min: 1, max: 3, color: "var(--chart-clicks)" },
  { label: "4–10", min: 4, max: 10, color: "var(--chart-impressions)" },
  { label: "11–20", min: 11, max: 20, color: "var(--chart-ctr)" },
  { label: "21–50", min: 21, max: 50, color: "var(--chart-position)" },
  { label: "50+", min: 51, max: Infinity, color: "var(--muted-foreground)" },
];

type FootprintView = "total" | "bands";

interface QueryFootprintContentProps {
  view: FootprintView;
  setView: (v: FootprintView) => void;
  top10: number;
  top3: number;
  total: number;
  bands: { label: string; min: number; max: number; count: number; color: string }[];
  maxBandCount: number;
  sparkData: { date: string; clicks: number }[];
  pillStats: { label: string; value: number }[];
  rootClassName: string;
  onBandSelect?: (band: BandFilter) => void;
  selectedBand: BandFilter;
}

export function QueryFootprintContent({
  view,
  setView,
  top10,
  top3,
  total,
  bands,
  maxBandCount,
  sparkData,
  pillStats,
  rootClassName,
  onBandSelect,
  selectedBand,
}: QueryFootprintContentProps) {
  return (
    <div className={rootClassName}>
      <div className="border-b border-border px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Query footprint</h3>
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              Top 10: {top10} · Top 3: {top3}
              <span className="ml-1.5 text-muted-foreground/80">· Trend: —</span>
            </p>
          </div>
          <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
            {(["total", "bands"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-150",
                  view === v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {v === "total" ? "Total" : "By ranking band"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5">
        {view === "total" ? (
          <div className="flex flex-col gap-3">
            <div className="flex h-2 w-full rounded-sm overflow-hidden bg-muted/30">
              {bands.map((b) => (
                <div
                  key={b.label}
                  className="h-full transition-colors duration-150 cursor-pointer hover:opacity-90"
                  style={{
                    width: total ? `${(b.count / total) * 100}%` : "0%",
                    minWidth: b.count > 0 ? "4px" : 0,
                    background: b.color,
                    opacity: 0.85,
                  }}
                  title={`${b.label}: ${b.count} queries${total ? ` (${Math.round((b.count / total) * 100)}%)` : ""}`}
                  onClick={() => onBandSelect?.({ min: b.min, max: b.max })}
                  onKeyDown={(e) => e.key === "Enter" && onBandSelect?.({ min: b.min, max: b.max })}
                  role="button"
                  tabIndex={0}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex gap-3 flex-wrap">
                {pillStats.map((stat) => {
                  const isAll = stat.label === "Total";
                  const band: BandFilter = isAll ? null : stat.label === "Top 3" ? { min: 1, max: 3 } : stat.label === "Top 10" ? { min: 1, max: 10 } : stat.label === "Top 20" ? { min: 1, max: 20 } : null;
                  const isSelected = isAll ? selectedBand === null : (selectedBand != null && band != null && selectedBand.min === band.min && selectedBand.max === band.max);
                  const handleClick = () => onBandSelect?.(band ?? null);
                  return (
                    <button
                      key={stat.label}
                      type="button"
                      className={cn(
                        "flex flex-col rounded px-2 py-1 text-left transition-colors duration-150",
                        (onBandSelect != null) && "cursor-pointer hover:bg-accent/50",
                        isSelected && "ring-1 ring-foreground/30 bg-accent/50"
                      )}
                      onClick={onBandSelect ? handleClick : undefined}
                      title={total ? `${stat.label}: ${stat.value} queries (${stat.label !== "Total" ? Math.round((stat.value / total) * 100) + "%" : "total"})` : undefined}
                    >
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <span className="text-xl font-semibold tabular-nums text-foreground leading-tight">
                        {stat.value}
                        {total > 0 && stat.label !== "Total" && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            ({Math.round((stat.value / total) * 100)}%)
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
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
          </div>
        ) : (
          <div className="space-y-2.5">
            {bands.map((b) => {
              const isSelected = selectedBand != null && selectedBand.min === b.min && selectedBand.max === b.max;
              const pct = total ? Math.round((b.count / total) * 100) : 0;
              return (
                <button
                  key={b.label}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 w-full rounded px-1 py-0.5 -mx-1 transition-colors duration-150 text-left",
                    onBandSelect && "cursor-pointer hover:bg-accent/50",
                    isSelected && "ring-1 ring-foreground/30 bg-accent/50"
                  )}
                  onClick={() => onBandSelect?.({ min: b.min, max: b.max })}
                  title={`${b.label}: ${b.count} queries (${pct}%) — click to filter table`}
                >
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
                      {pct}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
