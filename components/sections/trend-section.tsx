"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TrendChart } from "@/components/trend-chart";
import { SparkToggles } from "@/components/spark-toggles";
import { QueryFootprint, type BandFilter } from "@/components/query-footprint";
import { MomentumScoreCard } from "@/components/momentum-score-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { exportToCsv, exportChartToPng, formatExportFilename } from "@/lib/export-csv";
import type { DataTableRow } from "@/components/data-table";
import type { PropertyData, DailyRow } from "@/hooks/use-property-data";
import { CHART_CARD_MIN_H, CHART_PLOT_H } from "@/components/ui/chart-frame";

export function TrendSection({
  data,
  queriesRows,
  dailyForCharts,
  siteSlug,
  startDate,
  endDate,
  bandFilter,
  onBandSelect,
}: {
  data: PropertyData;
  queriesRows: DataTableRow[];
  dailyForCharts: DailyRow[];
  siteSlug: string;
  startDate: string;
  endDate: string;
  bandFilter: BandFilter;
  onBandSelect: (b: BandFilter) => void;
}) {
  const [compareToPrior, setCompareToPriorRaw] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("consoleview-compare-prior") === "true";
  });
  const [showPercentView, setShowPercentViewRaw] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("consoleview-percent-view");
    return v === null ? true : v === "true";
  });
  const setCompareToPrior = useCallback((v: boolean) => {
    setCompareToPriorRaw(v);
    try { localStorage.setItem("consoleview-compare-prior", String(v)); } catch { /* ignore */ }
  }, []);
  const setShowPercentView = useCallback((v: boolean) => {
    setShowPercentViewRaw(v);
    try { localStorage.setItem("consoleview-percent-view", String(v)); } catch { /* ignore */ }
  }, []);

  const trendChartContainerRef = useRef<HTMLDivElement>(null);
  const trendExportMenuRef = useRef<HTMLDivElement>(null);
  const [trendExportMenuOpen, setTrendExportMenuOpen] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (trendExportMenuRef.current && !trendExportMenuRef.current.contains(e.target as Node)) setTrendExportMenuOpen(false);
    };
    if (trendExportMenuOpen) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [trendExportMenuOpen]);

  return (
    <section aria-label="Trend" className="space-y-4">
      <div className="flex flex-col gap-4 min-w-0 lg:flex-row lg:items-stretch">
        <div className="rounded-lg border border-border bg-surface transition-colors duration-[120ms] min-w-0 flex-1 flex flex-col" style={{ minHeight: CHART_CARD_MIN_H.primary }}>
          {data.summary && (
            <MomentumScoreCard
              variant="strip"
              summary={{
                clicksChangePercent: data.summary.clicksChangePercent,
                positionChangePercent: data.summary.positionChangePercent,
                queryCountChangePercent: data.summary.queryCountChangePercent,
              }}
            />
          )}
          <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1">
              Performance over time
              <InfoTooltip title="Clicks and impressions from Google Search Console for the selected date range" />
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative" ref={trendExportMenuRef}>
                <button
                  type="button"
                  onClick={() => setTrendExportMenuOpen((o) => !o)}
                  className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  title="Export"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
                {trendExportMenuOpen && (
                  <div className="absolute right-0 top-full mt-0.5 z-20 min-w-[120px] rounded border border-border bg-surface py-1 shadow-lg">
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      onClick={() => {
                        exportToCsv((data.daily ?? []).map((d) => ({
                          date: d.date,
                          clicks: d.clicks,
                          impressions: d.impressions ?? 0,
                          ctr: d.ctr ?? 0,
                          position: d.position ?? "",
                        })), formatExportFilename(siteSlug, "performance-over-time", startDate, endDate));
                        setTrendExportMenuOpen(false);
                      }}
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      onClick={() => {
                        exportChartToPng(trendChartContainerRef.current, formatExportFilename(siteSlug, "performance-over-time", startDate, endDate));
                        setTrendExportMenuOpen(false);
                      }}
                    >
                      Export PNG
                    </button>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer transition-colors duration-[120ms]">
                <input
                  type="checkbox"
                  checked={compareToPrior}
                  onChange={(e) => setCompareToPrior(e.target.checked)}
                  className="rounded border-border transition-all duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                Compare to previous
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer transition-colors duration-[120ms]">
                <input
                  type="checkbox"
                  checked={showPercentView}
                  onChange={(e) => setShowPercentView(e.target.checked)}
                  className="rounded border-border transition-all duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                View as %
              </label>
              <SparkToggles />
            </div>
          </div>
          <div ref={trendChartContainerRef} className="flex-1 min-h-0 px-4 pb-3 pt-2 flex flex-col">
            {data.daily.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px] text-sm text-muted-foreground">
                No data for this period yet. Data syncs nightly from Search Console.
              </div>
            ) : (
              <TrendChart
                data={data.daily}
                priorData={data.priorDaily}
                height={CHART_PLOT_H.primary}
                showImpressions
                useSeriesContext
                compareToPrior={compareToPrior}
                normalizeWhenMultiSeries={showPercentView}
              />
            )}
          </div>
        </div>
        {queriesRows.length > 0 && (
          <div className="w-full max-w-[320px] lg:w-[320px] lg:min-w-[280px] flex-shrink-0 flex flex-col" style={{ minHeight: CHART_CARD_MIN_H.primary }}>
            <QueryFootprint
              queries={queriesRows}
              daily={dailyForCharts}
              className="flex flex-col min-h-full"
              onBandSelect={onBandSelect}
              selectedBand={bandFilter}
              compareToPrior={compareToPrior}
            />
          </div>
        )}
      </div>
    </section>
  );
}
