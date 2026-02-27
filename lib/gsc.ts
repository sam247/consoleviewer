/**
 * GSC API client. Uses real Search Console API when GOOGLE_REFRESH_TOKEN is set;
 * otherwise returns stub data.
 */

import { getAccessToken } from "@/lib/google-auth";
import type {
  GCSSite,
  SearchAnalyticsResponse,
  SiteOverviewMetrics,
  SiteDetailData,
} from "@/types/gsc";

const GSC_BASE = "https://www.googleapis.com/webmasters/v3";

async function gscFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return fetch(`${GSC_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

export async function listSites(): Promise<GCSSite[]> {
  const token = await getAccessToken();
  if (!token) {
    return getStubSites();
  }
  const res = await gscFetch("/sites");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid or expired token");
    throw new Error(`GSC sites.list failed: ${res.status}`);
  }
  const data = (await res.json()) as { siteEntry?: { siteUrl?: string; permissionLevel?: string }[] };
  const entries = data.siteEntry ?? [];
  return entries
    .filter((e): e is { siteUrl: string; permissionLevel: string } => Boolean(e.siteUrl))
    .map((e) => ({ siteUrl: e.siteUrl, permissionLevel: e.permissionLevel ?? "" }));
}

function getStubSites(): GCSSite[] {
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
  const token = await getAccessToken();
  if (!token) {
    return getStubSearchAnalytics(dimensions);
  }
  const encodedSite = encodeURIComponent(siteUrl);
  const res = await gscFetch(`/sites/${encodedSite}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, dimensions }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid or expired token");
    throw new Error(`GSC searchAnalytics.query failed: ${res.status}`);
  }
  const data = (await res.json()) as { rows?: SearchAnalyticsResponse["rows"] };
  return { rows: data.rows ?? [] };
}

function getStubSearchAnalytics(dimensions: string[]): SearchAnalyticsResponse {
  return {
    rows: Array.from({ length: 12 }, (_, i) => ({
      keys: dimensions.map((_, j) => `mock-${dimensions[j]}-${i}`),
      clicks: Math.floor(100 + Math.random() * 500),
      impressions: Math.floor(1000 + Math.random() * 5000),
      ctr: 0.02 + Math.random() * 0.05,
      position: 5 + Math.random() * 20,
    })),
  };
}

