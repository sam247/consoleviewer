"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import type { MockTrackedKeyword } from "@/lib/mock-rank";
import { InfoTooltip } from "@/components/info-tooltip";
import { exportToCsv } from "@/lib/export-csv";
import { cn } from "@/lib/utils";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

type KeywordStatus = "checking" | "ready" | "error";

type KeywordRow = {
  id?: string;
  keyword: string;
  position: number | null;
  delta1d: number;
  delta7d: number;
  sparkData: number[];
  status?: KeywordStatus;
  lastCheckedAt?: string | null;
  warning?: string;
};

type TrackedKeywordsResponse = {
  configured: boolean;
  canManageKeywords?: boolean;
  keywords: KeywordRow[];
  message?: string;
  error?: string;
  correlationId?: string;
};

const GOOGLE_REGIONS = [
  { value: "www.google.co.uk", label: "UK" },
  { value: "www.google.com", label: "US" },
  { value: "www.google.com.au", label: "AU" },
  { value: "www.google.ca", label: "CA" },
  { value: "www.google.ie", label: "IE" },
  { value: "www.google.co.nz", label: "NZ" },
  { value: "www.google.co.za", label: "ZA" },
  { value: "www.google.de", label: "DE" },
  { value: "www.google.fr", label: "FR" },
  { value: "www.google.es", label: "ES" },
  { value: "www.google.it", label: "IT" },
  { value: "www.google.nl", label: "NL" },
  { value: "www.google.co.in", label: "IN" },
  { value: "www.google.com.br", label: "BR" },
  { value: "www.google.co.jp", label: "JP" },
] as const;

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = useMemo(
    () => data.map((value, i) => ({ i, value })),
    [data]
  );
  if (!data.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="h-6 w-16 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.7}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TrackedKeywordsSectionProps {
  keywords?: MockTrackedKeyword[];
  propertyId?: string;
  exportFilename?: string;
}

function parseKeywordError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const msg =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : null;
    const correlation =
      typeof data.correlationId === "string" ? ` [ref ${data.correlationId}]` : "";
    if (msg) return `${msg}${correlation}`;
  }
  return fallback;
}

function isTransientNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

async function fetchTrackedKeywords(propertyId?: string): Promise<TrackedKeywordsResponse> {
  const endpoint = propertyId
    ? `/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords`
    : "/api/serprobot/keywords";
  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        const message = parseKeywordError(payload, "Failed to load tracked keywords");
        return { configured: false, keywords: [], error: message };
      }
      return payload as TrackedKeywordsResponse;
    } catch (error) {
      if (attempts < 2 && isTransientNetworkError(error)) continue;
      const message = error instanceof Error ? error.message : "Failed to load tracked keywords";
      return { configured: false, keywords: [], error: message };
    }
  }
  return { configured: false, keywords: [], error: "Failed to load tracked keywords" };
}

function regionStorageKey(propertyId: string) {
  return `kw-region-${propertyId}`;
}

