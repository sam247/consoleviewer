"use client";

import { useMemo } from "react";
import { classifyQuery } from "@/lib/ai-query-detection";
import type { DataTableRow } from "@/components/data-table";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";
import { cn } from "@/lib/utils";

interface AiQuerySignalsCardProps {
  queries: DataTableRow[];
  daily?: { date: string; impressions?: number; clicks?: number }[];
}

export function AiQuerySignalsCard({ queries }: AiQuerySignalsCardProps) {
  const stats = useMemo(() => {
    const totalQueries = queries.length;
    const totalClicks = queries.reduce((s, r) => s + r.clicks, 0);
    const longForm = queries.filter(
      (r) => classifyQuery(r.key) === "long" || classifyQuery(r.key) === "both"
    );
    const conversational = queries.filter(
      (r) =>
        classifyQuery(r.key) === "conversational" ||
        classifyQuery(r.key) === "both"
    );
    const longFormClicks = longForm.reduce((s, r) => s + r.clicks, 0);
    const pctLongQueries =
      totalQueries > 0
        ? Math.round((longForm.length / totalQueries) * 100)
        : 0;
    const pctLongClicks =
      totalClicks > 0 ? Math.round((longFormClicks / totalClicks) * 100) : 0;
    const pctConvQueries =
      totalQueries > 0
        ? Math.round((conversational.length / totalQueries) * 100)
        : 0;

    const llmStyle = queries.filter(
      (r) => classifyQuery(r.key) !== "none"
    );
    const top5 = [...llmStyle]
      .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
      .slice(0, 5);

    return {
      pctLongQueries,
      pctLongClicks,
      pctConvQueries,
      top5,
    };
  }, [queries]);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-[120ms] hover:border-foreground/20 flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-foreground flex items-center gap-1">
            AI-style query signals
            <InfoTooltip title="Queries that look like long-form or conversational search (LLM-style)" />
          </span>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
            Experimental
          </span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums w-full sm:w-auto">
          Long-form: {stats.pctLongQueries}% queries, {stats.pctLongClicks}% clicks · Conversational: {stats.pctConvQueries}% queries
        </p>
      </div>
      <div className="overflow-x-auto min-w-0 flex-1">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className={cn("text-left px-4 font-semibold min-w-0 w-[35%]", TABLE_CELL_Y)}>Name</th>
              <th className={cn("text-right px-4 font-semibold w-[20%]", TABLE_CELL_Y)}>Clicks</th>
              <th className={cn("text-right px-4 font-semibold w-[20%]", TABLE_CELL_Y)}>Impr.</th>
              <th className={cn("text-right px-4 font-semibold w-14", TABLE_CELL_Y)}>Pos</th>
            </tr>
          </thead>
          <tbody>
            {stats.top5.length > 0 ? (
              stats.top5.map((r) => (
                <tr
                  key={r.key}
                  className={TABLE_ROW_CLASS}
                >
                  <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.key}>
                    {r.key}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.clicks.toLocaleString()}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.impressions != null ? r.impressions.toLocaleString() : "—"}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.position != null ? r.position.toFixed(1) : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm text-muted-foreground">
                  No LLM-style queries in top set
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
