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
export type DateRangeKey = "7d" | "28d" | "3m" | "6m";

/** Overview metrics for one site (aggregate + daily for sparkline) */
export interface SiteOverviewMetrics {
  siteUrl: string;
  clicks: number;
  impressions: number;
  clicksChangePercent: number;
  impressionsChangePercent: number;
  daily: { date: string; clicks: number; impressions: number }[];
}

/** Drill-down: summary + daily + dimension tables with prior-period change */
export interface SiteDetailData {
  siteUrl: string;
  summary: {
    clicks: number;
    impressions: number;
    clicksChangePercent: number;
    impressionsChangePercent: number;
  };
  daily: { date: string; clicks: number; impressions: number }[];
  queries: { key: string; clicks: number; impressions: number; changePercent: number }[];
  pages: { key: string; clicks: number; impressions: number; changePercent: number }[];
  countries: { key: string; clicks: number; impressions: number; changePercent: number }[];
  devices: { key: string; clicks: number; impressions: number; changePercent: number }[];
  branded: { brandedClicks: number; nonBrandedClicks: number; brandedChangePercent?: number; nonBrandedChangePercent?: number };
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
