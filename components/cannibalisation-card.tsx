"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { RowTableCard } from "@/components/ui/row-table-card";
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

  const conflicts = conflictsProp ?? fetched?.conflicts ?? [];
  const isLoading = isLoadingProp ?? (useLegacy ? queryLoading : false);
  const error = errorProp ?? queryError ?? null;
  const hasMoreRows = conflicts.length > ROWS_INITIAL;
  const visibleConflicts = showAllRows ? conflicts : conflicts.slice(0, ROWS_INITIAL);
  const moreCount = Math.max(0, conflicts.length - ROWS_INITIAL);

  return (
    <RowTableCard
      title="Cannibalisation"
      subtitle={`${conflicts.length} conflicts`}
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
              <th className={cn("text-left px-4 font-semibold min-w-0 w-[35%]", TABLE_CELL_Y)}>Query</th>
              <th className={cn("text-right px-4 font-semibold w-20", TABLE_CELL_Y)}>Impr</th>
              <th className={cn("text-right px-4 font-semibold w-16", TABLE_CELL_Y)}>Clicks</th>
              <th className={cn("text-right px-4 font-semibold w-16", TABLE_CELL_Y)}>#URLs</th>
              <th className={cn("text-right px-4 font-semibold w-24", TABLE_CELL_Y)}>Best pos</th>
              <th className={cn("text-right px-4 font-semibold w-20", TABLE_CELL_Y)}>Score</th>
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
                  No cannibalisation conflicts detected in this range.
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
