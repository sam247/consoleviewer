"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendChart } from "@/components/trend-chart";
import type { PropertyData } from "@/hooks/use-property-data";
import { ChartFrame, CHART_PLOT_H } from "@/components/ui/chart-frame";
import { DateRangeSelect } from "@/components/date-range-select";
import { useSparkSeries } from "@/contexts/spark-series-context";
import { useDateRange } from "@/contexts/date-range-context";

type CompareMode = "previous_period" | "previous_year";

function compareModeKey(propertyId: string) {
  return `consoleview-compare-mode-${propertyId}`;
}

function shiftYear(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

async function fetchPriorDaily(propertyId: string, startDate: string, endDate: string, priorStartDate: string, priorEndDate: string) {
  const params = new URLSearchParams({ startDate, endDate, priorStartDate, priorEndDate });
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/detail?${params}`, { cache: "no-store" });
  if (!res.ok) return [] as Array<{ date: string; clicks: number; impressions: number; ctr?: number; position?: number }>;
  const payload = (await res.json()) as { priorDaily?: Array<{ date: string; clicks: number; impressions: number; ctr?: number; position?: number }> };
  return payload.priorDaily ?? [];
}

export function ProjectSimplifiedTrendSection({
  data,
  propertyId,
}: {
  data: PropertyData;
  propertyId: string;
}) {
  const [compareToPrior, setCompareToPrior] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>("previous_period");
  useSparkSeries();
  const { startDate, endDate } = useDateRange();

  useEffect(() => {
    try {
      setCompareToPrior(localStorage.getItem("consoleview-compare-prior") === "true");
      const stored = localStorage.getItem(compareModeKey(propertyId));
      if (stored === "previous_period" || stored === "previous_year") setCompareMode(stored);
    } catch {
      setCompareToPrior(false);
    }
  }, [propertyId]);

  useEffect(() => {
    try {
      localStorage.setItem(compareModeKey(propertyId), compareMode);
    } catch {}
  }, [compareMode, propertyId]);

  const priorYearStart = useMemo(() => shiftYear(startDate, -1), [startDate]);
  const priorYearEnd = useMemo(() => shiftYear(endDate, -1), [endDate]);

  const { data: priorYearDaily = [] } = useQuery({
    queryKey: ["detailPriorYear", propertyId, startDate, endDate, priorYearStart, priorYearEnd],
    queryFn: () => fetchPriorDaily(propertyId, startDate, endDate, priorYearStart, priorYearEnd),
    enabled: compareToPrior && compareMode === "previous_year",
    placeholderData: (prev) => prev,
  });

  const prior = useMemo(() => {
    if (!compareToPrior) return undefined;
    if (compareMode === "previous_year") return priorYearDaily;
    return data.priorDaily;
  }, [compareMode, compareToPrior, data.priorDaily, priorYearDaily]);

  return (
    <ChartFrame
      title="Performance"
      subtitle="Clicks + impressions"
      actions={
        <div className="flex items-center gap-2">
          <DateRangeSelect variant="compact" align="right" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer min-h-[40px] px-2">
            <input
              type="checkbox"
              checked={compareToPrior}
              onChange={(e) => {
                const v = e.target.checked;
                setCompareToPrior(v);
                try { localStorage.setItem("consoleview-compare-prior", String(v)); } catch {}
              }}
              className="rounded border-border"
            />
            Compare
          </label>
          <select
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value as CompareMode)}
            disabled={!compareToPrior}
            className={
              compareToPrior
                ? "min-h-[40px] rounded-md border border-input bg-background px-2 text-sm text-muted-foreground"
                : "min-h-[40px] rounded-md border border-input bg-background px-2 text-sm text-muted-foreground opacity-50"
            }
            aria-label="Compare period"
          >
            <option value="previous_period">vs previous period</option>
            <option value="previous_year">vs previous year</option>
          </select>
        </div>
      }
      className="w-full"
      bodyClassName="px-4 py-3"
    >
      <TrendChart
        data={data.daily}
        priorData={prior}
        height={CHART_PLOT_H.primary}
        useSeriesContext={true}
        compareToPrior={compareToPrior}
        normalizeWhenMultiSeries={false}
        autoNormalizeMixedScales={false}
      />
    </ChartFrame>
  );
}
