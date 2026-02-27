/**
 * GSC API client wrapper. Stub implementation – replace with real
 * googleapis searchconsole calls once credentials are in place.
 */

import type {
  GCSSite,
  SearchAnalyticsResponse,
  SiteOverviewMetrics,
  SiteDetailData,
} from "@/types/gsc";

export async function listSites(): Promise<GCSSite[]> {
  // Stub: return mock sites. Replace with real sites.list when auth is wired.
  return [
    { siteUrl: "https://example.com/", permissionLevel: "siteOwner" },
    { siteUrl: "https://www.example.com/", permissionLevel: "siteFullUser" },
    { siteUrl: "sc-domain:example.org", permissionLevel: "siteOwner" },
  ];
}

export async function querySearchAnalytics(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[]
): Promise<SearchAnalyticsResponse> {
  // Stub: return mock rows. Replace with real searchanalytics.query.
  const rows = Array.from({ length: 12 }, (_, i) => ({
    keys: dimensions.map((_, j) => `mock-${dimensions[j]}-${i}`),
    clicks: Math.floor(100 + Math.random() * 500),
    impressions: Math.floor(1000 + Math.random() * 5000),
    ctr: 0.02 + Math.random() * 0.05,
    position: 5 + Math.random() * 20,
  }));
  return { rows };
}

/** Overview metrics for all sites (aggregate + daily for sparklines). Stub. */
export async function getOverviewMetrics(
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
): Promise<SiteOverviewMetrics[]> {
  const sites = await listSites();
  return sites.map((site, i) => {
    const clicks = 5000 + i * 2000 + Math.floor(Math.random() * 3000);
    const impressions = 50000 + i * 10000 + Math.floor(Math.random() * 20000);
    const priorClicks = Math.floor(clicks * (0.5 + Math.random() * 0.5));
    const priorImpressions = Math.floor(
      impressions * (0.5 + Math.random() * 0.5)
    );
    const daily = Array.from({ length: 14 }, (_, d) => ({
      date: new Date(Date.now() - (13 - d) * 86400000).toISOString().slice(0, 10),
      clicks: Math.floor(clicks / 14 + (Math.random() - 0.5) * 100),
      impressions: Math.floor(
        impressions / 14 + (Math.random() - 0.5) * 1000
      ),
    }));
    return {
      siteUrl: site.siteUrl,
      clicks,
      impressions,
      clicksChangePercent:
        priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
      impressionsChangePercent:
        priorImpressions > 0
          ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100)
          : 0,
      daily,
    };
  });
}

const MOCK_QUERIES = [
  "example search query",
  "how to example",
  "example pricing",
  "example docs",
  "example api",
  "example tutorial",
  "example review",
  "example vs alternative",
  "example login",
  "example support",
];
const MOCK_PAGES = [
  "/",
  "/pricing",
  "/docs",
  "/blog",
  "/about",
  "/contact",
  "/features",
  "/blog/getting-started",
  "/docs/api",
  "/login",
];
const MOCK_COUNTRIES = ["United Kingdom", "United States", "India", "Germany", "France", "Canada", "Australia", "Ireland", "Spain", "Netherlands"];
const MOCK_DEVICES = ["Mobile", "Desktop", "Tablet"];

function mockDimensionRows(
  keys: string[],
  baseClicks: number,
  baseImpressions: number
): { key: string; clicks: number; impressions: number; changePercent: number }[] {
  return keys.map((key, i) => {
    const clicks = Math.floor(baseClicks / keys.length + (Math.random() - 0.3) * 200);
    const impressions = Math.floor(baseImpressions / keys.length + (Math.random() - 0.3) * 2000);
    const priorClicks = Math.floor(clicks * (0.4 + Math.random() * 0.6));
    const priorImpressions = Math.floor(impressions * (0.4 + Math.random() * 0.6));
    const changePercent =
      priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0;
    return {
      key,
      clicks: Math.max(0, clicks),
      impressions: Math.max(0, impressions),
      changePercent,
    };
  });
}

/** Full drill-down data for one site. Stub. */
export async function getSiteDetail(
  siteUrl: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
): Promise<SiteDetailData> {
  const clicks = 1800 + Math.floor(Math.random() * 800);
  const impressions = 650000 + Math.floor(Math.random() * 100000);
  const priorClicks = Math.floor(clicks * 0.6);
  const priorImpressions = Math.floor(impressions * 0.55);
  const daily = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return {
      date: d.toISOString().slice(0, 10),
      clicks: Math.floor(clicks / 28 + (Math.random() - 0.5) * 30),
      impressions: Math.floor(impressions / 28 + (Math.random() - 0.5) * 500),
    };
  });
  return {
    siteUrl,
    summary: {
      clicks,
      impressions,
      clicksChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
      impressionsChangePercent: priorImpressions > 0 ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100) : 0,
    },
    daily,
    queries: mockDimensionRows(MOCK_QUERIES, clicks * 0.8, impressions * 0.8),
    pages: mockDimensionRows(MOCK_PAGES, clicks * 0.9, impressions * 0.9),
    countries: mockDimensionRows(MOCK_COUNTRIES, clicks, impressions),
    devices: mockDimensionRows(MOCK_DEVICES, clicks, impressions),
    branded: {
      brandedClicks: 133,
      nonBrandedClicks: 590,
      brandedChangePercent: 12,
      nonBrandedChangePercent: 22,
    },
  };
}
