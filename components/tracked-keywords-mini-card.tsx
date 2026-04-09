"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  error?: string;
};

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
  const queryClient = useQueryClient();
  const queryKey = ["serprobotKeywords", propertyId] as const;

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

  const rows = useMemo(() => {
    const raw = data?.configured ? (data.keywords ?? []) : [];
    return [...raw]
      .filter((r) => r.keyword)
      .sort((a, b) => Math.abs(b.delta7d ?? 0) - Math.abs(a.delta7d ?? 0))
      .slice(0, maxRows);
  }, [data?.configured, data?.keywords, maxRows]);

  const paddedRows = useMemo(() => {
    const out = [...rows];
    while (out.length < maxRows) {
      out.push({ keyword: "", position: null, delta1d: 0, delta7d: 0 } as KeywordRow);
    }
    return out;
  }, [rows, maxRows]);

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
        <Link href={viewAllHref} className="text-xs text-muted-foreground hover:text-foreground underline" aria-label="View all tracked keywords">
          View all
        </Link>
      }
      className={cn("min-w-0", className)}
    >
      <div className="px-5 pt-3">
        <div className="flex flex-wrap items-center gap-2">
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
            className="min-h-[40px] flex-1 min-w-[160px] rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="min-h-[40px] rounded-md border border-input bg-background px-2 text-sm text-muted-foreground"
            aria-label="Search region"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdd}
            disabled={!phrase.trim() || saving}
            className="min-h-[40px] rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      </div>
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
            {data?.configured && rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Track Your First Keyword
                </td>
              </tr>
            ) : (
              paddedRows.map((r, idx) => {
                const isPlaceholder = !r.keyword;
                return (
                  <tr key={r.id ?? r.keyword ?? `placeholder-${idx}`} className={TABLE_ROW_CLASS}>
                    <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.keyword || undefined}>
                      {isPlaceholder ? <span className="invisible">—</span> : r.keyword}
                    </td>
                    <td className={cn("px-5 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                      {isPlaceholder ? (
                        <span className="invisible">—</span>
                      ) : r.status === "checking" ? (
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
                      )}
                    </td>
                    <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                      {isPlaceholder ? (
                        <span className="invisible">—</span>
                      ) : r.delta7d ? (
                        <span className={r.delta7d < 0 ? "text-positive" : "text-negative"}>{changeLabel(r.delta7d)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}
