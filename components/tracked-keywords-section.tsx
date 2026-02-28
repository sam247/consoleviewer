"use client";

import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import type { MockTrackedKeyword } from "@/lib/mock-rank";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "consoleview-tracked-keywords-open";

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = useMemo(
    () => data.map((value, i) => ({ i, value })),
    [data]
  );
  if (!data.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="h-6 w-16 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.7}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TrackedKeywordsSectionProps {
  keywords: MockTrackedKeyword[];
}

export function TrackedKeywordsSection({ keywords }: TrackedKeywordsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const stored = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    setExpanded(stored === "true");
  }, [mounted]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  };

  if (!keywords.length) return null;

  return (
    <section aria-label="Tracked keywords" className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-foreground">Tracked keywords</span>
        <svg
          className={cn("size-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-200 ease-out",
          expanded ? "max-h-[500px]" : "max-h-0"
        )}
      >
        <div className="rounded-lg border border-border bg-surface min-w-0 overflow-hidden">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm table-fixed border-collapse">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Keyword</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium w-20">Position</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium w-16">1D Δ</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium w-16">7D Δ</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium w-20">Trend</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((row, idx) => (
                  <tr
                    key={`${row.keyword}-${idx}`}
                    className="border-b border-border/50 last:border-b-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-foreground truncate" title={row.keyword}>
                      {row.keyword}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-foreground">
                      {row.position.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className={row.delta1d < 0 ? "text-positive" : row.delta1d > 0 ? "text-negative" : "text-muted-foreground"}>
                        {row.delta1d > 0 ? "+" : ""}{row.delta1d}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className={row.delta7d < 0 ? "text-positive" : row.delta7d > 0 ? "text-negative" : "text-muted-foreground"}>
                        {row.delta7d > 0 ? "+" : ""}{row.delta7d}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <MiniSparkline data={row.sparkData} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
