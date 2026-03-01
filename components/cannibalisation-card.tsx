"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "consoleview-cannibalisation-open";

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
  siteUrl: string;
  startDate: string;
  endDate: string;
}

async function fetchCannibalisation(
  site: string,
  startDate: string,
  endDate: string
): Promise<{ conflicts: CannibalisationConflict[] }> {
  const params = new URLSearchParams({ site, startDate, endDate });
  const res = await fetch(`/api/analytics/cannibalisation?${params}`);
  if (!res.ok) throw new Error("Failed to fetch cannibalisation");
  return res.json();
}

const WHAT_TO_DO = [
  "Consolidate to primary URL (merge content or canonicalise).",
  "Merge or redirect weaker URLs to the primary URL.",
  "Differentiate intent per URL if you keep multiple targets.",
];

export function CannibalisationCard({
  siteUrl,
  startDate,
  endDate,
}: CannibalisationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [drawerConflict, setDrawerConflict] = useState<CannibalisationConflict | null>(null);
  const [mounted, setMounted] = useState(false);

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
    queryKey: ["cannibalisation", siteUrl, startDate, endDate],
    queryFn: () => fetchCannibalisation(siteUrl, startDate, endDate),
    enabled: expanded,
  });

  const conflicts = data?.conflicts ?? [];
  const count = conflicts.length;

  return (
    <section aria-label="Cannibalisation" className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-4 py-2.5"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-foreground">Cannibalisation</span>
        <span className="text-xs text-muted-foreground">
          {count} conflict{count !== 1 ? "s" : ""}
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
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-200 ease-out",
          expanded ? "max-h-[600px]" : "max-h-0"
        )}
      >
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          {expanded && (
            <>
              {isLoading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : conflicts.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No cannibalisation conflicts detected in this range.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2.5 px-4 text-muted-foreground font-medium">Query</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-20">Impr</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-16">Clicks</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-16">#URLs</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-24">Best pos</th>
                          <th className="text-right py-2.5 px-4 text-muted-foreground font-medium w-20">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflicts.map((c) => (
                          <tr
                            key={c.query}
                            onClick={() => setDrawerConflict(c)}
                            className="border-b border-border/50 last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-4 text-foreground truncate max-w-[180px]" title={c.query}>
                              {c.query}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                              {c.impressions.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                              {c.clicks}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                              {c.numUrls}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                              {c.bestPosition.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                              {Math.round(c.score)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {drawerConflict && (
        <CannibalisationDrawer
          conflict={drawerConflict}
          onClose={() => setDrawerConflict(null)}
        />
      )}
    </section>
  );
}

function CannibalisationDrawer({
  conflict,
  onClose,
}: {
  conflict: CannibalisationConflict;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cannibalisation-drawer-title"
    >
      <div
        className="w-full max-w-md bg-surface border-l border-border shadow-lg flex flex-col max-h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="cannibalisation-drawer-title" className="text-sm font-semibold text-foreground truncate pr-2">
            {conflict.query}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
            aria-label="Close"
          >
            &#215;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <div className="text-xs text-muted-foreground">
            Impr: {conflict.impressions.toLocaleString()} · Clicks: {conflict.clicks} · #URLs: {conflict.numUrls} · Best pos: {conflict.bestPosition.toFixed(1)}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">URLs</p>
            <ul className="space-y-2">
              {conflict.urls
                .sort((a, b) => b.clicks - a.clicks)
                .map((u) => (
                  <li key={u.page} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span
                      className={cn(
                        "truncate flex-1 min-w-0",
                        u.page === conflict.primary_url && "font-semibold text-foreground"
                      )}
                      title={u.page}
                    >
                      {u.page}
                      {u.page === conflict.primary_url && (
                        <span className="ml-1 text-xs text-muted-foreground">(suggested primary)</span>
                      )}
                    </span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {u.clicks} clicks · pos {u.position.toFixed(1)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">What to do</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {WHAT_TO_DO.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="absolute inset-0 -z-10"
        aria-label="Close"
        onClick={onClose}
      />
    </div>
  );
}
