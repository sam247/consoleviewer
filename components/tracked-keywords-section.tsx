"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import type { MockTrackedKeyword } from "@/lib/mock-rank";
import { InfoTooltip } from "@/components/info-tooltip";

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
  /** Fallback mock keywords when SerpRobot is not configured or returns empty. */
  keywords: MockTrackedKeyword[];
}

async function fetchSerprobotKeywords(): Promise<{
  configured: boolean;
  keywords: MockTrackedKeyword[];
  message?: string;
}> {
  const res = await fetch("/api/serprobot/keywords");
  if (!res.ok) return { configured: false, keywords: [] };
  return res.json();
}

export function TrackedKeywordsSection({ keywords: mockKeywords }: TrackedKeywordsSectionProps) {
  const { data: serpData } = useQuery({
    queryKey: ["serprobotKeywords"],
    queryFn: fetchSerprobotKeywords,
  });

  const keywords: MockTrackedKeyword[] =
    serpData?.configured && (serpData.keywords?.length ?? 0) > 0
      ? serpData.keywords
      : mockKeywords;
  const showConnectMessage = serpData?.configured === false;

  return (
    <div
      className="rounded-lg border border-border bg-surface flex flex-col min-h-0 transition-colors hover:border-foreground/20 min-w-0"
      aria-label="Keywords tracked"
    >
      <div className="border-b border-border px-4 py-2 shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">Keywords tracked<InfoTooltip title="Rank-tracked keywords (e.g. via SerpRobot) with position and trend" /></h3>
        {showConnectMessage && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect SerpRobot in Settings to track keywords.
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-4 py-2">
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No keywords yet. Connect SerpRobot in Settings to track keywords.
          </p>
        ) : (
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
                    className="border-b border-border/50 last:border-b-0 hover:bg-accent/60 transition-colors duration-100"
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
        )}
      </div>
    </div>
  );
}
