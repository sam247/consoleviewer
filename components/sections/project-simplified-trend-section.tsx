"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendChart } from "@/components/trend-chart";
import type { PropertyData } from "@/hooks/use-property-data";
import { ChartFrame, CHART_PLOT_H } from "@/components/ui/chart-frame";
import { DateRangeSelect } from "@/components/date-range-select";

function metricsKey(propertyId: string) {
  return `consoleview_project_graph_metrics_${propertyId}`;
}

export function ProjectSimplifiedTrendSection({
  data,
  propertyId,
}: {
  data: PropertyData;
  propertyId: string;
}) {
  const [compareToPrior, setCompareToPrior] = useState(false);
  const [showClicks, setShowClicks] = useState(true);
  const [showImpressions, setShowImpressions] = useState(true);

  useEffect(() => {
    try {
      setCompareToPrior(localStorage.getItem("consoleview-compare-prior") === "true");
      const raw = localStorage.getItem(metricsKey(propertyId));
      if (raw) {
        const parsed = JSON.parse(raw) as { clicks?: boolean; impressions?: boolean };
        if (typeof parsed.clicks === "boolean") setShowClicks(parsed.clicks);
        if (typeof parsed.impressions === "boolean") setShowImpressions(parsed.impressions);
      }
    } catch {
      setCompareToPrior(false);
    }
  }, [propertyId]);

  useEffect(() => {
    try {
      localStorage.setItem(metricsKey(propertyId), JSON.stringify({ clicks: showClicks, impressions: showImpressions }));
    } catch {}
  }, [propertyId, showClicks, showImpressions]);

  const prior = useMemo(() => (compareToPrior ? data.priorDaily : undefined), [compareToPrior, data.priorDaily]);

  return (
    <ChartFrame
      title="Performance"
      subtitle="Clicks + impressions"
      actions={
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <DateRangeSelect />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
            <button
              type="button"
              onClick={() => setShowClicks((v) => !v)}
              className={showClicks
                ? "rounded px-2 py-1 text-xs font-medium bg-surface text-foreground border border-border"
                : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}
              aria-pressed={showClicks}
            >
              Clicks
            </button>
            <button
              type="button"
              onClick={() => setShowImpressions((v) => !v)}
              className={showImpressions
                ? "rounded px-2 py-1 text-xs font-medium bg-surface text-foreground border border-border"
                : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}
              aria-pressed={showImpressions}
            >
              Impr.
            </button>
          </div>
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
