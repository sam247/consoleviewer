"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SiteCard } from "@/components/site-card";
import { SiteCardSkeleton } from "@/components/site-card-skeleton";
import { SortSelect, type SortKey } from "@/components/sort-select";
import { FilterSelect, type FilterKey } from "@/components/filter-select";
import { AiPanelShell } from "@/components/ai-panel-shell";
import { DashboardRadar } from "@/components/dashboard-radar";
import { useDateRange } from "@/contexts/date-range-context";
import { useHiddenProjects } from "@/contexts/hidden-projects-context";
import { usePinnedProjects } from "@/contexts/pinned-projects-context";
import type { SiteOverviewMetrics } from "@/types/gsc";

async function fetchOverview(
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
): Promise<SiteOverviewMetrics[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    priorStartDate,
    priorEndDate,
  });
  const res = await fetch(`/api/analytics/overview?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
}

function sortMetrics(metrics: SiteOverviewMetrics[], sortBy: SortKey): SiteOverviewMetrics[] {
  const arr = [...metrics];
  switch (sortBy) {
    case "aToZ":
      return arr.sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
    case "total":
      return arr.sort((a, b) => b.clicks + b.impressions - (a.clicks + a.impressions));
    case "growth":
      return arr.sort(
        (a, b) =>
          b.clicksChangePercent + b.impressionsChangePercent -
          (a.clicksChangePercent + a.impressionsChangePercent)
      );
    case "growthPct":
      return arr.sort(
        (a, b) =>
          Math.max(b.clicksChangePercent, b.impressionsChangePercent) -
          Math.max(a.clicksChangePercent, a.impressionsChangePercent)
      );
    case "clicks":
      return arr.sort((a, b) => b.clicks - a.clicks);
    case "clicksChange":
      return arr.sort((a, b) => b.clicksChangePercent - a.clicksChangePercent);
    case "impressions":
      return arr.sort((a, b) => b.impressions - a.impressions);
    case "impressionsChange":
      return arr.sort((a, b) => b.impressionsChangePercent - a.impressionsChangePercent);
    default:
      return arr;
  }
}

export default function OverviewPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortByRaw] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "total";
    return (localStorage.getItem("consoleview-sort") as SortKey) || "total";
  });
  const [filterBy, setFilterByRaw] = useState<FilterKey>(() => {
    if (typeof window === "undefined") return "all";
    return (localStorage.getItem("consoleview-filter") as FilterKey) || "all";
  });
  const setSortBy = useCallback((v: SortKey) => {
    setSortByRaw(v);
    try { localStorage.setItem("consoleview-sort", v); } catch { /* ignore */ }
  }, []);
  const setFilterBy = useCallback((v: FilterKey) => {
    setFilterByRaw(v);
    try { localStorage.setItem("consoleview-filter", v); } catch { /* ignore */ }
  }, []);
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();
  const { hiddenSet } = useHiddenProjects();
  const { pinnedSet } = usePinnedProjects();

  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { gscConnected: false, bingConnected: false };
      return res.json() as Promise<{ gscConnected: boolean; bingConnected: boolean }>;
    },
  });

  const gscConnected = authStatus?.gscConnected ?? false;

  const { data: rawMetrics = [], isLoading, error, refetch } = useQuery({
    queryKey: ["overview", startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () =>
      fetchOverview(startDate, endDate, priorStartDate, priorEndDate),
    staleTime: 60 * 1000,
    enabled: gscConnected,
  });

  const metrics = useMemo(() => rawMetrics, [rawMetrics]);

  const notHidden = useMemo(
    () => metrics.filter((m) => !hiddenSet.has(m.siteUrl)),
    [metrics, hiddenSet]
  );

  const filtered = useMemo(() => {
    let list = notHidden;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.siteUrl.toLowerCase().includes(q));
    }
    if (filterBy !== "all") {
      // Future: filter by tag, country, etc.
    }
    return list;
  }, [notHidden, search, filterBy]);

  const sorted = useMemo(() => {
    const bySort = sortMetrics(filtered, sortBy);
    if (pinnedSet.size === 0) return bySort;
    return [...bySort].sort((a, b) => {
      const aPin = pinnedSet.has(a.siteUrl);
      const bPin = pinnedSet.has(b.siteUrl);
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      return 0;
    });
  }, [filtered, sortBy, pinnedSet]);

  const useCompactProjectGrid = sorted.length > 0 && sorted.length <= 2;
  const projectGridClass = useCompactProjectGrid
    ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header
        showSearch={gscConnected}
        searchValue={search}
        onSearchChange={setSearch}
        sortSelect={gscConnected ? <SortSelect value={sortBy} onChange={setSortBy} /> : undefined}
        filterSelect={gscConnected ? <FilterSelect value={filterBy} onChange={setFilterBy} /> : undefined}
        shareScope={gscConnected ? "dashboard" : undefined}
        aiScope={gscConnected ? "dashboard" : undefined}
      />
      {gscConnected && (
        <div className="px-3 md:px-6">
          <div className="mx-auto max-w-[86rem]">
            <DashboardRadar metrics={notHidden} isLoading={isLoading} />
          </div>
        </div>
      )}
      <main className="flex-1 p-3 md:p-6">
        <div className="mx-auto max-w-[86rem]">
          {authLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SiteCardSkeleton key={`auth-skeleton-${i}`} />
              ))}
            </div>
          ) : !gscConnected ? (
            <div className="py-16 text-center space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 opacity-20 pointer-events-none select-none">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SiteCardSkeleton key={`muted-${i}`} />
                ))}
              </div>
              <p className="text-lg font-medium text-foreground">Connect Google Search Console</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Connect your account to see your sites, clicks, impressions, and rankings.
              </p>
              <Link
                href="/settings"
                className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Go to Settings
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 flex flex-wrap items-center justify-between gap-2">
                  <span>{error instanceof Error ? error.message : "Something went wrong"}</span>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded bg-red-200 px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-300 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
                  >
                    Try again
                  </button>
                </div>
              )}
              {!isLoading && sorted.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-foreground">{sorted.length} site{sorted.length !== 1 ? "s" : ""}</h2>
                  <Link
                    href="/onboarding/sites"
                    className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    + Add
                  </Link>
                </div>
              )}
              <div className={projectGridClass}>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <SiteCardSkeleton key={`skeleton-${i}`} />
                    ))
                  : (
                      <Suspense
                        fallback={Array.from({ length: Math.min(sorted.length || 6, 12) }).map((_, i) => (
                          <SiteCardSkeleton key={`suspense-${i}`} />
                        ))}
                      >
                        {sorted.map((m) => (
                          <div
                            key={m.siteUrl}
                            className={sorted.length === 1 ? "sm:col-span-2" : undefined}
                          >
                            <SiteCard
                              metrics={m}
                              hasKeywords={(m.trackedKeywordCount ?? 0) > 0}
                            />
                          </div>
                        ))}
                      </Suspense>
                    )}
              </div>
              {!isLoading && sorted.length === 0 && (
                <div className="py-12 text-center space-y-3">
                  <p className="text-muted-foreground text-sm">
                    {search.trim()
                      ? "No properties match your search."
                      : notHidden.length === 0 && metrics.length > 0
                        ? "All projects are hidden. Unhide some in Settings."
                        : "No properties yet. Connect Google Search Console to see your sites."}
                  </p>
                  {!search.trim() && (
                    <a
                      href="/onboarding/sites"
                      className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                    >
                      Add or manage sites
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <AiPanelShell />
    </div>
  );
}
