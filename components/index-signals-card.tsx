"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DataTableRow } from "@/components/data-table";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "consoleview-index-signals-open";
const VISIBLE_ROWS = 20;

export type IndexSignalRow = {
  id: string;
  url: string;
  label: string | null;
  signal: "warning" | "stable";
  lastSeen: string | null;
  impressionsDelta: number | null;
  flags: string[];
};

type IndexSignalsResponse = {
  signals: IndexSignalRow[];
  summary: { total: number; warnings: number; stable: number };
  siteUrl: string;
};

interface IndexSignalsCardProps {
  propertyId: string;
  pagesRows: DataTableRow[];
}

async function fetchIndexSignals(propertyId: string): Promise<IndexSignalsResponse> {
  const res = await fetch(`/api/index-signals?propertyId=${encodeURIComponent(propertyId)}`);
  if (!res.ok) throw new Error("Failed to fetch index signals");
  return res.json();
}

export function IndexSignalsCard({ propertyId, pagesRows }: IndexSignalsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const stored = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    setExpanded(stored === "true");
  }, [mounted]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["indexSignals", propertyId],
    queryFn: () => fetchIndexSignals(propertyId),
    enabled: expanded,
  });

  const addMutation = useMutation({
    mutationFn: async (body: { url: string; label?: string }) => {
      const res = await fetch("/api/index-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, ...body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indexSignals", propertyId] });
      setAddModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/index-watchlist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indexSignals", propertyId] });
    },
  });

  const summary = data?.summary ?? { total: 0, warnings: 0, stable: 0 };
  const signals = data?.signals ?? [];
  const visible = signals.slice(0, VISIBLE_ROWS);
  const hasMore = signals.length > VISIBLE_ROWS;
  const siteUrl = data?.siteUrl ?? "";

  const suggestions = (() => {
    const byImpr = [...pagesRows].sort((a, b) => b.impressions - a.impressions).slice(0, 5);
    const byClicks = [...pagesRows].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
    const seen = new Set<string>();
    const out: { url: string; label: string }[] = [];
    for (const r of byImpr) {
      if (!seen.has(r.key)) {
        seen.add(r.key);
        out.push({ url: r.key, label: r.key });
      }
    }
    for (const r of byClicks) {
      if (!seen.has(r.key)) {
        seen.add(r.key);
        out.push({ url: r.key, label: r.key });
      }
    }
    return out.slice(0, 10);
  })();

  return (
    <section aria-label="Index signals" className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-4 py-2.5"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-foreground">Index signals</span>
        <span className="text-xs text-muted-foreground">
          Watchlist: {summary.total} URLs · Warnings: {summary.warnings} · Stable: {summary.stable}
        </span>
        <svg
          className={cn("size-4 text-muted-foreground transition-transform duration-200 shrink-0", expanded && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <p className="text-xs text-muted-foreground px-4 pb-2">
        Based on Search Console and optional page checks.
      </p>
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-200 ease-out",
          expanded ? "max-h-[800px]" : "max-h-0"
        )}
      >
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          {expanded && (
            <>
              {isLoading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : signals.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No URLs in watchlist.</p>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(true)}
                    className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                  >
                    Add URL to watchlist
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">URL · Signal · Last seen · Impr Δ</span>
                    <button
                      type="button"
                      onClick={() => setAddModalOpen(true)}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      Add URL to watchlist
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2.5 px-4 text-muted-foreground font-medium">URL</th>
                          <th className="text-left py-2.5 px-4 text-muted-foreground font-medium w-24">Signal</th>
                          <th className="text-left py-2.5 px-4 text-muted-foreground font-medium w-28">Last seen</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-20">Impr Δ</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 last:border-b-0 hover:bg-accent/50"
                          >
                            <td className="py-2.5 px-4 text-foreground truncate max-w-[200px]" title={row.url}>
                              {row.url}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  row.signal === "warning" ? "text-amber-600 dark:text-amber-400" : "text-positive"
                                )}
                              >
                                {row.signal === "warning" ? "Warning" : "Stable"}
                              </span>
                              {row.flags.length > 0 && (
                                <span className="block text-xs text-muted-foreground" title={row.flags.join(", ")}>
                                  {row.flags[0]}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground">
                              {row.lastSeen ?? "No data in range"}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {row.impressionsDelta != null ? (
                                <span
                                  className={
                                    row.impressionsDelta >= 0 ? "text-positive" : "text-negative"
                                  }
                                >
                                  {row.impressionsDelta >= 0 ? "+" : ""}
                                  {row.impressionsDelta}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {siteUrl && (
                                <a
                                  href={`https://search.google.com/search-console?resource_id=${encodeURIComponent(siteUrl)}&page=${encodeURIComponent(row.url)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-foreground underline hover:no-underline"
                                >
                                  Open in GSC
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(row.id)}
                                className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasMore && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">
                      Viewing first {VISIBLE_ROWS} of {signals.length}. Add more via &quot;Add URL to watchlist&quot;.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {addModalOpen && (
        <AddToWatchlistModal
          suggestions={suggestions}
          onAdd={(url, label) => addMutation.mutateAsync({ url, label })}
          onClose={() => setAddModalOpen(false)}
          isPending={addMutation.isPending}
          error={addMutation.error?.message}
        />
      )}
    </section>
  );
}

function AddToWatchlistModal({
  suggestions,
  onAdd,
  onClose,
  isPending,
  error,
}: {
  suggestions: { url: string; label: string }[];
  onAdd: (url: string, label?: string) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
  error?: string;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    await onAdd(u, label.trim() || undefined);
    setUrl("");
    setLabel("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-watchlist-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-lg px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="add-watchlist-title" className="text-lg font-semibold text-foreground">
            Add URL to watchlist
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            &#215;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="watchlist-url" className="block text-sm font-medium text-foreground mb-1">
              URL
            </label>
            <input
              id="watchlist-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="watchlist-label" className="block text-sm font-medium text-foreground mb-1">
              Label (optional)
            </label>
            <input
              id="watchlist-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          {suggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Suggestions (top pages by impressions and clicks)</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.url}
                    type="button"
                    onClick={() => setUrl(s.url)}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    {s.url.length > 40 ? s.url.slice(0, 37) + "…" : s.url}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim() || isPending}
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
