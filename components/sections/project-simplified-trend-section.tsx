"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendChart } from "@/components/trend-chart";
import type { PropertyData } from "@/hooks/use-property-data";
import { ChartFrame, CHART_PLOT_H } from "@/components/ui/chart-frame";
import { useSparkSeries } from "@/contexts/spark-series-context";

export function ProjectSimplifiedTrendSection({
  data,
  propertyId,
}: {
  data: PropertyData;
  propertyId: string;
}) {
  const [compareToPrior, setCompareToPrior] = useState(false);
  const { series } = useSparkSeries();
  const showClicks = series?.clicks !== false;
  const showImpressions = series?.impressions !== false;

  useEffect(() => {
    try {
      setCompareToPrior(localStorage.getItem("consoleview-compare-prior") === "true");
    } catch {
      setCompareToPrior(false);
    }
  }, [propertyId]);

  const prior = useMemo(() => (compareToPrior ? data.priorDaily : undefined), [compareToPrior, data.priorDaily]);

  return (
    <ChartFrame
      title="Performance"
      subtitle="Clicks + impressions"
      actions={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer min-h-[40px]">
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
        </div>
      }
      className="w-full"
      bodyClassName="px-4 py-3"
    >
      <TrendChart
        data={data.daily}
        priorData={prior}
        height={CHART_PLOT_H.primary}
        showClicks={showClicks}
        showImpressions={showImpressions}
        useSeriesContext={false}
        compareToPrior={compareToPrior}
        normalizeWhenMultiSeries={false}
      />
    </ChartFrame>
  );
}
