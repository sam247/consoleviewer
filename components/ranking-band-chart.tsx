"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";

const BANDS = [
  { label: "Top 3", key: "top3", min: 1, max: 3, color: "var(--chart-clicks)" },
  { label: "4–10", key: "band_4_10", min: 4, max: 10, color: "var(--chart-impressions)" },
  { label: "11–20", key: "band_11_20", min: 11, max: 20, color: "var(--chart-ctr)" },
  { label: "21–50", key: "band_21_50", min: 21, max: 50, color: "var(--chart-position)" },
  { label: "50+", key: "band_50_plus", min: 51, max: Infinity, color: "var(--muted-foreground)" },
];

function countInBand(queries: DataTableRow[], min: number, max: number): number {
  return queries.filter((r) => r.position != null && r.position >= min && r.position <= max).length;
}

interface RankingBandChartProps {
  queries: DataTableRow[];
  className?: string;
}

type ViewMode = "absolute" | "percent";

export function RankingBandChart({ queries, className }: RankingBandChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("absolute");

  const withPosition = useMemo(() => queries.filter((r) => r.position != null), [queries]);
  const bandCounts = useMemo(
    () => BANDS.map((b) => ({ ...b, count: countInBand(withPosition, b.min, b.max) })),
    [withPosition]
  );
  const total = bandCounts.reduce((s, b) => s + b.count, 0);
  const top10Pct = total > 0 ? Math.round(((bandCounts[0]?.count ?? 0) + (bandCounts[1]?.count ?? 0)) / total * 100) : 0;

  const chartData = useMemo(() => {
    if (total === 0) return [{ name: "Current", ...Object.fromEntries(BANDS.map((b) => [b.key, 0])) }];
    if (viewMode === "percent") {
      return [
        {
          name: "Current",
          ...Object.fromEntries(
            bandCounts.map((b) => [b.key, total > 0 ? Math.round((b.count / total) * 100) : 0])
          ),
        },
      ];
    }
    return [
      {
        name: "Current",
        ...Object.fromEntries(bandCounts.map((b) => [b.key, b.count])),
      },
    ];
  }, [bandCounts, total, viewMode]);

  if (withPosition.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20", className)}>
      <div className="border-b border-border px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ranking band distribution</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} queries with position · {top10Pct}% of queries in Top 10
          </p>
        </div>
        <div className="flex gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          {(["absolute", "percent"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-[120ms]",
                viewMode === mode ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {mode === "percent" ? "%" : "Absolute"}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-3" style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (viewMode === "percent" ? `${v}%` : String(v))} domain={viewMode === "percent" ? [0, 100] : undefined} />
            <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                padding: "6px 8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
              formatter={(value: number | undefined, name: string | undefined) => [viewMode === "percent" ? `${value ?? 0}%` : (value ?? 0).toLocaleString(), name ?? ""]}
              labelFormatter={() => "Current period"}
            />
            {BANDS.map((b) => (
              <Bar key={b.key} dataKey={b.key} stackId="stack" name={b.label} radius={0} fill={b.color} />
            ))}
            <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
