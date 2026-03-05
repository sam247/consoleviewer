"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DataTableRow, TrendFilter } from "@/components/data-table";
import { cn } from "@/lib/utils";

function buildInsightSentence(
  type: "query" | "page",
  direction: "growing" | "decaying",
  row: DataTableRow
): string {
  const label = type === "query" ? `The query '${row.key}'` : `The page '${row.key}'`;
  const pct = Math.abs(row.changePercent ?? 0);
  const posInfo =
    row.position != null
      ? direction === "growing" && row.position <= 10
        ? ` and is in the top 10 (pos ${row.position.toFixed(1)})`
        : ` at position ${row.position.toFixed(1)}`
      : "";
  if (direction === "growing") {
    return `${label} gained +${pct}% clicks${posInfo}.`;
  }
  return `${label} lost ${pct}% clicks${posInfo}.`;
}

async function fetchAiSummary(signals: { direction: string; sentence: string }[], propertyId?: string) {
  const res = await fetch("/api/ai/movement-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signals, propertyId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.summary as string | null;
}

export function MovementIntelligence({
  queriesRows,
  pagesRows,
  trendFilter,
  onTrendFilterChange,
  propertyId,
}: {
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  trendFilter: TrendFilter;
  onTrendFilterChange: (t: TrendFilter) => void;
  propertyId?: string;
}) {
  const topGrowingQuery = useMemo(() => {
    return queriesRows
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  }, [queriesRows]);
  const topDecayingQuery = useMemo(() => {
    return queriesRows
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  }, [queriesRows]);
  const topGrowingPage = useMemo(() => {
    return pagesRows
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  }, [pagesRows]);
  const topDecayingPage = useMemo(() => {
    return pagesRows
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  }, [pagesRows]);

  const signals = [
    topGrowingQuery && { direction: "growing" as const, sentence: buildInsightSentence("query", "growing", topGrowingQuery) },
    topDecayingQuery && { direction: "decaying" as const, sentence: buildInsightSentence("query", "decaying", topDecayingQuery) },
    topGrowingPage && { direction: "growing" as const, sentence: buildInsightSentence("page", "growing", topGrowingPage) },
    topDecayingPage && { direction: "decaying" as const, sentence: buildInsightSentence("page", "decaying", topDecayingPage) },
  ].filter(Boolean) as { direction: "growing" | "decaying"; sentence: string }[];

  const signalsKey = useMemo(() => signals.map((s) => s.sentence).join("|"), [signals]);

  const { data: aiSummary, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-movement-summary", propertyId, signalsKey],
    queryFn: () => fetchAiSummary(signals, propertyId),
    enabled: signals.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const boldMetrics = (sentence: string) => {
    const parts = sentence.split(/([+-]?\d+(?:\.\d+)?%|top \d+|pos \d+(?:\.\d+)?)/gi);
    return parts.map((part, i) =>
      /^([+-]?\d+(?:\.\d+)?%|top \d+|pos \d+(?:\.\d+)?)$/i.test(part) ? (
        <span key={i} className="font-semibold text-foreground">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <section aria-label="Movement intelligence" className="rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-[120ms] hover:border-foreground/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Movement intelligence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Top gaining and losing queries and pages over the selected period</p>
        </div>
        <div className="flex gap-0.5 rounded-md border border-input bg-background p-0.5">
          {(["all", "growing", "decaying", "new", "lost"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTrendFilterChange(t)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium capitalize transition-colors duration-[120ms]",
                trendFilter === t
                  ? "bg-background text-foreground border border-input"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {signals.length > 0 && (
        <div className="px-4 py-2.5 space-y-1 border-b border-border/50">
          {signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className={cn("mt-px shrink-0 text-xs", s.direction === "growing" ? "text-positive" : "text-negative")}>
                {s.direction === "growing" ? "↑" : "↓"}
              </span>
              <span>{boldMetrics(s.sentence)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-border/40">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-medium">AI summary</p>
        {aiLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" className="stroke-current opacity-25" strokeWidth="3" />
              <path className="fill-current opacity-90" d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z" />
            </svg>
            <span className="italic">Generating insight...</span>
          </div>
        ) : aiSummary ? (
          <p className="text-sm text-foreground/80">{aiSummary}</p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            {signals.length === 0 ? "No movement signals to analyse." : "AI summary unavailable."}
          </p>
        )}
      </div>
    </section>
  );
}