export function TrackedKeywordsSection({ keywords: fallbackKeywords = [], propertyId, exportFilename }: TrackedKeywordsSectionProps) {
  const queryClient = useQueryClient();
  const [addInput, setAddInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [region, setRegionState] = useState("www.google.co.uk");

  const queryKey = ["serprobotKeywords", propertyId ?? "global"] as const;
  const isPropertyScoped = Boolean(propertyId);

  useEffect(() => {
    if (!propertyId) return;
    const saved = localStorage.getItem(regionStorageKey(propertyId));
    if (saved) setRegionState(saved);
  }, [propertyId]);

  const setRegion = (value: string) => {
    setRegionState(value);
    if (propertyId) localStorage.setItem(regionStorageKey(propertyId), value);
  };

  const { data: serpData } = useQuery({
    queryKey,
    queryFn: () => fetchTrackedKeywords(propertyId),
    placeholderData: (previousData) => previousData,
    refetchInterval: (query) => {
      const data = query.state.data as TrackedKeywordsResponse | undefined;
      if (!data?.configured) return false;
      return data.keywords?.some((row) => row.status === "checking") ? 4000 : false;
    },
    refetchIntervalInBackground: true,
  });

  type KwSortKey = "keyword" | "position" | "delta1d" | "delta7d";
  const { sortKey, sortDir, onSort } = useTableSort<KwSortKey>("keyword", "asc");

  const keywords = useMemo(() => {
    const rawKeywords: KeywordRow[] = serpData?.configured
      ? (serpData.keywords ?? [])
      : fallbackKeywords.map((k) => ({ ...k, position: k.position, status: "ready" as const }));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rawKeywords].sort((a, b) => {
      if (sortKey === "keyword") return dir * a.keyword.localeCompare(b.keyword);
      const aVal = a[sortKey] ?? 9999;
      const bVal = b[sortKey] ?? 9999;
      return dir * (Number(aVal) - Number(bVal));
    });
  }, [serpData?.configured, serpData?.keywords, fallbackKeywords, sortKey, sortDir]);
  const showConnectMessage = serpData?.configured === false;
  const canAddDelete = isPropertyScoped
    ? true
    : serpData?.configured === true && serpData?.canManageKeywords === true;

  const handleAdd = async () => {
    const phrase = addInput.trim();
    if (!phrase || addLoading) return;
    setAddLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const endpoint = propertyId
        ? `/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords`
        : "/api/serprobot/keywords";
      queryClient.setQueryData(queryKey, (prev: TrackedKeywordsResponse | undefined) => {
        if (!prev?.configured) return prev;
        return {
          ...prev,
          keywords: [
            {
              id: `pending-${Date.now()}`,
              keyword: phrase,
              position: null,
              delta1d: 0,
              delta7d: 0,
              sparkData: [],
              status: "checking" as const,
              lastCheckedAt: null,
            },
            ...(prev.keywords ?? []),
          ],
        };
      });
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, region }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string; warning?: string };
      if (!res.ok) {
        const message = data.error ? (data.hint ? `${data.error} (${data.hint})` : data.error) : "Failed to add keyword";
        throw new Error(message);
      }
      setAddInput("");
      await queryClient.invalidateQueries({ queryKey });
      if (data.warning) {
        setActionSuccess(`Added "${phrase}" (rank check pending: ${data.warning})`);
      } else {
        setActionSuccess(`Added "${phrase}"`);
      }
    } catch (e) {
      await queryClient.invalidateQueries({ queryKey });
      const message = e instanceof Error ? e.message : "Failed to add keyword";
      setActionError(message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (row: KeywordRow) => {
    if (deleteLoading) return;
    setDeleteLoading(row.keyword);
    setActionError(null);
    setActionSuccess(null);
    try {
      const url = row.id
        ? (propertyId
          ? `/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords?keywordId=${encodeURIComponent(row.id)}`
          : `/api/serprobot/keywords?keywordId=${encodeURIComponent(row.id)}`)
        : (propertyId
          ? `/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords?phrase=${encodeURIComponent(row.keyword)}`
          : `/api/serprobot/keywords?phrase=${encodeURIComponent(row.keyword)}`);
      const res = await fetch(url, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        const message = data.error ? (data.hint ? `${data.error} (${data.hint})` : data.error) : "Failed to remove keyword";
        throw new Error(message);
      }
      await queryClient.invalidateQueries({ queryKey });
      setActionSuccess(`Removed "${row.keyword}"`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove keyword";
      setActionError(message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleExport = () => {
    const rows = keywords.map((r) => ({
      keyword: r.keyword,
      position: r.position ?? undefined,
      delta1d: r.delta1d,
      delta7d: r.delta7d,
    }));
    exportToCsv(rows, (exportFilename ?? "keywords-tracked") + ".csv");
  };

  return (
    <div
      className="min-w-0 rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 flex flex-col"
      aria-label="Keywords tracked"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 gap-2 flex-wrap shrink-0">
        <div className="shrink-0 min-w-0">
          <span className="font-semibold text-sm text-foreground flex items-center gap-1">Keywords tracked<InfoTooltip title="Rank-tracked keywords with position and trend" /></span>
          <p className="text-xs text-muted-foreground mt-0.5">Daily rank tracking for your target keywords</p>
          {showConnectMessage && (
            <p className="text-xs text-destructive/80 mt-0.5">
              {serpData?.error ?? "Unable to load tracked keywords."}
            </p>
          )}
          {!showConnectMessage && !isPropertyScoped && serpData?.canManageKeywords === false && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Read-only mode. Add/remove keywords in SerpRobot dashboard.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {canAddDelete && (
            <div className="flex items-center gap-1.5">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded border border-border bg-background px-1.5 py-1 text-xs focus:ring-2 focus:ring-ring focus:ring-offset-1"
                title="Google region for rank checks"
              >
                {GOOGLE_REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Add keyword"
                className="rounded border border-border bg-background px-2 py-1 text-xs w-32 focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={addLoading}
                className="rounded px-2 py-1 text-xs font-medium bg-background text-foreground border border-input hover:bg-accent transition-colors disabled:opacity-50"
              >
                {addLoading ? "…" : "Add"}
              </button>
            </div>
          )}
          {keywords.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
              title="Export CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto min-w-0">
        {actionError && (
          <p className="px-4 py-2 text-xs text-destructive border-b border-border">
            {actionError}
          </p>
        )}
        {actionSuccess && (
          <p className="px-4 py-2 text-xs text-positive border-b border-border">
            {actionSuccess}
          </p>
        )}
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">
            {showConnectMessage
              ? "Add keywords to start tracking."
              : "No tracked keywords yet. Add keywords to start tracking."}
          </p>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className={TABLE_BASE_CLASS}>
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <SortableHeader label="Name" column="keyword" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" className="min-w-0 w-[35%]" />
                  <SortableHeader label="Position" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-20" />
                  <SortableHeader label="1D Δ" column="delta1d" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
                  <SortableHeader label="7D Δ" column="delta7d" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
                  <th className={cn("text-right px-4 font-semibold w-20", "py-2")}>Trend</th>
                  {canAddDelete && <th className={cn("w-10 px-2", "py-2")} aria-label="Remove" />}
                </tr>
              </thead>
              <tbody>
                {keywords.map((row, idx) => (
                  <tr
                    key={`${row.keyword}-${idx}`}
                    className={TABLE_ROW_CLASS}
                  >
                    <td className={cn("px-4 text-foreground truncate min-w-0", TABLE_CELL_Y)} title={row.keyword}>
                      {row.keyword}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums text-foreground", TABLE_CELL_Y)}>
                      {row.status === "checking" ? (
                        <span className="inline-flex items-center justify-end gap-1.5 text-muted-foreground">
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <circle cx="12" cy="12" r="9" className="stroke-current opacity-25" strokeWidth="3" />
                            <path
                              className="fill-current opacity-90"
                              d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z"
                            />
                          </svg>
                          <span className="text-xs">Checking…</span>
                        </span>
                      ) : row.position != null ? (
                        row.position.toFixed(1)
                      ) : (
                        <span
                          className={cn(
                            "text-xs",
                            row.status === "error" ? "text-destructive" : "text-muted-foreground"
                          )}
                          title={row.warning}
                        >
                          {row.status === "error" ? "Error" : "—"}
                        </span>
                      )}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className={row.delta1d < 0 ? "text-positive" : row.delta1d > 0 ? "text-negative" : "text-muted-foreground"}>
                        {row.delta1d > 0 ? "+" : ""}{row.delta1d}
                      </span>
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className={row.delta7d < 0 ? "text-positive" : row.delta7d > 0 ? "text-negative" : "text-muted-foreground"}>
                        {row.delta7d > 0 ? "+" : ""}{row.delta7d}
                      </span>
                    </td>
                    <td className={cn("px-4 text-right", TABLE_CELL_Y)}>
                      <MiniSparkline data={row.sparkData} />
                    </td>
                    {canAddDelete && (
                      <td className={cn("px-2 text-right", TABLE_CELL_Y)}>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={deleteLoading === row.keyword}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
                          aria-label={`Remove ${row.keyword}`}
                          title="Remove keyword"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
