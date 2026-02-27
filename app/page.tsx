"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SiteCard } from "@/components/site-card";
import { SiteCardSkeleton } from "@/components/site-card-skeleton";
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

export default function OverviewPage() {
  const [search, setSearch] = useState("");
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch searchValue={search} onSearchChange={setSearch} />
      <main className="flex-1 p-4 md:p-6">
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
            : filtered.map((m) => <SiteCard key={m.siteUrl} metrics={m} />)}
        </div>
        {!isLoading && filtered.length === 0 && (
          <p className="text-muted-foreground text-sm py-8">
            No sites match your search.
          </p>
        )}
      </main>
    </div>
  );
}
