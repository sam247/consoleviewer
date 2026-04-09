"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

type KeywordRow = {
  id?: string;
  keyword: string;
  position: number | null;
  delta1d: number;
  delta7d: number;
  status?: "checking" | "ready" | "error";
};

type TrackedKeywordsResponse = {
  configured: boolean;
  keywords: KeywordRow[];
};

async function fetchTrackedKeywords(propertyId: string): Promise<TrackedKeywordsResponse> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords`, { cache: "no-store" });
  if (!res.ok) return { configured: false, keywords: [] };
  return res.json() as Promise<TrackedKeywordsResponse>;
}

function changeLabel(delta: number) {
  if (!delta) return "—";
  const improved = delta < 0;
  const arrow = improved ? "▲" : "▼";
  return `${arrow}${Math.abs(delta).toFixed(1)}`;
}

export function TrackedKeywordsMiniCard({
  propertyId,
  viewAllHref,
  maxRows = 8,
  className,
}: {
  propertyId: string;
  viewAllHref: string;
  maxRows?: number;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ["trackedKeywordsMini", propertyId],
    queryFn: () => fetchTrackedKeywords(propertyId),
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => {
    const raw = data?.configured ? (data.keywords ?? []) : [];
    return [...raw]
      .filter((r) => r.keyword)
      .sort((a, b) => Math.abs(b.delta7d ?? 0) - Math.abs(a.delta7d ?? 0))
      .slice(0, maxRows);
  }, [data?.configured, data?.keywords, maxRows]);

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Tracked keywords</span>}
      subtitle="Top movers · 7d"
      action={
        <Link href={viewAllHref} className="text-xs text-muted-foreground hover:text-foreground underline" aria-label="View all tracked keywords">
          View all
        </Link>
      }
      className={cn("min-w-0", className)}
    >
      <div className="overflow-x-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className={cn("px-5 font-semibold text-left w-[60%]", TABLE_CELL_Y)}>Keyword</th>
              <th className={cn("px-5 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Pos</th>
              <th className={cn("px-5 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Chg</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.id ?? r.keyword} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.keyword}>
                    {r.keyword}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.position != null ? r.position.toFixed(1) : "—"}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r.delta7d ? (
                      <span className={r.delta7d < 0 ? "text-positive" : "text-negative"}>{changeLabel(r.delta7d)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No tracked keyword data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}

