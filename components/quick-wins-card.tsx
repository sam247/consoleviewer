"use client";

import { useMemo, useState } from "react";
import type { DataTableRow } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import { ReportModal } from "@/components/report-modal";
import { exportToCsv } from "@/lib/export-csv";

type QuickWin = {
  query: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  impressionsChangePercent?: number;
  clicksChangePercent?: number;
  score: number;
  expectedCtr: number;
  ctrGap: number;
  signal: "CTR gap" | "Visibility gap" | "Momentum" | "Near page 1";
  priority: "High" | "Medium" | "Low";
};

function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function formatExpectedCtr(expectedCtr: number): string {
  if (!Number.isFinite(expectedCtr) || expectedCtr <= 0) return "";
  return `(exp ~${expectedCtr.toFixed(1)}%)`;
}

function formatSignedDelta(value?: number): string {
  if (value == null || Number.isNaN(value)) return "";
  const v = Math.round(value);
  if (v === 0) return "";
  return `${v > 0 ? "+" : ""}${v}%`;
}

function priorityFromScore(score: number, p40: number, p75: number): "High" | "Medium" | "Low" {
  if (score >= p75) return "High";
  if (score >= p40) return "Medium";
  return "Low";
}

function labelForSignal(signal: QuickWin["signal"]): string {
  switch (signal) {
    case "CTR gap":
      return "";
    case "Visibility gap":
      return "Under-clicked";
    case "Momentum":
      return "Momentum";
    case "Near page 1":
      return "Near page 1";
  }
}

function positionBand(pos: number): "4-6" | "7-10" | "11-15" | "16-20" {
  if (pos <= 6) return "4-6";
  if (pos <= 10) return "7-10";
  if (pos <= 15) return "11-15";
  return "16-20";
}

function expectedCtrByBand(rows: DataTableRow[]): Record<string, number> {
  const buckets: Record<string, { sum: number; w: number }> = {
    "4-6": { sum: 0, w: 0 },
    "7-10": { sum: 0, w: 0 },
    "11-15": { sum: 0, w: 0 },
    "16-20": { sum: 0, w: 0 },
  };
  for (const r of rows) {
    const pos = r.position;
    const impr = r.impressions ?? 0;
    const clicks = r.clicks ?? 0;
    if (pos == null || !Number.isFinite(pos)) continue;
    if (impr <= 0) continue;
    const band = positionBand(pos);
    const ctr = (clicks / impr) * 100;
    buckets[band].sum += ctr * impr;
    buckets[band].w += impr;
  }
  return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.w > 0 ? v.sum / v.w : 0]));
}

function impressionThreshold(rows: DataTableRow[], min = 1000, topPercent = 0.3): number {
  const values = rows
    .map((r) => r.impressions ?? 0)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);
  if (!values.length) return min;
  const idx = Math.min(values.length - 1, Math.floor(values.length * topPercent));
  return Math.max(min, values[idx] ?? min);
}

function signalFor({
  position,
  ctrGap,
  impressions,
  impressionsP90,
  clicksChangePercent,
  impressionsChangePercent,
}: {
  position: number;
  ctrGap: number;
  impressions: number;
  impressionsP90: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
}): QuickWin["signal"] {
  const momentum = (clicksChangePercent ?? 0) > 0 && (impressionsChangePercent ?? 0) > 0;
  if (ctrGap >= 0.5) return "CTR gap";
  if (position <= 6) return "Near page 1";
  if (momentum) return "Momentum";
  if (impressions >= impressionsP90) return "Visibility gap";
  return "CTR gap";
}

