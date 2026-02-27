"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SiteCard } from "@/components/site-card";
import { SiteCardSkeleton } from "@/components/site-card-skeleton";
import { SortSelect, type SortKey } from "@/components/sort-select";
import { useDateRange } from "@/contexts/date-range-context";
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
  const [sortBy, setSortBy] = useState<SortKey>("clicks");
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();

  const { data: gscStatus } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { gscConnected: false };
      return res.json() as Promise<{ gscConnected: boolean }>;
    },
  });

  const { data: metrics = [], isLoading, error } = useQuery({
    queryKey: ["overview", startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () =>
      fetchOverview(startDate, endDate, priorStartDate, priorEndDate),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return metrics;
    const q = search.toLowerCase();
    return metrics.filter((m) => m.siteUrl.toLowerCase().includes(q));
  }, [metrics, search]);

  const sorted = useMemo(() => sortMetrics(filtered, sortBy), [filtered, sortBy]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        showSearch
        searchValue={search}
        onSearchChange={setSearch}
        sortSelect={<SortSelect value={sortBy} onChange={setSortBy} />}
      />
      <main className="flex-1 p-4 md:p-6">
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
                : "No properties yet. Connect Google Search Console to see your sites."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
