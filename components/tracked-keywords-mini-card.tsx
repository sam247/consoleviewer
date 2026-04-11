"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ReportModal } from "@/components/report-modal";
import { exportToCsv } from "@/lib/export-csv";
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
  delta30d?: number;
  status?: "checking" | "ready" | "error";
};

type TrackedKeywordsResponse = {
  configured: boolean;
  keywords: KeywordRow[];
  error?: string;
};

type KeywordSortKey = "keyword" | "position" | "delta7d" | "delta30d";

async function fetchTrackedKeywords(propertyId: string): Promise<TrackedKeywordsResponse> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords`, { cache: "no-store" });
  if (!res.ok) return { configured: false, keywords: [], error: "Failed to load tracked keywords" };
  return res.json() as Promise<TrackedKeywordsResponse>;
}

function regionStorageKey(propertyId: string) {
  return `kw-region-${propertyId}`;
}

const REGIONS = [
  { value: "www.google.co.uk", label: "UK" },
  { value: "www.google.com", label: "US" },
  { value: "www.google.com.au", label: "AU" },
] as const;

function changeLabel(delta: number) {
  if (!delta) return "—";
  const improved = delta < 0;
  const arrow = improved ? "▲" : "▼";
  return `${arrow}${Math.abs(delta).toFixed(1)}`;
}

function changeTone(delta?: number) {
  if (!delta) return "text-muted-foreground";
  return delta < 0 ? "text-positive" : "text-negative";
}

export function TrackedKeywordsMiniCard({
  propertyId,
  maxRows = 10,
  className,
}: {
  propertyId: string;
  maxRows?: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["serprobotKeywords", propertyId] as const;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const { sortKey, sortDir, onSort } = useTableSort<KeywordSortKey>("position", "asc");

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchTrackedKeywords(propertyId),
    placeholderData: (prev) => prev,
  });

  const [phrase, setPhrase] = useState("");
  const [region, setRegion] = useState(() => {
    if (typeof window === "undefined") return REGIONS[0].value;
    return localStorage.getItem(regionStorageKey(propertyId)) ?? REGIONS[0].value;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedAll = useMemo(() => {
    const raw = data?.configured ? (data.keywords ?? []) : [];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...raw]
      .filter((r) => r.keyword)
      .sort((a, b) => {
        if (sortKey === "keyword") return dir * a.keyword.localeCompare(b.keyword);
        if (sortKey === "position") {
          const aV = a.position ?? Infinity;
          const bV = b.position ?? Infinity;
          return dir * (aV - bV);
        }
        if (sortKey === "delta30d") {
          const aV = a.delta30d ?? 0;
          const bV = b.delta30d ?? 0;
          return dir * (aV - bV);
        }
        const aV = a.delta7d ?? 0;
        const bV = b.delta7d ?? 0;
        return dir * (aV - bV);
      });
  }, [data?.configured, data?.keywords, sortDir, sortKey]);

  const rows = useMemo(() => sortedAll.slice(0, maxRows), [maxRows, sortedAll]);

  const filteredAll = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sortedAll;
    return sortedAll.filter((r) => r.keyword.toLowerCase().includes(q));
  }, [filter, sortedAll]);

  const onAdd = async () => {
    const next = phrase.trim();
    if (!next || saving) return;
    setSaving(true);
    setError(null);
    try {
      try { localStorage.setItem(regionStorageKey(propertyId), region); } catch {}
      queryClient.setQueryData(queryKey, (prev: TrackedKeywordsResponse | undefined) => {
        if (!prev?.configured) return prev;
        return {
          ...prev,
          keywords: [
            {
              id: `pending-${Date.now()}`,
              keyword: next,
              position: null,
              delta1d: 0,
              delta7d: 0,
              sparkData: [],
              status: "checking" as const,
            },
            ...(prev.keywords ?? []),
          ],
        };
      });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: next, region }),
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        const message = payload.error ? (payload.hint ? `${payload.error} (${payload.hint})` : payload.error) : "Failed to add keyword";
        throw new Error(message);
      }
      setPhrase("");
      await queryClient.invalidateQueries({ queryKey });
    } catch (e) {
      await queryClient.invalidateQueries({ queryKey });
      setError(e instanceof Error ? e.message : "Failed to add keyword");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">Tracked keywords</span>}
      subtitle="Add fast · Track daily"
      action={
        <div className="flex items-center justify-end gap-2">
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="Add keyword"
            className="h-9 w-[180px] max-w-[36vw] min-w-[140px] rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-9 w-[72px] rounded-md border border-input bg-background px-2 text-sm text-muted-foreground"
            aria-label="Search region"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdd}
            disabled={!phrase.trim() || saving}
            className="h-9 w-[64px] rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            Add
          </button>
        </div>
      }
      className={cn("min-w-0 min-h-[480px]", className)}
    >
      {error && <div className="px-5 pt-3"><p className="text-xs text-negative">{error}</p></div>}
      <div className="max-h-[400px] overflow-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Keyword" column="keyword" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[52%]" />
              <SortableHeader label="Pos" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[16%]" />
              <th className={cn("px-5 font-semibold text-right w-[16%]", TABLE_CELL_Y)}>7d</th>
              <th className={cn("px-5 font-semibold text-right w-[16%]", TABLE_CELL_Y)}>30d</th>
            </tr>
          </thead>
          <tbody>
            {data?.configured && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Track Your First Keyword
                </td>
              </tr>
            ) : (
              [...rows, ...Array.from({ length: Math.max(0, maxRows - rows.length) }).map(() => null)].map((r, idx) => (
                <tr
                  key={(r && (r.id ?? r.keyword)) ?? `placeholder-${idx}`}
                  className={cn(
                    TABLE_ROW_CLASS,
                    idx === 0 && r ? "bg-accent/40 font-medium" : "opacity-95",
                    r ? "" : "text-muted-foreground"
                  )}
                  aria-hidden={!r}
                >
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r ? r.keyword : undefined}>
                    {r ? (
                      r.keyword
                    ) : idx === rows.length ? (
                      <span className="text-muted-foreground">Add keywords to start tracking</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r ? (
                      r.status === "checking" ? (
                      <span className="inline-flex items-center justify-end gap-1.5 text-muted-foreground">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle cx="12" cy="12" r="9" className="stroke-current opacity-25" strokeWidth="3" />
                          <path className="fill-current opacity-90" d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z" />
                        </svg>
                        <span className="text-xs">Checking…</span>
                      </span>
                    ) : r.position != null ? (
                      r.position.toFixed(1)
                    ) : (
                      "—"
                    )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r ? <span className={changeTone(r.delta7d)}>{changeLabel(r.delta7d)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r ? <span className={changeTone(r.delta30d)}>{changeLabel(r.delta30d ?? 0)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-border px-5 py-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => setOpen(true)} className="hover:text-foreground underline">
          View full report
        </button>
      </div>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title="Tracked keywords"
        subtitle="Add fast · Track daily"
        actions={
          <button
            type="button"
            onClick={() => {
              exportToCsv(
                filteredAll.map((r) => ({
                  keyword: r.keyword,
                  position: r.position ?? undefined,
                  delta1d: r.delta1d,
                  delta7d: r.delta7d,
                  status: r.status,
                })),
                "tracked-keywords.csv"
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
            placeholder="Filter keywords"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      >
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader label="Keyword" column="keyword" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="w-[52%]" />
              <SortableHeader label="Pos" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[16%]" />
              <th className={cn("px-4 font-semibold text-right w-[16%]", TABLE_CELL_Y)}>7d</th>
              <th className={cn("px-4 font-semibold text-right w-[16%]", TABLE_CELL_Y)}>30d</th>
            </tr>
          </thead>
          <tbody>
            {filteredAll.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No rows to display.
                </td>
              </tr>
            ) : (
              filteredAll.map((r) => (
                <tr key={r.id ?? r.keyword} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.keyword}>
                    {r.keyword}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.position != null ? r.position.toFixed(1) : "—"}
                  </td>
                  <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                    <span className={changeTone(r.delta7d)}>{changeLabel(r.delta7d)}</span>
                  </td>
                  <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                    <span className={changeTone(r.delta30d)}>{changeLabel(r.delta30d ?? 0)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ReportModal>
    </TableCard>
  );
}
