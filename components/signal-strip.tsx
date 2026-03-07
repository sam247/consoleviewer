"use client";

import { useMemo, useState } from "react";
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
  sourceEngine?: "google" | "bing";
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
  sourceEngine = "google",
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

  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      aria-label="Signals"
      className="rounded-lg border border-border bg-surface"
      key={dateKey}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
        aria-expanded={!collapsed}
      >
        <span className="text-xs font-medium text-muted-foreground">Signals</span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              sourceEngine === "google" ? "bg-[#4285f4]/12 text-[#4285f4]" : "bg-[#008373]/12 text-[#008373]"
            )}
          >
            {sourceEngine === "google" ? "Google" : "Bing"}
          </span>
          <svg
            className={cn("size-4 text-muted-foreground transition-transform", collapsed ? "" : "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {!collapsed && (
        <div className="px-5 pb-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
      )}
    </section>
  );
}
