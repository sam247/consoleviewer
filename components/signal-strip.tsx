"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";
import type { Summary } from "@/hooks/use-property-data";

type SignalTone = "positive" | "warning" | "negative" | "neutral";

export interface SignalItem {
  id: string;
  icon: string;
  text: string;
  tone: SignalTone;
}

export interface SignalStripProps {
  summary: Summary | null;
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  newQueries?: DataTableRow[];
  dateKey: string;
}

function toneClass(tone: SignalTone): string {
  if (tone === "positive") return "text-positive";
  if (tone === "warning") return "text-amber-600 dark:text-amber-400";
  if (tone === "negative") return "text-negative";
  return "text-muted-foreground";
}

function toRelativePath(urlOrPath: string): string {
  try {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      const path = new URL(urlOrPath).pathname;
      return path || "/";
    }
    return urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  } catch {
    return urlOrPath;
  }
}

export function SignalStrip({
  summary,
  queriesRows,
  pagesRows,
  newQueries = [],
  dateKey,
}: SignalStripProps) {
  const signals = useMemo<SignalItem[]>(() => {
    const items: SignalItem[] = [];

    if (summary?.clicksChangePercent != null) {
      items.push({
        id: "click-surge",
        icon: summary.clicksChangePercent >= 0 ? "🔥" : "⚠",
        text: `${summary.clicksChangePercent >= 0 ? "+" : ""}${summary.clicksChangePercent}% clicks`,
        tone: summary.clicksChangePercent >= 0 ? "positive" : "negative",
      });
    }

    const bestOpp = [...queriesRows]
      .filter((r) => r.position != null && r.position >= 4 && r.position <= 15)
      .sort((a, b) => b.impressions - a.impressions)[0];
    if (bestOpp) {
      items.push({
        id: "best-opportunity",
        icon: "🎯",
        text: `Opportunity: ${bestOpp.key} (pos ${bestOpp.position?.toFixed(1)})`,
        tone: "warning",
      });
    }

    const lost = [...queriesRows]
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
    if (lost) {
      items.push({
        id: "lost-traffic",
        icon: "⚠",
        text: `Lost traffic: ${lost.key}`,
        tone: "negative",
      });
    }

    const newRank = [...newQueries]
      .filter((r) => r.position != null)
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0];
    if (newRank) {
      items.push({
        id: "new-ranking",
        icon: "✨",
        text: `New ranking: ${newRank.key}`,
        tone: "positive",
      });
    }

    const contentWin = [...pagesRows]
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => b.impressions - a.impressions)[0];
    if (contentWin) {
      const relativePath = toRelativePath(contentWin.key);
      items.push({
        id: "content-win",
        icon: "✨",
        text: `Content win: ${relativePath} gained ${contentWin.impressions.toLocaleString()} impressions`,
        tone: "neutral",
      });
    }

    if (items.length === 0) {
      return [
        {
          id: "empty",
          icon: "ℹ",
          text: "No ranking signals detected in this range.",
          tone: "neutral",
        },
      ];
    }

    return items.slice(0, 5);
  }, [summary?.clicksChangePercent, queriesRows, pagesRows, newQueries]);

  return (
    <section
      aria-label="Signal strip"
      className="rounded-lg border border-border bg-surface px-5 py-4"
      key={dateKey}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className={cn(
              "flex items-start gap-2 rounded border border-border/60 bg-background/60 px-3 py-2 text-sm animate-signal-enter",
              toneClass(signal.tone)
            )}
          >
            <span className="mt-0.5 shrink-0">{signal.icon}</span>
            <span className="truncate text-foreground">{signal.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
