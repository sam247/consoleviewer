"use client";

import { useMemo } from "react";
import { computeMomentumScore, type MomentumInput } from "@/lib/momentum-score";
import { cn } from "@/lib/utils";

interface MomentumScoreCardProps {
  summary: MomentumInput;
  className?: string;
}

export function MomentumScoreCard({ summary, className }: MomentumScoreCardProps) {
  const { score, label, subline } = useMemo(() => computeMomentumScore(summary), [summary]);

  const labelStyle =
    label === "Strong"
      ? "text-positive"
      : label === "Moderate"
        ? "text-foreground"
        : label === "Declining"
          ? "text-negative"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-foreground/20 shrink-0",
        className
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Momentum</div>
      <div className={cn("text-sm font-semibold tabular-nums mt-0.5", labelStyle)}>{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5 max-w-[140px] truncate" title={subline}>
        {subline}
      </div>
      <div className="text-xs text-muted-foreground/80 mt-1 tabular-nums">
        Score {score > 0 ? "+" : ""}{score}
      </div>
    </div>
  );
}