export function QuickWinsCard({
  queries,
  className,
  maxRows = 5,
}: {
  queries: DataTableRow[];
  className?: string;
  maxRows?: number;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<"ctr" | "4-10" | "10-20">("ctr");

  const wins = useMemo(() => {
    const expected = expectedCtrByBand(queries);
    const baseMin = 1000;
    const thr = impressionThreshold(queries, baseMin, 0.3);
    const imprValues = queries
      .map((r) => r.impressions ?? 0)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    const p90 = imprValues.length ? imprValues[Math.floor(imprValues.length * 0.9)] ?? baseMin : baseMin;

    const scored = queries
      .map<QuickWin | null>((q) => {
        const position = Number(q.position ?? NaN);
        const impressions = Number(q.impressions ?? 0);
        const clicks = Number(q.clicks ?? 0);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        if (!Number.isFinite(position)) return null;
        const inBand = position >= 4 && position <= 15;
        if (!inBand) return null;
        if (impressions < thr) return null;

        const band = positionBand(position);
        const expectedCtr = expected[band] ?? 0;
        const ctrGap = Math.max(0, expectedCtr - ctr);
        if (ctrGap < 0.2) return null;

        const score = impressions * ctrGap;
        const signal = signalFor({
          position,
          ctrGap,
          impressions,
          impressionsP90: p90,
          clicksChangePercent: q.changePercent,
          impressionsChangePercent: q.impressionsChangePercent,
        });
        return {
          query: q.key,
          position,
          impressions,
          clicks,
          ctr,
          impressionsChangePercent: q.impressionsChangePercent,
          clicksChangePercent: q.changePercent,
          score,
          expectedCtr,
          ctrGap,
          signal,
          priority: "Low",
        };
      })
      .filter((x): x is QuickWin => x !== null)
      .sort((a, b) => b.score - a.score);

    const scores = scored.map((w) => w.score).sort((a, b) => a - b);
    const p40 = scores.length ? scores[Math.floor(scores.length * 0.4)] ?? 0 : 0;
    const p75 = scores.length ? scores[Math.floor(scores.length * 0.75)] ?? 0 : 0;
    return scored.map((w) => ({ ...w, priority: priorityFromScore(w.score, p40, p75) }));
  }, [queries]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return wins;
    return wins.filter((w) => w.query.toLowerCase().includes(q));
  }, [filter, wins]);

  const modeFiltered = useMemo(() => {
    if (mode === "4-10") return filtered.filter((w) => w.position >= 4 && w.position <= 10);
    if (mode === "10-20") return filtered.filter((w) => w.position >= 10 && w.position <= 20);
    return filtered;
  }, [filtered, mode]);

  const top = modeFiltered.slice(0, maxRows);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Low hanging fruit</span>}
      subtitle="Queries with strong visibility but underperforming clicks"
      className={cn("min-w-0 min-h-[480px]", className)}
    >
      <div className="mt-2 max-h-[400px] overflow-auto">
        <div className="divide-y divide-border">
          {(top.length ? top : Array.from({ length: maxRows }).map(() => null)).map((w, idx) => (
            <button
              key={w?.query ?? `placeholder-${idx}`}
              type="button"
              onClick={() => w && setOpen(true)}
              className={cn(
                "w-full text-left px-5 py-2",
                w ? "hover:bg-accent/40 transition-colors duration-[120ms] cursor-pointer" : "cursor-default",
                idx === 0 && w ? "bg-accent/40" : "",
                w && idx > 0 ? "opacity-95" : ""
              )}
              disabled={!w}
            >
              {w ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={cn("truncate text-sm text-foreground", idx === 0 ? "font-semibold" : "font-medium")}>
                      {w.query}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {w.ctr.toFixed(1)}% CTR ↓ {formatExpectedCtr(w.expectedCtr)} • Pos {w.position.toFixed(1)} • {formatCompact(w.impressions)} impr
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className="flex items-center gap-1.5">
                      {labelForSignal(w.signal) ? (
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                          {labelForSignal(w.signal)}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                        {w.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-border px-5 py-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => setOpen(true)} className="hover:text-foreground underline" disabled={!wins.length}>
          View all opportunities
        </button>
      </div>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title="Low hanging fruit"
        subtitle="Queries with strong visibility but underperforming clicks"
        className="max-w-3xl"
        actions={
          <button
            type="button"
            onClick={() => {
              exportToCsv(
                modeFiltered.map((w) => ({
                  query: w.query,
                  position: w.position,
                  impressions: w.impressions,
                  impressionsChangePercent: w.impressionsChangePercent,
                  clicks: w.clicks,
                  clicksChangePercent: w.clicksChangePercent,
                  ctr: w.ctr,
                  score: w.score,
                  signal: labelForSignal(w.signal) || "Low CTR",
                  priority: w.priority,
                  expectedCtr: w.expectedCtr,
                  ctrGap: w.ctrGap,
                })),
                "low-hanging-fruit.csv"
              );
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Export CSV
          </button>
        }
        search={
          <div className="flex flex-col gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search queries"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5 w-fit">
              <button
                type="button"
                onClick={() => setMode("ctr")}
                className={mode === "ctr" ? "rounded px-2 py-1 text-xs font-medium bg-surface text-foreground border border-border" : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}
              >
                CTR gaps
              </button>
              <button
                type="button"
                onClick={() => setMode("4-10")}
                className={mode === "4-10" ? "rounded px-2 py-1 text-xs font-medium bg-surface text-foreground border border-border" : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}
              >
                Pos 4–10
              </button>
              <button
                type="button"
                onClick={() => setMode("10-20")}
                className={mode === "10-20" ? "rounded px-2 py-1 text-xs font-medium bg-surface text-foreground border border-border" : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}
              >
                Pos 10–20
              </button>
            </div>
          </div>
        }
      >
        <div className="divide-y divide-border">
          {modeFiltered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No opportunities found.</div>
          ) : (
            modeFiltered.map((w, idx) => (
              <div key={w.query} className={cn("px-4 py-2", idx === 0 ? "bg-accent/40" : "")}> 
                <div className={cn("text-sm text-foreground truncate", idx === 0 ? "font-semibold" : "font-medium")}>{w.query}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {w.ctr.toFixed(1)}% CTR ↓ {formatExpectedCtr(w.expectedCtr)} • Gap {w.ctrGap.toFixed(1)}% • Pos {w.position.toFixed(1)} • Impr {formatCompact(w.impressions)}{formatSignedDelta(w.impressionsChangePercent) ? ` (${formatSignedDelta(w.impressionsChangePercent)})` : ""} • Clicks {formatCompact(w.clicks)}{formatSignedDelta(w.clicksChangePercent) ? ` (${formatSignedDelta(w.clicksChangePercent)})` : ""} • Score {Math.round(w.score).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Signal: {labelForSignal(w.signal) || "Low CTR"} • Priority: {w.priority}
                </div>
              </div>
            ))
          )}
        </div>
      </ReportModal>
    </TableCard>
  );
}