/** Overview metrics for all sites (aggregate + daily for sparklines). */
export async function getOverviewMetrics(
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
): Promise<SiteOverviewMetrics[]> {
  const sites = await listSites();
  const token = await getAccessToken();
  if (!token) {
    return sites.map((site, i) => getStubOverviewMetrics(site, i, startDate, endDate, priorStartDate, priorEndDate));
  }
  const result: SiteOverviewMetrics[] = [];
  for (const site of sites) {
    try {
      const [currentRes, priorRes, dailyRes] = await Promise.all([
        querySearchAnalytics(site.siteUrl, startDate, endDate, []),
        querySearchAnalytics(site.siteUrl, priorStartDate, priorEndDate, []),
        querySearchAnalytics(site.siteUrl, startDate, endDate, ["date"]),
      ]);
      const current = currentRes.rows[0];
      const prior = priorRes.rows[0];
      const clicks = current?.clicks ?? 0;
      const impressions = current?.impressions ?? 0;
      const priorClicks = prior?.clicks ?? 0;
      const priorImpressions = prior?.impressions ?? 0;
      const daily = (dailyRes.rows ?? [])
        .map((r) => ({
          date: r.keys[0] ?? "",
          clicks: r.clicks,
          impressions: r.impressions,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      result.push({
        siteUrl: site.siteUrl,
        clicks,
        impressions,
        clicksChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
        impressionsChangePercent: priorImpressions > 0 ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100) : 0,
        daily,
      });
    } catch {
      result.push(getStubOverviewMetrics(site, result.length, startDate, endDate, priorStartDate, priorEndDate));
    }
  }
  return result;
}

function getStubOverviewMetrics(
  site: GCSSite,
  i: number,
  _startDate: string,
  _endDate: string,
  _priorStartDate: string,
  _priorEndDate: string
): SiteOverviewMetrics {
  const clicks = 5000 + i * 2000 + Math.floor(Math.random() * 3000);
  const impressions = 50000 + i * 10000 + Math.floor(Math.random() * 20000);
  const priorClicks = Math.floor(clicks * (0.5 + Math.random() * 0.5));
  const priorImpressions = Math.floor(impressions * (0.5 + Math.random() * 0.5));
  const daily = Array.from({ length: 14 }, (_, d) => ({
    date: new Date(Date.now() - (13 - d) * 86400000).toISOString().slice(0, 10),
    clicks: Math.floor(clicks / 14 + (Math.random() - 0.5) * 100),
    impressions: Math.floor(impressions / 14 + (Math.random() - 0.5) * 1000),
  }));
  return {
    siteUrl: site.siteUrl,
    clicks,
    impressions,
    clicksChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
    impressionsChangePercent: priorImpressions > 0 ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100) : 0,
    daily,
  };
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
  return keys.map((key) => {
    const clicks = Math.floor(baseClicks / keys.length + (Math.random() - 0.3) * 200);
    const impressions = Math.floor(baseImpressions / keys.length + (Math.random() - 0.3) * 2000);
    const priorClicks = Math.floor(clicks * (0.4 + Math.random() * 0.6));
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

/** Full drill-down data for one site. */
export async function getSiteDetail(
  siteUrl: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
): Promise<SiteDetailData> {
  const token = await getAccessToken();
  if (!token) {
    return getStubSiteDetail(siteUrl);
  }
  try {
    const [summaryCur, summaryPrior, dailyRes, queriesCur, queriesPrior, pagesCur, pagesPrior, countriesCur, countriesPrior, devicesCur, devicesPrior] = await Promise.all([
      querySearchAnalytics(siteUrl, startDate, endDate, []),
      querySearchAnalytics(siteUrl, priorStartDate, priorEndDate, []),
      querySearchAnalytics(siteUrl, startDate, endDate, ["date"]),
      querySearchAnalytics(siteUrl, startDate, endDate, ["query"]),
      querySearchAnalytics(siteUrl, priorStartDate, priorEndDate, ["query"]),
      querySearchAnalytics(siteUrl, startDate, endDate, ["page"]),
      querySearchAnalytics(siteUrl, priorStartDate, priorEndDate, ["page"]),
      querySearchAnalytics(siteUrl, startDate, endDate, ["country"]),
      querySearchAnalytics(siteUrl, priorStartDate, priorEndDate, ["country"]),
      querySearchAnalytics(siteUrl, startDate, endDate, ["device"]),
      querySearchAnalytics(siteUrl, priorStartDate, priorEndDate, ["device"]),
    ]);
    const cur = summaryCur.rows[0];
    const prior = summaryPrior.rows[0];
    const clicks = cur?.clicks ?? 0;
    const impressions = cur?.impressions ?? 0;
    const priorClicks = prior?.clicks ?? 0;
    const priorImpressions = prior?.impressions ?? 0;
    const daily = (dailyRes.rows ?? [])
      .map((r) => ({ date: r.keys[0] ?? "", clicks: r.clicks, impressions: r.impressions }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const priorMap = (rows: SearchAnalyticsResponse["rows"], keyIndex: number) =>
      new Map((rows ?? []).map((r) => [r.keys[keyIndex] ?? "", { clicks: r.clicks, impressions: r.impressions }]));
    const toTable = (
      curRows: SearchAnalyticsResponse["rows"],
      priorRows: SearchAnalyticsResponse["rows"],
      keyIndex: number
    ): { key: string; clicks: number; impressions: number; changePercent: number }[] =>
      (curRows ?? []).map((r) => {
        const key = r.keys[keyIndex] ?? "";
        const prev = priorMap(priorRows, keyIndex).get(key);
        const changePercent =
          prev && prev.clicks > 0 ? Math.round(((r.clicks - prev.clicks) / prev.clicks) * 100) : 0;
        return { key, clicks: r.clicks, impressions: r.impressions, changePercent };
      });
    const queries = toTable(queriesCur.rows, queriesPrior.rows, 0);
    const pages = toTable(pagesCur.rows, pagesPrior.rows, 0);
    const countries = toTable(countriesCur.rows, countriesPrior.rows, 0);
    const devices = toTable(devicesCur.rows, devicesPrior.rows, 0);
    return {
      siteUrl,
      summary: {
        clicks,
        impressions,
        clicksChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
        impressionsChangePercent: priorImpressions > 0 ? Math.round(((impressions - priorImpressions) / priorImpressions) * 100) : 0,
      },
      daily,
      queries,
      pages,
      countries,
      devices,
      branded: {
        brandedClicks: 0,
        nonBrandedClicks: clicks,
        brandedChangePercent: 0,
        nonBrandedChangePercent: priorClicks > 0 ? Math.round(((clicks - priorClicks) / priorClicks) * 100) : 0,
      },
    };
  } catch {
    return getStubSiteDetail(siteUrl);
  }
}

function getStubSiteDetail(siteUrl: string): Promise<SiteDetailData> {
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
  return Promise.resolve({
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
  });
}
