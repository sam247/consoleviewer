"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";
import { scoreAiLedQuery } from "@/lib/ai-led-queries";
import type { PropertyData } from "@/hooks/use-property-data";

type InsightTone = "positive" | "negative" | "neutral";

type Insight = {
  key: string;
  tone: InsightTone;
  icon: "trend" | "bolt" | "spark";
  text: string;
  targetId?: string;
};

function toneFromPercent(value?: number): InsightTone {
  if (value == null || Number.isNaN(value)) return "neutral";
  if (value > 5) return "positive";
  if (value < -5) return "negative";
  return "neutral";
}

function Icon({ name, tone }: { name: Insight["icon"]; tone: InsightTone }) {
  const stroke = tone === "positive" ? "var(--positive)" : tone === "negative" ? "var(--negative)" : "var(--muted-foreground)";
  if (name === "bolt") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "spark") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <path d="M12 2l1.5 6 6 1.5-6 1.5-1.5 6-1.5-6-6-1.5 6-1.5L12 2z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
      <path d="M6 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  );
}

function formatSigned(value?: number): string {
  if (value == null || Number.isNaN(value)) return "";
  const v = Math.round(value);
  return `${v > 0 ? "+" : ""}${v}%`;
}

function buildTrendInsight(summary?: PropertyData["summary"]): Insight | null {
  if (!summary) return null;
  const clicks = summary.clicksChangePercent;
  const impr = summary.impressionsChangePercent;
  const ctr = summary.ctrChangePercent;

  const clicksTone = toneFromPercent(clicks);
  const imprTone = toneFromPercent(impr);
  const ctrTone = toneFromPercent(ctr);
  const tone: InsightTone = clicksTone === "negative" ? "negative" : imprTone === "positive" ? "positive" : "neutral";

  if (clicksTone === "negative" && imprTone !== "negative") {
    return {
      key: "trend",
      tone,
      icon: "trend",
      text: `Clicks ${formatSigned(clicks)} — demand softening`,
      targetId: "overview-performance",
    };
  }
  if (imprTone === "positive" && ctrTone === "negative") {
    return {
      key: "trend",
      tone: "neutral",
      icon: "trend",
      text: `Impressions ${formatSigned(impr)}, CTR ${formatSigned(ctr)}`,
      targetId: "overview-performance",
    };
  }
  if (clicksTone === "positive") {
    return {
      key: "trend",
      tone: "positive",
      icon: "trend",
      text: `Clicks ${formatSigned(clicks)} — visibility improving`,
      targetId: "overview-performance",
    };
  }
  return {
    key: "trend",
    tone: "neutral",
    icon: "trend",
    text: "No major changes detected — performance stable",
    targetId: "overview-performance",
  };
}

function buildOpportunityInsight(queries: DataTableRow[], avgCtr: number): Insight | null {
  if (!queries.length) return null;
  const closeToTop3 = queries.filter((q) => {
    const pos = q.position ?? undefined;
    return pos != null && pos >= 4 && pos <= 6 && (q.impressions ?? 0) >= 1000;
  }).length;

  const lowCtrHighVol = queries.filter((q) => {
    const impr = q.impressions ?? 0;
    const clicks = q.clicks ?? 0;
    if (impr < 2000) return false;
    const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
    return avgCtr > 0 ? ctr < avgCtr * 0.85 : ctr < 1;
  }).length;

  if (closeToTop3 >= 3) {
    return {
      key: "opp",
      tone: "positive",
      icon: "bolt",
      text: `${closeToTop3} queries just outside top 3`,
      targetId: "overview-quick-wins",
    };
  }
  if (lowCtrHighVol >= 3) {
    return {
      key: "opp",
      tone: "neutral",
      icon: "bolt",
      text: "CTR below avg on high-volume terms",
      targetId: "overview-quick-wins",
    };
  }
  return null;
}

function buildIntentInsight(queries: DataTableRow[], siteUrl?: string): Insight | null {
  if (!queries.length) return null;
  const aiLed = queries
    .map((q) => {
      const scored = scoreAiLedQuery({ query: q.key, siteUrl });
      return { row: q, scored };
    })
    .filter((x) => !x.scored.excluded);
  if (aiLed.length < 5) return null;

  const totalImpr = aiLed.reduce((s, x) => s + (x.row.impressions ?? 0), 0) || 1;
  const weightedChange =
    aiLed.reduce((s, x) => s + (x.row.impressions ?? 0) * (x.row.impressionsChangePercent ?? 0), 0) / totalImpr;

  const questionsCount = aiLed.filter((x) => x.scored.segments.includes("questions")).length;
  const tone = toneFromPercent(weightedChange);

  if (Math.abs(weightedChange) >= 10) {
    return {
      key: "intent",
      tone,
      icon: "spark",
      text: `Conversational queries ${formatSigned(weightedChange)}`,
      targetId: "overview-ai-led",
    };
  }
  if (questionsCount >= Math.max(6, Math.floor(aiLed.length * 0.35))) {
    return {
      key: "intent",
      tone: "neutral",
      icon: "spark",
      text: "More ‘why’ and ‘what’ searches appearing",
      targetId: "overview-ai-led",
    };
  }
  return {
    key: "intent",
    tone: "neutral",
    icon: "spark",
    text: "Discovery-style searches increasing",
    targetId: "overview-ai-led",
  };
}

export function InsightStrip({
  summary,
  queriesRows,
  siteUrl,
  className,
}: {
  summary?: PropertyData["summary"];
  queriesRows: DataTableRow[];
  siteUrl?: string;
  className?: string;
}) {
  const avgCtr = summary?.ctr ?? 0;
  const insights = useMemo(() => {
    const out: Insight[] = [];
    const t = buildTrendInsight(summary);
    if (t) out.push(t);
    const o = buildOpportunityInsight(queriesRows, avgCtr);
    if (o) out.push(o);
    const i = buildIntentInsight(queriesRows, siteUrl);
    if (i) out.push(i);
    if (out.length === 0) {
      out.push({
        key: "stable",
        tone: "neutral",
        icon: "trend",
        text: "No major changes detected — performance stable",
        targetId: "overview-performance",
      });
    }
    return out.slice(0, 3);
  }, [avgCtr, queriesRows, siteUrl, summary]);

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      {insights.map((ins) => {
        const toneClass =
          ins.tone === "positive"
            ? "border-positive/30 bg-positive/10 text-foreground"
            : ins.tone === "negative"
              ? "border-negative/30 bg-negative/10 text-foreground"
              : "border-border bg-surface text-foreground";
        return (
          <button
            key={ins.key}
            type="button"
            onClick={() => {
              if (!ins.targetId) return;
              const el = document.getElementById(ins.targetId);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm",
              "hover:bg-accent/60 transition-colors duration-[120ms]",
              toneClass
            )}
            aria-label={ins.text}
          >
            <Icon name={ins.icon} tone={ins.tone} />
            <span className="max-w-[280px] truncate">{ins.text}</span>
          </button>
        );
      })}
    </div>
  );
}

