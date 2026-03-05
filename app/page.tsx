"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SiteCard } from "@/components/site-card";
import { SiteCardSkeleton } from "@/components/site-card-skeleton";
import { SortSelect, type SortKey } from "@/components/sort-select";
import { FilterSelect, type FilterKey } from "@/components/filter-select";
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

  const { data: gscStatus } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { gscConnected: false };
      return res.json() as Promise<{ gscConnected: boolean }>;
    },
  });

  const { data: serpKeywords } = useQuery({
    queryKey: ["serprobotKeywords"],
    queryFn: async () => {
      const res = await fetch("/api/serprobot/keywords");
      if (!res.ok) return { configured: false, keywords: [] };
      return res.json() as Promise<{ configured: boolean; keywords: unknown[] }>;
    },
  });
  const hasTrackedKeywords =
    serpKeywords?.configured === true && (serpKeywords?.keywords?.length ?? 0) > 0;

  const { data: rawMetrics = [], isLoading, error, refetch } = useQuery({
    queryKey: ["overview", startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () =>
      fetchOverview(startDate, endDate, priorStartDate, priorEndDate),
    staleTime: 60 * 1000,
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        showSearch
        searchValue={search}
        onSearchChange={setSearch}
        sortSelect={<SortSelect value={sortBy} onChange={setSortBy} />}
        filterSelect={<FilterSelect value={filterBy} onChange={setFilterBy} />}
        shareScope="dashboard"
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
        {gscStatus && !gscStatus.gscConnected && (
          <p className="mb-4 text-sm text-muted-foreground">
            You’re seeing sample data.{" "}
            <Link href="/settings" className="text-foreground underline hover:no-underline">
              Connect Google Search Console in Settings
            </Link>{" "}
            to load your sites.
          </p>
        )}
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
            <a href="/onboarding/sites" className="text-sm text-muted-foreground hover:text-foreground underline">
              Manage or add sites
            </a>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <SiteCard
                      key={m.siteUrl}
                      metrics={m}
                      hasKeywords={hasTrackedKeywords}
                    />
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
        </div>
      </main>
    </div>
  );
}
