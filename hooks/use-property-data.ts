"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DataTableRow } from "@/components/data-table";
import { useDateRange } from "@/contexts/date-range-context";
import { decodePropertyId } from "@/types/gsc";
import { normalizeDailyToSeries, type AnalyticsSeries } from "@/lib/analytics-series-normalize";

type SiteDetailResponse = {
  siteUrl: string;
  summary: {
    clicks: number;
    impressions: number;
    clicksChangePercent: number;
    impressionsChangePercent: number;
    position?: number;
    positionChangePercent?: number;
    ctr?: number;
    ctrChangePercent?: number;
    queryCount?: number;
    queryCountChangePercent?: number;
  };
  daily: { date: string; clicks: number; impressions: number; ctr?: number; position?: number }[];
  priorDaily?: { date: string; clicks: number; impressions: number; ctr?: number; position?: number }[];
  queries: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }[];
  pages: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }[];
  countries: { key: string; clicks: number; impressions: number; changePercent: number }[];
  devices: { key: string; clicks: number; impressions: number; changePercent: number }[];
  newQueries: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }[];
  lostQueries: { key: string; clicks: number; impressions: number }[];
  newPages: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }[];
  lostPages: { key: string; clicks: number; impressions: number }[];
  branded: {
    brandedClicks: number;
    nonBrandedClicks: number;
    brandedChangePercent?: number;
    nonBrandedChangePercent?: number;
  };
  brandedDaily?: { date: string; brandedClicks: number; nonBrandedClicks: number }[];
};

type BingDetailResponse = {
  connected: boolean;
  analyticsReady: boolean;
  daily: { date: string; clicks: number; impressions: number }[];
  dailySparse?: { date: string; clicks: number; impressions: number }[];
};

type EngineAvailabilityResponse = {
  google: { connected: boolean; analyticsReady: boolean };
  bing: { connected: boolean; mapped?: boolean; analyticsReady: boolean };
};

async function fetchDetail(
  propertyId: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
) {
  const params = new URLSearchParams({
    startDate,
    endDate,
    priorStartDate,
    priorEndDate,
  });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/detail?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch detail");
  }
  return res.json() as Promise<SiteDetailResponse>;
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

async function fetchBingDetail(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<BingDetailResponse> {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/bing/detail?${params}`);
  if (!res.ok) {
    return { connected: false, analyticsReady: false, daily: [] };
  }
  return res.json() as Promise<BingDetailResponse>;
}

async function fetchEngineAvailability(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<EngineAvailabilityResponse> {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/engine-availability?${params}`);
  if (!res.ok) {
    return {
      google: { connected: true, analyticsReady: true },
      bing: { connected: false, mapped: false, analyticsReady: false },
    };
  }
  return res.json() as Promise<EngineAvailabilityResponse>;
}

