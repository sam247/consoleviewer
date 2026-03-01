"use client";

import { useMemo } from "react";
import { computeMomentumScore, type MomentumInput } from "@/lib/momentum-score";
import { cn } from "@/lib/utils";

interface MomentumScoreCardProps {
  summary: MomentumInput;
  className?: string;
  /** When "strip", renders a compact horizontal row (e.g. above graph) */
  variant?: "card" | "strip";
}

export function MomentumScoreCard({ summary, className, variant = "card" }: MomentumScoreCardProps) {
  const { score, label, subline } = useMemo(() => computeMomentumScore(summary), [summary]);

  const labelStyle =
    label === "Strong"
      ? "text-positive"
      : label === "Moderate"
        ? "text-foreground"
        : label === "Declining"
          ? "text-negative"
          : "text-muted-foreground";

  if (variant === "strip") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2 border-b border-border bg-surface/50 shrink-0",
          className
        )}
      >
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          <span>Momentum</span>
        </div>
        <div className={cn("text-sm font-semibold tabular-nums shrink-0", labelStyle)}>{label}</div>
        <div className="text-xs text-muted-foreground/90 truncate min-w-0" title={subline}>
          {subline}
        </div>
        <div className="text-xs text-muted-foreground/80 tabular-nums shrink-0 ml-auto">
          Score {score > 0 ? "+" : ""}{score}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:border-foreground/20 shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        <span>Momentum</span>
      </div>
      <div className={cn("text-sm font-semibold tabular-nums mt-0.5", labelStyle)}>{label}</div>
      <div className="text-xs text-muted-foreground/90 mt-0.5 max-w-[140px] truncate" title={subline}>
        {subline}
      </div>
      <div className="text-xs text-muted-foreground/80 mt-1 tabular-nums">
        Score {score > 0 ? "+" : ""}{score}
      </div>
    </div>
  );
}
