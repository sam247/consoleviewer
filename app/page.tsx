"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SiteCard } from "@/components/site-card";
import { SiteCardSkeleton } from "@/components/site-card-skeleton";
import { SortSelect, type SortKey } from "@/components/sort-select";
import { FilterSelect, type FilterKey } from "@/components/filter-select";
import { RankDisplaySelect } from "@/components/rank-display-select";
import { useDateRange } from "@/contexts/date-range-context";
import { useHiddenProjects } from "@/contexts/hidden-projects-context";
import { usePinnedProjects } from "@/contexts/pinned-projects-context";
import { attachMockRankToMetrics } from "@/lib/mock-rank";
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
  const res = await fetch(`/api/analytics/overview?${params}`);
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
  const [sortBy, setSortBy] = useState<SortKey>("total");
  const [filterBy, setFilterBy] = useState<FilterKey>("all");
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

  const { data: rawMetrics = [], isLoading, error } = useQuery({
    queryKey: ["overview", startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () =>
      fetchOverview(startDate, endDate, priorStartDate, priorEndDate),
  });

  const metrics = useMemo(
    () => attachMockRankToMetrics(rawMetrics, 3),
    [rawMetrics]
  );

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
        rankDisplaySelect={<RankDisplaySelect />}
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
        {gscStatus && !gscStatus.gscConnected && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Connect Google Search Console</p>
            <p className="mt-1 text-muted-foreground">
              You’re seeing sample data. Sign in with Google to load your sites.
            </p>
            <a
              href="/api/auth/google"
              className="mt-2 inline-block rounded-md bg-foreground px-3 py-1.5 text-sm text-background hover:opacity-90"
            >
              Sign in with Google
            </a>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error instanceof Error ? error.message : "Something went wrong"}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <SiteCardSkeleton key={`skeleton-${i}`} />
              ))
            : sorted.map((m) => <SiteCard key={m.siteUrl} metrics={m} />)}
        </div>
        {!isLoading && sorted.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {search.trim()
                ? "No properties match your search."
                : notHidden.length === 0 && metrics.length > 0
                  ? "All projects are hidden. Unhide some in Settings."
                  : "No properties yet. Connect Google Search Console to see your sites."}
            </p>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