async function fetchQuerySparklines(
  propertyId: string,
  startDate: string,
  endDate: string,
  queryKeys: string[]
): Promise<Record<string, number[]>> {
  if (queryKeys.length === 0) return {};
  const params = new URLSearchParams({ startDate, endDate, queryKeys: JSON.stringify(queryKeys) });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/query-sparklines?${params}`);
  if (!res.ok) return {};
  return res.json();
}

function toDataTableRow(
  r: { key: string; clicks: number; impressions: number; changePercent?: number; position?: number }
): DataTableRow {
  return {
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
    position: r.position,
  };
}

function weightByPosition(pos: number): number {
  if (pos <= 3) return 1;
  if (pos <= 10) return 0.5;
  if (pos <= 20) return 0.2;
  return 0.05;
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
  visibilityScore?: number;
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
  /** Bing daily series (for chart overlay when Bing connected). */
  bingDaily?: DailyRow[];
  series?: AnalyticsSeries[];
  engineAvailability?: {
    bingConnected: boolean;
    bingMapped: boolean;
    bingAnalyticsReady: boolean;
  };
};

export type QueryCountingDailyRow = {
  date: string;
  totalQueries: number;
  top10: number;
  top3: number;
};

export function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export function usePropertyData(propertyId: string) {
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();

  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["detail", propertyId, startDate, endDate, priorStartDate, priorEndDate],
    queryFn: () => fetchDetail(propertyId, startDate, endDate, priorStartDate, priorEndDate),
  });

  const { data: bingDetail } = useQuery({
    queryKey: ["bing-detail", propertyId, startDate, endDate],
    queryFn: () => fetchBingDetail(propertyId, startDate, endDate),
  });

  const { data: engineAvailability } = useQuery({
    queryKey: ["engine-availability", propertyId, startDate, endDate],
    queryFn: () => fetchEngineAvailability(propertyId, startDate, endDate),
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

  const topQueryKeys = useMemo(
    () => (detailData?.queries ?? []).slice(0, 50).map((r) => r.key),
    [detailData?.queries]
  );
  const { data: sparklinesData = {} } = useQuery({
    queryKey: ["query-sparklines", propertyId, startDate, endDate, topQueryKeys.join("|")],
    queryFn: () => fetchQuerySparklines(propertyId, startDate, endDate, topQueryKeys),
    enabled: topQueryKeys.length > 0,
  });

  const { data: queryAppearancesData = {} } = useQuery({
    queryKey: ["search-appearances", propertyId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/search-appearances?${params}`);
      if (!res.ok) return {};
      return res.json() as Promise<Record<string, string[]>>;
    },
  });

  const { data: chartAnnotations = [], refetch: refetchAnnotations } = useQuery({
    queryKey: ["chart-annotations", propertyId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/annotations?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<{ id: string; date: string; label: string; color: string }[]>;
    },
  });

  const { data: queryCountingDailyData = [] } = useQuery({
    queryKey: ["query-counting-daily", propertyId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/snapshot?${params}`);
      if (!res.ok) return [] as QueryCountingDailyRow[];
      const json = (await res.json()) as { query_chart?: QueryCountingDailyRow[] };
      return Array.isArray(json.query_chart) ? json.query_chart : [];
    },
  });

  const siteUrl = useMemo(() => {
    if (detailData?.siteUrl) return detailData.siteUrl;
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)) return propertyId;
      return decodePropertyId(propertyId);
    } catch {
      return propertyId;
    }
  }, [detailData?.siteUrl, propertyId]);

  const siteSlug = useMemo(() => {
    try {
      const host = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./, "");
      return host.replace(/\./g, "-").toLowerCase();
    } catch {
      return propertyId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    }
  }, [siteUrl, propertyId]);

  const data: PropertyData = useMemo(() => {
    const emptyData = (url: string): PropertyData => ({
      siteUrl: url,
      summary: null,
      daily: [],
      priorDaily: [],
      queries: [],
      pages: [],
      countries: [],
      devices: [],
      newQueries: [],
      lostQueries: [],
      newPages: [],
      lostPages: [],
      branded: { brandedClicks: 0, nonBrandedClicks: 0, brandedChangePercent: 0, nonBrandedChangePercent: 0 },
      brandedDaily: [],
    });

    if (!detailData) {
      return emptyData(siteUrl);
    }
    const s = detailData.summary;
    const queriesForVis = detailData.queries ?? [];
    const withPosition = queriesForVis.filter((r) => r.position != null);
    const impressionsInQueries = withPosition.reduce((acc, r) => acc + (r.impressions ?? 0), 0);
    const weightedSum = withPosition.reduce(
      (acc, r) => acc + (r.impressions ?? 0) * weightByPosition(r.position as number),
      0
    );
    const visibilityScore =
      impressionsInQueries > 0 ? Math.round((weightedSum / impressionsInQueries) * 1000) / 10 : undefined;
    const summary: Summary | null = s
      ? {
          clicks: s.clicks,
          impressions: s.impressions,
          clicksChangePercent: s.clicksChangePercent,
          impressionsChangePercent: s.impressionsChangePercent,
          position: s.position,
          positionChangePercent: s.positionChangePercent,
          ctr: s.ctr,
          ctrChangePercent: s.ctrChangePercent,
          queryCount: s.queryCount,
          queryCountChangePercent: s.queryCountChangePercent,
          visibilityScore,
        }
      : null;
    const daily: DailyRow[] = (detailData.daily ?? []).map((d) => ({
      date: d.date,
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.ctr ?? (d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0),
      position: d.position,
    }));
    const priorDaily: DailyRow[] = (detailData.priorDaily ?? []).map((d) => ({
      date: d.date,
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.ctr ?? (d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0),
      position: d.position,
    }));
    const queries: DataTableRow[] = (detailData.queries ?? []).map(toDataTableRow);
    const pages: DataTableRow[] = (detailData.pages ?? []).map(toDataTableRow);
    const countries: DataTableRow[] = (detailData.countries ?? []).map((r) => ({
      key: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: r.changePercent,
    }));
    const devices: DataTableRow[] = (detailData.devices ?? []).map((r) => ({
      key: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: r.changePercent,
    }));
    const newQueries: DataTableRow[] = (detailData.newQueries ?? []).map(toDataTableRow);
    const lostQueries: DataTableRow[] = (detailData.lostQueries ?? []).map((r) => ({
      key: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: undefined,
    }));
    const newPages: DataTableRow[] = (detailData.newPages ?? []).map(toDataTableRow);
    const lostPages: DataTableRow[] = (detailData.lostPages ?? []).map((r) => ({
      key: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: undefined,
    }));
    const branded = detailData.branded
      ? {
          brandedClicks: detailData.branded.brandedClicks,
          nonBrandedClicks: detailData.branded.nonBrandedClicks,
          brandedChangePercent: detailData.branded.brandedChangePercent ?? 0,
          nonBrandedChangePercent: detailData.branded.nonBrandedChangePercent ?? 0,
        }
      : { brandedClicks: 0, nonBrandedClicks: 0, brandedChangePercent: 0, nonBrandedChangePercent: 0 };
    const snapshotTop3 = queries.filter((r) => r.position != null && r.position <= 3).length;
    const snapshotTop10 = queries.filter((r) => r.position != null && r.position <= 10).length;
    const bingRawDaily = (bingDetail?.dailySparse?.length ? bingDetail.dailySparse : bingDetail?.daily) ?? [];
    const bingDaily: DailyRow[] = bingRawDaily.map((d) => ({
      date: d.date,
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    }));

    const metricKeys: ("clicks" | "impressions" | "ctr" | "position")[] = [
      "clicks",
      "impressions",
      "ctr",
      "position",
    ];
    const googleSeries = normalizeDailyToSeries({
      source: "google",
      daily,
      metrics: metricKeys,
    });

    return {
      siteUrl: detailData.siteUrl,
      summary,
      daily,
      priorDaily,
      queries,
      pages,
      countries,
      devices,
      newQueries,
      lostQueries,
      newPages,
      lostPages,
      branded,
      brandedDaily: detailData.brandedDaily ?? [],
      snapshotTop3,
      snapshotTop10,
      bingDaily: bingDaily.length ? bingDaily : undefined,
      series: googleSeries,
      engineAvailability: {
        bingConnected: engineAvailability?.bing.connected ?? false,
        bingMapped: engineAvailability?.bing.mapped ?? false,
        bingAnalyticsReady:
          (engineAvailability?.bing.analyticsReady ?? false) || (bingDetail?.analyticsReady ?? false),
      },
    };
  }, [detailData, siteUrl, bingDetail, engineAvailability]);

  const queriesRows = useMemo<DataTableRow[]>(() => data.queries, [data.queries]);
  const pagesRows = useMemo<DataTableRow[]>(() => data.pages, [data.pages]);

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
    queryCountingDaily: queryCountingDailyData as QueryCountingDailyRow[],
    siteUrl,
    siteSlug,
    startDate,
    endDate,
    sparklines: sparklinesData as Record<string, number[]>,
    queryAppearances: queryAppearancesData as Record<string, string[]>,
    chartAnnotations: chartAnnotations as { id: string; date: string; label: string; color: string }[],
    refetchChartAnnotations: refetchAnnotations,
    isLoading: detailLoading,
    error: detailError,
    cannibalisationData,
    cannibalisationLoading,
    cannibalisationError,
  };
}
