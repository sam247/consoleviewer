import type { SiteOverviewMetrics } from "@/types/gsc";

export interface MockTrackedKeyword {
  keyword: string;
  position: number;
  delta1d: number;
  delta7d: number;
  sparkData: number[];
}

const STORAGE_KEY = "consoleview-tracked-keywords-open";

/** Mock tracked keywords for project view (5–10 rows). Not keyed by site; same list for all. */
const MOCK_KEYWORDS: MockTrackedKeyword[] = [
  { keyword: "best running shoes", position: 4.2, delta1d: -0.3, delta7d: 1.1, sparkData: [6.1, 5.8, 5.2, 4.9, 4.5, 4.2, 4.2] },
  { keyword: "marathon training plan", position: 8.5, delta1d: 0.5, delta7d: -1.2, sparkData: [9.2, 9.0, 8.8, 8.7, 8.6, 8.5, 8.5] },
  { keyword: "running gear review", position: 12.0, delta1d: -1.0, delta7d: -2.0, sparkData: [14.0, 13.5, 13.0, 12.5, 12.2, 12.0, 12.0] },
  { keyword: "trail running tips", position: 3.1, delta1d: 0.2, delta7d: 0.4, sparkData: [3.8, 3.5, 3.4, 3.3, 3.2, 3.1, 3.1] },
  { keyword: "half marathon pace", position: 7.0, delta1d: -0.4, delta7d: 0.8, sparkData: [7.8, 7.5, 7.3, 7.2, 7.1, 7.0, 7.0] },
  { keyword: "running recovery", position: 15.2, delta1d: 1.2, delta7d: -0.5, sparkData: [16.0, 15.8, 15.6, 15.4, 15.3, 15.2, 15.2] },
  { keyword: "running form", position: 5.5, delta1d: 0, delta7d: -0.3, sparkData: [5.9, 5.8, 5.7, 5.6, 5.5, 5.5, 5.5] },
];

export function getMockTrackedKeywords(_siteUrl?: string): MockTrackedKeyword[] {
  return [...MOCK_KEYWORDS];
}

/** Persisted key for Tracked Keywords section expanded state (used by component). */
export function getTrackedKeywordsStorageKey(): string {
  return STORAGE_KEY;
}

/** Mock rank values for dashboard cards (repeated so many cards show rank). */
const MOCK_RANK_VALUES: { avg: number; delta: number }[] = [
  { avg: 6.4, delta: 1.2 },
  { avg: 8.1, delta: -0.5 },
  { avg: 4.9, delta: 0.3 },
  { avg: 12.2, delta: 0.8 },
  { avg: 5.1, delta: -0.2 },
  { avg: 9.0, delta: -1.1 },
  { avg: 7.3, delta: 0.4 },
  { avg: 3.8, delta: -0.6 },
  { avg: 11.5, delta: 1.0 },
  { avg: 6.0, delta: 0 },
  { avg: 14.2, delta: -0.3 },
  { avg: 4.5, delta: 0.5 },
];

/** Attach mock avgTrackedRank and avgTrackedRankDelta to first N sites for dashboard testing. */
export function attachMockRankToMetrics(
  metrics: SiteOverviewMetrics[],
  count = 12
): SiteOverviewMetrics[] {
  return metrics.map((m, i) => {
    if (i >= count) return m;
    const mock = MOCK_RANK_VALUES[i % MOCK_RANK_VALUES.length];
    return { ...m, avgTrackedRank: mock.avg, avgTrackedRankDelta: mock.delta };
  });
}
