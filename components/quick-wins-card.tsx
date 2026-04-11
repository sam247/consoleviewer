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
  reason: string;
};

function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function scoreQuickWin({
  position,
  impressions,
}: {
  position: number;
  impressions: number;
}) {
  const gap = Math.max(0, position - 3);
  return impressions * gap;
}

function deriveReason({
  position,
  impressions,
  ctr,
  avgCtr,
  clicksChangePercent,
  impressionsChangePercent,
}: {
  position: number;
  impressions: number;
  ctr: number;
  avgCtr: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
}) {
  const lowCtr = Number.isFinite(avgCtr) && avgCtr > 0 ? ctr < avgCtr * 0.85 : ctr < 1;
  const improving = (clicksChangePercent ?? 0) > 0 || (impressionsChangePercent ?? 0) > 0;

  if (lowCtr && impressions >= 1500) return "Improve CTR (title/meta)";
  if (position <= 8 && improving) return "Push into top 3";
  if (position >= 10 && impressions >= 3000) return "Expand content depth";
  return "Internal link boost";
}

export function QuickWinsCard({
  queries,
  avgCtr,
  className,
  maxRows = 5,
}: {
  queries: DataTableRow[];
  avgCtr: number;
  className?: string;
  maxRows?: number;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const wins = useMemo(() => {
    return queries
      .map<QuickWin | null>((q) => {
        const position = Number(q.position ?? NaN);
        const impressions = Number(q.impressions ?? 0);
        const clicks = Number(q.clicks ?? 0);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        if (!Number.isFinite(position)) return null;
        if (position < 4 || position > 15) return null;
        if (impressions < 1000) return null;

        const reason = deriveReason({
          position,
          impressions,
          ctr,
          avgCtr,
          clicksChangePercent: q.changePercent,
          impressionsChangePercent: q.impressionsChangePercent,
        });

        const lowCtr = Number.isFinite(avgCtr) && avgCtr > 0 ? ctr < avgCtr * 0.85 : ctr < 1;
        const improving = (q.changePercent ?? 0) > 0 || (q.impressionsChangePercent ?? 0) > 0;
        if (!lowCtr && !improving) return null;

        const score = scoreQuickWin({ position, impressions });
        return {
          query: q.key,
          position,
          impressions,
          clicks,
          ctr,
          impressionsChangePercent: q.impressionsChangePercent,
          clicksChangePercent: q.changePercent,
          score,
          reason,
        };
      })
      .filter((x): x is QuickWin => x !== null)
      .sort((a, b) => b.score - a.score);
  }, [avgCtr, queries]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return wins;
    return wins.filter((w) => w.query.toLowerCase().includes(q));
  }, [filter, wins]);

  const top = filtered.slice(0, maxRows);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Quick wins</span>}
      subtitle="High-impact opportunities based on position + impressions"
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
                "w-full text-left px-5 py-3",
                w ? "hover:bg-accent/40 transition-colors duration-[120ms] cursor-pointer" : "cursor-default",
                idx === 0 && w ? "bg-accent/40" : "",
                w && idx > 0 ? "opacity-95" : ""
              )}
              disabled={!w}
            >
              {w ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={cn("truncate text-foreground", idx === 0 ? "font-semibold" : "font-medium")}>
                      {w.query}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      Pos {w.position.toFixed(1)} • {formatCompact(w.impressions)} impressions • → {w.reason}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline">
                    View
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
        title="Quick wins"
        subtitle="High-impact opportunities based on position + impressions"
        actions={
          <button
            type="button"
            onClick={() => {
              exportToCsv(
                filtered.map((w) => ({
                  query: w.query,
                  position: w.position,
                  impressions: w.impressions,
                  clicks: w.clicks,
                  ctr: w.ctr,
                  score: w.score,
                  reason: w.reason,
                })),
                "quick-wins.csv"
              );
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Export CSV
          </button>
        }
        search={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search queries"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      >
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No opportunities found.</div>
          ) : (
            filtered.map((w, idx) => (
              <div key={w.query} className={cn("px-4 py-3", idx === 0 ? "bg-accent/40" : "")}> 
                <div className={cn("text-sm text-foreground truncate", idx === 0 ? "font-semibold" : "font-medium")}>{w.query}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Pos {w.position.toFixed(1)} • {formatCompact(w.impressions)} impressions • CTR {w.ctr.toFixed(1)}% • Score {Math.round(w.score).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">→ {w.reason}</div>
              </div>
            ))
          )}
        </div>
      </ReportModal>
    </TableCard>
  );
}
