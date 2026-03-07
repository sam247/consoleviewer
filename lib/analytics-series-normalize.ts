import type { SparkSeriesKey } from "@/contexts/spark-series-context";
import type { DailyRow } from "@/hooks/use-property-data";

export type SeriesPoint = { date: string; value: number | null };

/** Source for a series (google = primary metrics; bing = overlay only). */
export type SeriesSource = "google" | "bing";

export type AnalyticsSeries = {
  source: SeriesSource;
  metric: SparkSeriesKey;
  values: SeriesPoint[];
};

export function normalizeDailyToSeries(params: {
  source: SeriesSource;
  daily: DailyRow[];
  metrics: SparkSeriesKey[];
}): AnalyticsSeries[] {
  const { source, daily, metrics } = params;
  return metrics.map((metric) => ({
    source,
    metric,
    values: daily.map((d) => {
      if (metric === "clicks") return { date: d.date, value: d.clicks };
      if (metric === "impressions") return { date: d.date, value: d.impressions };
      if (metric === "ctr") return { date: d.date, value: d.ctr ?? null };
      return { date: d.date, value: d.position ?? null };
    }),
  }));
}

