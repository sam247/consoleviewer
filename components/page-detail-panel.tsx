"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatNum } from "@/hooks/use-property-data";
import { TABLE_ROW_CLASS } from "@/components/ui/table-styles";

type QueryRow = { query: string; clicks: number; impressions: number; position: number };

export function PageDetailPanel({
  open,
  onClose,
  pageUrl,
  propertyId,
  startDate,
  endDate,
}: {
  open: boolean;
  onClose: () => void;
  pageUrl: string | null;
  propertyId: string;
  startDate: string;
  endDate: string;
}) {
  const [sortKey, setSortKey] = useState<"query" | "clicks" | "impressions" | "position">("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["page-detail", propertyId, pageUrl, startDate, endDate],
    queryFn: async () => {
      if (!pageUrl) return { queries: [], totalClicks: 0, totalImpressions: 0 };
      const params = new URLSearchParams({ pageUrl, startDate, endDate });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/page-detail?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ queries: QueryRow[]; totalClicks: number; totalImpressions: number }>;
    },
    enabled: open && !!pageUrl,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const queries = data?.queries ?? [];
  const totalClicks = data?.totalClicks ?? 0;
  const totalImpressions = data?.totalImpressions ?? 0;
  const sorted = [...queries].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const cmp = sortKey === "query" ? String(aVal).localeCompare(String(bVal)) : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "query" ? "asc" : "desc");
    }
  };

  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider";
  const td = "px-3 py-2 text-sm border-t border-border";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" aria-hidden onClick={onClose} />
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface border-l border-border shadow-xl flex flex-col",
          "animate-in slide-in-from-right duration-200"
        )}
        role="dialog"
        aria-labelledby="page-detail-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 id="page-detail-title" className="text-sm font-semibold text-foreground truncate pr-2">
            Queries for page
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border overflow-hidden">
          <p className="text-xs text-muted-foreground truncate" title={pageUrl ?? undefined}>
            {pageUrl ?? "—"}
          </p>
          <p className="text-sm font-medium text-foreground mt-1">
            {formatNum(totalClicks)} clicks · {formatNum(totalImpressions)} impressions
          </p>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No query data for this page in the selected range.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-muted/50">
                <tr>
                  <th className={th}>
                    <button type="button" onClick={() => handleSort("query")} className="hover:text-foreground">
                      Query {sortKey === "query" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th className={th}>
                    <button type="button" onClick={() => handleSort("clicks")} className="hover:text-foreground">
                      Clicks {sortKey === "clicks" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th className={th}>
                    <button type="button" onClick={() => handleSort("impressions")} className="hover:text-foreground">
                      Impr. {sortKey === "impressions" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th className={th}>
                    <button type="button" onClick={() => handleSort("position")} className="hover:text-foreground">
                      Pos {sortKey === "position" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.query} className={TABLE_ROW_CLASS}>
                    <td className={cn(td, "max-w-[200px] truncate")} title={row.query}>{row.query}</td>
                    <td className={cn(td, "tabular-nums")}>{formatNum(row.clicks)}</td>
                    <td className={cn(td, "tabular-nums")}>{formatNum(row.impressions)}</td>
                    <td className={cn(td, "tabular-nums text-muted-foreground")}>{row.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
