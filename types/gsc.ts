/** GSC site property from sites.list */
export interface GCSSite {
  siteUrl: string;
  permissionLevel: string;
}

/** Single row from searchAnalytics.query (dimension keys vary by request) */
export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Response shape from searchAnalytics.query */
export interface SearchAnalyticsResponse {
  rows: SearchAnalyticsRow[];
}

/** Date range preset for UI */
export type DateRangeKey =
  | "7d" | "28d" | "30d" | "3m" | "6m" | "12m" | "16m"
  | "l90d" | "mtd" | "lm" | "qtd" | "lq" | "ytd" | "fy" | "lfy"
  | "bw1" | "bw2" | "bw4" | "bm1" | "bm3" | "bq"
  | "fy_uk" | "fy_us" | "fy_au" | "fy_in" | "fy_jp" | "fy_de"
  | "lfy_uk" | "lfy_us" | "lfy_au" | "lfy_in" | "lfy_jp" | "lfy_de"
  | "custom";

/** Overview metrics for one site (aggregate + daily for sparkline) */
export interface SiteOverviewMetrics {
  siteUrl: string;
  clicks: number;
  impressions: number;
  clicksChangePercent: number;
  impressionsChangePercent: number;
  position?: number;
  positionChangePercent?: number;
  /** Mock only: avg tracked rank for dashboard rank strip variants */
  avgTrackedRank?: number;
  avgTrackedRankDelta?: number;
  trackedKeywordCount?: number;
  bingConnected?: boolean;
  daily: { date: string; clicks: number; impressions: number; position?: number }[];
  /** Bing daily for dashboard sparkline when Bing overlay is on (same date range as daily, zero-filled). */
  bingDaily?: { date: string; clicks: number; impressions: number }[];
}

/** Single query–page pair from GSC searchAnalytics (dimensions query + page). */
export interface QueryPagePair {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Dimension row with optional position (queries/pages from GSC). */
export interface SiteDetailDimensionRow {
  key: string;
  clicks: number;
  impressions: number;
  changePercent: number;
  position?: number;
}

/** New = in current not prior; Lost = in prior not current (minimal for display). */
export interface SiteDetailLostRow {
  key: string;
  clicks: number;
  impressions: number;
}

/** Drill-down: summary + daily + dimension tables with prior-period change */
export interface SiteDetailData {
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
  /** Prior period daily for chart overlay (compare mode). */
  priorDaily?: { date: string; clicks: number; impressions: number; ctr?: number; position?: number }[];
  queries: SiteDetailDimensionRow[];
  pages: SiteDetailDimensionRow[];
  countries: { key: string; clicks: number; impressions: number; changePercent: number }[];
  devices: { key: string; clicks: number; impressions: number; changePercent: number }[];
  newQueries: SiteDetailDimensionRow[];
  lostQueries: SiteDetailLostRow[];
  newPages: SiteDetailDimensionRow[];
  lostPages: SiteDetailLostRow[];
  branded: { brandedClicks: number; nonBrandedClicks: number; brandedChangePercent?: number; nonBrandedChangePercent?: number };
  brandedDaily?: { date: string; brandedClicks: number; nonBrandedClicks: number }[];
}

/** Encoded property ID for URL path (base64url, single segment) */
export function encodePropertyId(siteUrl: string): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(siteUrl, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(siteUrl)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePropertyId(propertyId: string): string {
  const base64 = propertyId.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(padded)));
}
