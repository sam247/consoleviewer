"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DataTableRow } from "@/components/data-table";
import { useDateRange } from "@/contexts/date-range-context";
import { decodePropertyId } from "@/types/gsc";

async function fetchSnapshot(propertyId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/snapshot?${params}`);
  if (!res.ok) throw new Error("Failed to fetch snapshot");
  return res.json();
}

async function fetchQueries(propertyId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/queries?${params}`);
  if (!res.ok) throw new Error("Failed to fetch queries");
  return res.json();
}

async function fetchPages(propertyId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/pages?${params}`);
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json();
}

async function fetchOpportunity(propertyId: string) {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/opportunity`);
  if (!res.ok) throw new Error("Failed to fetch opportunity");
  return res.json();
}

async function fetchMovements(propertyId: string) {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/movements`);
  if (!res.ok) throw new Error("Failed to fetch movements");
  return res.json();
}

async function fetchCannibalisation(propertyId: string) {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/cannibalisation`);
  if (!res.ok) throw new Error("Failed to fetch cannibalisation");
  return res.json();
}

export type Summary = {
  clicks: number;
  impressions: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
  position?: number;
  positionChangePercent?: number;
  ctr?: number;
  ctrChangePercent?: number;
  queryCount?: number;
  queryCountChangePercent?: number;
};

export type DailyRow = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position?: number;
};

export type BrandedData = {
  brandedClicks: number;
  nonBrandedClicks: number;
  brandedChangePercent: number;
  nonBrandedChangePercent: number;
};

export type PropertyData = {
  siteUrl: string;
  summary: Summary | null;
  daily: DailyRow[];
  priorDaily: DailyRow[];
  queries: DataTableRow[];
  pages: DataTableRow[];
  countries: DataTableRow[];
  devices: DataTableRow[];
  newQueries: DataTableRow[];
  lostQueries: DataTableRow[];
  newPages: DataTableRow[];
  lostPages: DataTableRow[];
  branded: BrandedData;
  brandedDaily: { date: string; brandedClicks: number; nonBrandedClicks: number }[];
  snapshotTop3?: number;
  snapshotTop10?: number;
};

export function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export function usePropertyData(propertyId: string) {
  const { startDate, endDate } = useDateRange();

  const { data: snapshotData, isLoading: snapshotLoading, error: snapshotError } = useQuery({
    queryKey: ["snapshot", propertyId, startDate, endDate],
    queryFn: () => fetchSnapshot(propertyId, startDate, endDate),
  });

  const { data: queriesData = [] } = useQuery({
    queryKey: ["queries", propertyId, startDate, endDate],
    queryFn: () => fetchQueries(propertyId, startDate, endDate),
  });

  const { data: pagesData = [] } = useQuery({
    queryKey: ["pages", propertyId, startDate, endDate],
    queryFn: () => fetchPages(propertyId, startDate, endDate),
  });

  useQuery({
    queryKey: ["opportunity", propertyId],
    queryFn: () => fetchOpportunity(propertyId),
  });

  useQuery({
    queryKey: ["movements", propertyId],
    queryFn: () => fetchMovements(propertyId),
  });

  const { data: cannibalisationData, isLoading: cannibalisationLoading, error: cannibalisationError } = useQuery({
    queryKey: ["cannibalisation", propertyId],
    queryFn: () => fetchCannibalisation(propertyId),
  });

  const siteUrl = useMemo(() => {
    if (snapshotData?.site_url) return snapshotData.site_url;
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)) return propertyId;
      return decodePropertyId(propertyId);
    } catch {
      return propertyId;
    }
  }, [snapshotData?.site_url, propertyId]);

  const siteSlug = useMemo(() => {
    try {
      const host = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./, "");
      return host.replace(/\./g, "-").toLowerCase();
    } catch {
      return propertyId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    }
  }, [siteUrl, propertyId]);

  const snapshot = snapshotData?.snapshot ?? null;

  const data: PropertyData = useMemo(() => {
    const chartRows = snapshotData?.chart ?? [];
    const summary: Summary | null = snapshot
      ? {
          clicks: snapshot.clicks,
          impressions: snapshot.impressions,
          clicksChangePercent: 0,
          impressionsChangePercent: 0,
          position: snapshot.avg_position,
          positionChangePercent: undefined,
          ctr: snapshot.ctr,
          ctrChangePercent: undefined,
          queryCount: snapshot.query_count,
          queryCountChangePercent: undefined,
        }
      : null;
    const daily: DailyRow[] = chartRows.map((d: { date: string; clicks: number; impressions: number; position?: number; position_sum?: number }) => ({
      date: d.date,
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      position:
        d.position != null
          ? d.position
          : d.impressions > 0 && d.position_sum != null
            ? d.position_sum / d.impressions
            : undefined,
    }));
    const queries: DataTableRow[] = (queriesData as { query: string; clicks: number; impressions: number; avg_position?: number }[]).map((r) => ({
      key: r.query,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: 0,
      position: r.avg_position,
    }));
    const pages: DataTableRow[] = (pagesData as { page: string; clicks: number; impressions: number; avg_position?: number }[]).map((r) => ({
      key: r.page,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: 0,
      position: r.avg_position,
    }));
    return {
      siteUrl,
      summary,
      daily,
      priorDaily: [],
      queries,
      pages,
      countries: [],
      devices: [],
      newQueries: [],
      lostQueries: [],
      newPages: [],
      lostPages: [],
      branded: {
        brandedClicks: 0,
        nonBrandedClicks: summary?.clicks ?? 0,
        brandedChangePercent: 0,
        nonBrandedChangePercent: 0,
      },
      brandedDaily: [],
      snapshotTop3: snapshot?.top3_count,
      snapshotTop10: snapshot?.top10_count,
    };
  }, [snapshot, snapshotData, queriesData, pagesData, siteUrl]);

  const queriesRows = useMemo<DataTableRow[]>(
    () => data.queries,
    [data.queries]
  );

  const pagesRows = useMemo<DataTableRow[]>(
    () => data.pages,
    [data.pages]
  );

  const queryCounting = useMemo(() => {
    const q = data.queries;
    const total = data.summary?.queryCount ?? q.length;
    const top10 = data.snapshotTop10 ?? q.filter((r) => r.position != null && r.position <= 10).length;
    const top3 = data.snapshotTop3 ?? q.filter((r) => r.position != null && r.position <= 3).length;
    return { total, top10, top3 };
  }, [data.queries, data.summary?.queryCount, data.snapshotTop3, data.snapshotTop10]);

  const dailyForCharts = useMemo(() => data.daily, [data.daily]);

  return {
    data,
    queriesRows,
    pagesRows,
    queryCounting,
    dailyForCharts,
    siteUrl,
    siteSlug,
    startDate,
    endDate,
    isLoading: snapshotLoading,
    error: snapshotError,
    cannibalisationData,
    cannibalisationLoading,
    cannibalisationError,
  };
}
