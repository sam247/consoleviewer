"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteCard } from "@/components/site-card";
import { TrendChart } from "@/components/trend-chart";
import { DataTable, type DataTableRow } from "@/components/data-table";
import { decodePropertyId } from "@/types/gsc";
import type { SiteOverviewMetrics } from "@/types/gsc";
import { getDateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type SharePayload = {
  scope: "dashboard" | "project";
  scopeId?: string;
  params?: { dateRange?: string };
  expiresAt: string;
};

async function fetchSharePayload(token: string): Promise<SharePayload | null> {
  const res = await fetch(`/api/share-links/${encodeURIComponent(token)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load shared link");
  return res.json();
}

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

async function fetchSiteDetail(
  siteUrl: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
) {
  const params = new URLSearchParams({
    site: siteUrl,
    startDate,
    endDate,
    priorStartDate,
    priorEndDate,
  });
  const res = await fetch(`/api/analytics/detail?${params}`);
  if (!res.ok) throw new Error("Failed to fetch site detail");
  return res.json();
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export default function SharedViewPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const [rangeKey] = useState<"7d" | "28d" | "30d" | "3m" | "6m" | "12m" | "16m" | "qtd">("28d");
  const range = useMemo(() => getDateRange(rangeKey), [rangeKey]);
  const { startDate, endDate, priorStartDate, priorEndDate } = range;

  const { data: payload, isLoading: payloadLoading, error: payloadError } = useQuery({
    queryKey: ["sharePayload", token],
    queryFn: () => fetchSharePayload(token),
    staleTime: 5 * 60 * 1000,
  });

  const { data: overviewData = [], isLoading: overviewLoading } = useQuery({
    queryKey: ["overview", startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () =>
      fetchOverview(startDate, endDate, priorStartDate, priorEndDate),
    enabled: payload?.scope === "dashboard" && !!payload,
  });

  const siteUrl = payload?.scope === "project" && payload.scopeId
    ? decodePropertyId(payload.scopeId)
    : "";
  const { data: siteDetail, isLoading: siteLoading } = useQuery({
    queryKey: ["siteDetail", siteUrl, startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () =>
      fetchSiteDetail(siteUrl, startDate, endDate, priorStartDate, priorEndDate),
    enabled: payload?.scope === "project" && !!siteUrl,
  });

  if (payloadLoading || !payload) {
    if (payloadError || (!payloadLoading && payload === null)) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
          <p className="text-lg text-muted-foreground">Link expired or invalid.</p>
          <Link href="/login" className="mt-4 text-sm text-foreground underline">
            Go to login
          </Link>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <p className="text-muted-foreground">Loading shared view…</p>
      </div>
    );
  }

  const expiresAt = payload.expiresAt;
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-GB", { dateStyle: "medium" })
    : "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface px-4 py-3">
        <div className="mx-auto max-w-[86rem] flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">Consoleview</span>
          <span className="text-sm text-muted-foreground">Shared view</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
          {payload.scope === "dashboard" && (
            <>
              <h1 className="text-lg font-medium text-foreground mb-4">Overview</h1>
              {overviewLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border border-border bg-surface animate-pulse h-32"
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {overviewData.map((m) => (
                    <SiteCard key={m.siteUrl} metrics={m} hasKeywords={false} />
                  ))}
                </div>
              )}
            </>
          )}

          {payload.scope === "project" && (
            <>
              <h1 className="text-lg font-medium text-foreground mb-4 truncate">
                {siteUrl || "Project"}
              </h1>
              {siteLoading ? (
                <div className="space-y-4">
                  <div className="h-20 rounded-lg border border-border bg-surface animate-pulse" />
                  <div className="h-64 rounded-lg border border-border bg-surface animate-pulse" />
                </div>
              ) : siteDetail ? (
                <div className="space-y-5">
                  <section className="rounded-lg border border-border bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Clicks</span>
                        <span className="text-xl font-semibold tabular-nums text-foreground">
                          {formatNum(siteDetail.summary?.clicks ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Impr.</span>
                        <span className="text-xl font-semibold tabular-nums text-foreground">
                          {formatNum(siteDetail.summary?.impressions ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Avg pos.</span>
                        <span className="text-xl font-semibold tabular-nums text-foreground">
                          {siteDetail.summary?.position != null
                            ? siteDetail.summary.position.toFixed(1)
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </section>
                  {siteDetail.daily?.length > 0 && (
                    <section className="rounded-lg border border-border bg-surface px-4 py-3">
                      <h2 className="text-sm font-semibold text-foreground mb-2">Performance over time</h2>
                      <TrendChart
                        data={siteDetail.daily}
                        priorData={siteDetail.priorDaily}
                        height={280}
                      />
                    </section>
                  )}
                  {siteDetail.queries?.length > 0 && (
                    <section className="rounded-lg border border-border bg-surface px-4 py-3">
                      <DataTable
                        title="Top queries"
                        rows={siteDetail.queries.slice(0, 20).map(
                          (r: { key: string; clicks: number; impressions: number; changePercent?: number; position?: number }) =>
                            ({
                              key: r.key,
                              clicks: r.clicks,
                              impressions: r.impressions,
                              changePercent: r.changePercent,
                              position: r.position,
                            } as DataTableRow)
                        )}
                        showFilter={false}
                      />
                    </section>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to load project data.</p>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border bg-surface px-4 py-2.5 text-center text-sm text-muted-foreground">
        Shared view · Expires {expiresLabel}
      </footer>
    </div>
  );
}
