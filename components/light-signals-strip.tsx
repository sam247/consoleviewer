"use client";

import { useMemo } from "react";
import type { DataTableRow } from "@/components/data-table";
import type { Summary } from "@/hooks/use-property-data";
import { cn } from "@/lib/utils";

type SignalItem = {
  key: string;
  icon: string;
  text: string;
  tone?: "positive" | "negative" | "neutral";
};

function formatSignedPercent(value: number): string {
  const v = Math.round(value);
  return `${v >= 0 ? "+" : ""}${v}%`;
}

function topByClicks(rows: DataTableRow[], n = 1): DataTableRow[] {
  return [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, n);
}

function buildContentGroupSummary(pagesRows: DataTableRow[]): Array<{ label: string; avgChangePercent: number }> {
  const groups = new Map<string, { clicks: number; changes: Array<{ w: number; v: number }> }>();
  for (const p of pagesRows) {
    let seg = "(root)";
    try {
      const pathname = p.key.startsWith("http") ? new URL(p.key).pathname : p.key;
      seg = pathname.split("/").filter(Boolean)[0] ?? "(root)";
      if (!seg) seg = "(root)";
    } catch {
      seg = "(other)";
    }
    const cur = groups.get(seg) ?? { clicks: 0, changes: [] as Array<{ w: number; v: number }> };
    cur.clicks += p.clicks;
    if (p.changePercent != null) {
      const w = Math.max(1, p.impressions || p.clicks || 1);
      cur.changes.push({ w, v: p.changePercent });
    }
    groups.set(seg, cur);
  }
  const out: Array<{ label: string; clicks: number; avgChangePercent: number }> = [];
  Array.from(groups.entries()).forEach(([label, agg]) => {
    const totalW = agg.changes.reduce((s, x) => s + x.w, 0);
    if (totalW === 0) return;
    const avg = agg.changes.reduce((s, x) => s + x.w * x.v, 0) / totalW;
    out.push({ label, clicks: agg.clicks, avgChangePercent: avg });
  });
  return out
    .filter((g) => Number.isFinite(g.avgChangePercent))
    .sort((a, b) => Math.abs(b.avgChangePercent) - Math.abs(a.avgChangePercent))
    .slice(0, 3)
    .map((g) => ({ label: g.label, avgChangePercent: g.avgChangePercent }));
}

export function LightSignalsStrip({
  summary,
  newQueries,
  lostQueries,
  pagesRows,
  maxItems = 4,
  className,
}: {
  summary: Summary | null;
  newQueries: DataTableRow[];
  lostQueries: DataTableRow[];
  pagesRows: DataTableRow[];
  maxItems?: number;
  className?: string;
}) {
  const items = useMemo(() => {
    const out: SignalItem[] = [];

    if (summary?.clicksChangePercent != null) {
      out.push({
        key: "clicks",
        icon: summary.clicksChangePercent >= 0 ? "↑" : "↓",
        text: `${formatSignedPercent(summary.clicksChangePercent)} clicks`,
        tone: summary.clicksChangePercent >= 0 ? "positive" : "negative",
      });
    }

    const newQ = topByClicks(newQueries, 1)[0];
    if (newQ) {
      out.push({
        key: `newq:${newQ.key}`,
        icon: "✨",
        text: `New ranking: ${newQ.key}`,
        tone: "positive",
      });
    }

    const lostQ = topByClicks(lostQueries, 1)[0];
    if (lostQ) {
      out.push({
        key: `lostq:${lostQ.key}`,
        icon: "⚠",
        text: `Lost traffic: ${lostQ.key}`,
        tone: "negative",
      });
    }

    const content = buildContentGroupSummary(pagesRows);
    if (content.length > 0) {
      const top = content[0];
      out.push({
        key: `content:${top.label}`,
        icon: "📈",
        text: `Content: ${top.label} ${top.avgChangePercent >= 0 ? "↑" : "↓"} ${formatSignedPercent(top.avgChangePercent)}`,
        tone: top.avgChangePercent >= 0 ? "positive" : "negative",
      });
    }

    return out.slice(0, maxItems);
  }, [lostQueries, maxItems, newQueries, pagesRows, summary?.clicksChangePercent]);

  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Signals">
      {items.map((i) => (
        <div
          key={i.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]"
          title={i.text}
        >
          <span
            aria-hidden
            className={cn(
              "text-[11px]",
              i.tone === "positive" ? "text-positive" : i.tone === "negative" ? "text-negative" : "text-muted-foreground"
            )}
          >
            {i.icon}
          </span>
          <span className="max-w-[420px] truncate text-foreground">
            {i.text}
          </span>
        </div>
      ))}
    </div>
  );
}
