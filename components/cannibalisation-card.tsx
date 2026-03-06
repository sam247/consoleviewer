"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { RowTableCard } from "@/components/ui/row-table-card";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

const ROWS_INITIAL = 10;

export type CannibalisationConflict = {
  query: string;
  impressions: number;
  clicks: number;
  numUrls: number;
  bestPosition: number;
  score: number;
  urls: { page: string; clicks: number; position: number }[];
  primary_url: string;
};

interface CannibalisationCardProps {
  /** When provided, data is used and no fetch is made (DB-backed flow). */
  conflicts?: CannibalisationConflict[] | null;
  isLoading?: boolean;
  error?: Error | null;
  /** Legacy: when conflicts not provided, fetch by site + date (GSC API). */
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
}

async function fetchCannibalisationLegacy(
  site: string,
  startDate: string,
  endDate: string
): Promise<{ conflicts: CannibalisationConflict[] }> {
  const params = new URLSearchParams({ site, startDate, endDate });
  const res = await fetch(`/api/analytics/cannibalisation?${params}`);
  if (!res.ok) throw new Error("Failed to fetch cannibalisation");
  return res.json();
}

export function CannibalisationCard({
  conflicts: conflictsProp,
  isLoading: isLoadingProp,
  error: errorProp,
  siteUrl,
  startDate,
  endDate,
}: CannibalisationCardProps) {
  const [showAllRows, setShowAllRows] = useState(false);

  const useLegacy =
    conflictsProp === undefined &&
    siteUrl != null &&
    startDate != null &&
    endDate != null;

  const { data: fetched, isLoading: queryLoading, error: queryError } = useQuery({
    queryKey: useLegacy ? ["cannibalisation", siteUrl, startDate, endDate] : ["cannibalisation-noop"],
    queryFn: useLegacy
      ? () => fetchCannibalisationLegacy(siteUrl!, startDate!, endDate!)
      : async () => ({ conflicts: [] as CannibalisationConflict[] }),
    enabled: useLegacy,
  });

  type CannSortKey = "query" | "impressions" | "clicks" | "numUrls" | "bestPosition" | "score";
  const { sortKey, sortDir, onSort } = useTableSort<CannSortKey>("score");

  const isLoading = isLoadingProp ?? (useLegacy ? queryLoading : false);
  const error = errorProp ?? queryError ?? null;

  const conflicts = useMemo(() => {
    const rawConflicts = conflictsProp ?? fetched?.conflicts ?? [];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rawConflicts].sort((a, b) => {
      if (sortKey === "query") return dir * a.query.localeCompare(b.query);
      return dir * (a[sortKey] - b[sortKey]);
    });
  }, [conflictsProp, fetched?.conflicts, sortKey, sortDir]);

  const hasMoreRows = conflicts.length > ROWS_INITIAL;
  const visibleConflicts = showAllRows ? conflicts : conflicts.slice(0, ROWS_INITIAL);
  const moreCount = Math.max(0, conflicts.length - ROWS_INITIAL);

  return (
    <RowTableCard
      title="Cannibalisation"
      subtitle={`Queries ranking with multiple URLs competing for the same position · ${conflicts.length} conflicts`}
      footer={
        hasMoreRows ? (
          <button
            type="button"
            onClick={() => setShowAllRows((s) => !s)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
          >
            {showAllRows ? "View less" : `View ${moreCount} more`}
          </button>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Query" column="query" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="min-w-0 w-[35%]" />
              <SortableHeader label="Impr" column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-20" />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
              <SortableHeader label="#URLs" column="numUrls" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
              <SortableHeader label="Best pos" column="bestPosition" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-24" />
              <SortableHeader label="Score" column="score" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Loading cannibalisation conflicts...
                </td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-negative">
                  Failed to load cannibalisation data.
                </td>
              </tr>
            )}
            {!isLoading && !error && visibleConflicts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No cannibalisation detected for this site.
                </td>
              </tr>
            )}
            {!isLoading && !error &&
              visibleConflicts.map((c) => (
                <tr key={c.query} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-4 text-foreground truncate min-w-0", TABLE_CELL_Y)} title={c.query}>
                    {c.query}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {c.impressions.toLocaleString()}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {c.clicks}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {c.numUrls}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {c.bestPosition.toFixed(1)}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {Math.round(c.score)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </RowTableCard>
  );
}
