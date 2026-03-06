import type { SearchEngine } from "@/contexts/engine-selection-context";
import type { SparkSeriesKey, SparkSeriesState } from "@/contexts/spark-series-context";

export const MAX_VISIBLE_SERIES = 4;

const METRIC_PRIORITY: SparkSeriesKey[] = ["clicks", "impressions", "ctr", "position"];

export type BudgetResult = {
  effectiveSources: SearchEngine[];
  effectiveMetrics: SparkSeriesKey[];
  nextSeriesState: SparkSeriesState;
  helperMessage: string | null;
  wasAutoTrimmed: boolean;
};

function uniqueMetrics(metrics: SparkSeriesKey[]): SparkSeriesKey[] {
  const set = new Set<SparkSeriesKey>();
  const out: SparkSeriesKey[] = [];
  for (const m of metrics) {
    if (!set.has(m)) {
      set.add(m);
      out.push(m);
    }
  }
  return out;
}

/**
 * Hybrid budget rule:
 * - apply as-is when series count <= MAX_VISIBLE_SERIES
 * - auto-trim metrics once when over budget and return helper message
 */
export function applySeriesBudget(params: {
  selectedSources: SearchEngine[];
  selectedMetrics: SparkSeriesKey[];
  currentSeriesState: SparkSeriesState;
}): BudgetResult {
  const effectiveSources: SearchEngine[] =
    params.selectedSources.length > 0 ? params.selectedSources : (["google"] as SearchEngine[]);
  const selectedMetrics = uniqueMetrics(params.selectedMetrics);
  const seriesCount = effectiveSources.length * selectedMetrics.length;

  if (seriesCount <= MAX_VISIBLE_SERIES) {
    return {
      effectiveSources,
      effectiveMetrics: selectedMetrics,
      nextSeriesState: params.currentSeriesState,
      helperMessage: null,
      wasAutoTrimmed: false,
    };
  }

  const maxMetrics = Math.max(1, Math.floor(MAX_VISIBLE_SERIES / effectiveSources.length));
  const sortedByPriority = METRIC_PRIORITY.filter((m) => selectedMetrics.includes(m));
  const trimmed = sortedByPriority.slice(0, maxMetrics);

  const nextSeriesState: SparkSeriesState = {
    clicks: false,
    impressions: false,
    ctr: false,
    position: false,
  };
  for (const m of trimmed) {
    nextSeriesState[m] = true;
  }

  return {
    effectiveSources,
    effectiveMetrics: trimmed,
    nextSeriesState,
    helperMessage: "Max 4 series visible. Disable a metric or source.",
    wasAutoTrimmed: true,
  };
}

