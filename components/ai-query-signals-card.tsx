"use client";

import { useMemo } from "react";
import { classifyQuery } from "@/lib/ai-query-detection";
import type { DataTableRow } from "@/components/data-table";
import { InfoTooltip } from "@/components/info-tooltip";
import { RowTableCard } from "@/components/ui/row-table-card";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
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

type AiSortKey = "key" | "clicks" | "impressions" | "position";

export function AiQuerySignalsCard({ queries }: AiQuerySignalsCardProps) {
  const { sortKey, sortDir, onSort } = useTableSort<AiSortKey>("impressions");

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
    const dir = sortDir === "asc" ? 1 : -1;
    const top5 = [...llmStyle]
      .sort((a, b) => {
        if (sortKey === "key") return dir * a.key.localeCompare(b.key);
        const aVal = a[sortKey] ?? 0;
        const bVal = b[sortKey] ?? 0;
        return dir * (Number(aVal) - Number(bVal));
      })
      .slice(0, 5);

    return {
      pctLongQueries,
      pctLongClicks,
      pctConvQueries,
      top5,
    };
  }, [queries, sortKey, sortDir]);

  return (
    <RowTableCard
      title={
        <span className="font-semibold text-sm text-foreground flex items-center gap-2 flex-wrap">
            AI-style query signals
            <InfoTooltip title="Queries that look like long-form or conversational search (LLM-style)" />
          </span>
      }
      headerRight={
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
            Experimental
          </span>
        </div>
      }
      subtitle={`Long-form: ${stats.pctLongQueries}% queries, ${stats.pctLongClicks}% clicks · Conversational: ${stats.pctConvQueries}% queries`}
      className="flex flex-col"
    >
      <div className="overflow-x-auto min-w-0 flex-1">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Name" column="key" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="min-w-0 w-[35%]" />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[20%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[20%]" />
              <SortableHeader label="Pos" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-14" />
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
                  No ranking signals detected in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </RowTableCard>
  );
}
