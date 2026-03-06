"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrendChart } from "@/components/trend-chart";
import { EngineSelector } from "@/components/engine-selector";
import { QueryFootprint, type BandFilter } from "@/components/query-footprint";
import { MomentumScoreCard } from "@/components/momentum-score-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { exportToCsv, exportChartToPng, formatExportFilename } from "@/lib/export-csv";
import type { DataTableRow } from "@/components/data-table";
import type { PropertyData, DailyRow } from "@/hooks/use-property-data";
import { useDateRange } from "@/contexts/date-range-context";
import { useEngineSelection } from "@/contexts/engine-selection-context";
import { useSparkSeries } from "@/contexts/spark-series-context";
import type { DateRangeKey } from "@/types/gsc";
import type { SearchEngine } from "@/contexts/engine-selection-context";
import { CHART_CARD_MIN_H, CHART_PLOT_H } from "@/components/ui/chart-frame";
import { applySeriesBudget } from "@/lib/analysis-series-budget";

export function TrendSection({
  data,
  queriesRows,
  dailyForCharts,
  siteSlug,
  startDate,
  endDate,
  bandFilter,
  onBandSelect,
  chartAnnotations = [],
  onAddAnnotation,
  propertyId,
}: {
  data: PropertyData;
  queriesRows: DataTableRow[];
  dailyForCharts: DailyRow[];
  siteSlug: string;
  startDate: string;
  endDate: string;
  bandFilter: BandFilter;
  onBandSelect: (b: BandFilter) => void;
  chartAnnotations?: { id: string; date: string; label: string; color: string }[];
  onAddAnnotation?: () => void;
  propertyId?: string;
}) {
  const { rangeKey, setRangeKey } = useDateRange();
  const quickRanges: { key: DateRangeKey; label: string }[] = [
    { key: "30d", label: "30d" },
    { key: "l90d", label: "90d" },
    { key: "6m", label: "6m" },
    { key: "12m", label: "12m" },
  ];
  const [addAnnotationOpen, setAddAnnotationOpen] = useState(false);
  const [newAnnotationDate, setNewAnnotationDate] = useState("");
  const [newAnnotationLabel, setNewAnnotationLabel] = useState("");
  const [addAnnotationSubmitting, setAddAnnotationSubmitting] = useState(false);
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
  const [budgetMessage, setBudgetMessage] = useState<string | null>(null);

  const availableEngines = useMemo((): SearchEngine[] => {
    if (!data.engineAvailability?.bingConnected) return ["google"];
    return ["google", "bing"];
  }, [data.engineAvailability?.bingConnected]);
  const disabledEngines = useMemo((): SearchEngine[] => {
    if (!data.engineAvailability?.bingConnected) return [];
    return data.engineAvailability?.bingAnalyticsReady ? [] : ["bing"];
  }, [data.engineAvailability?.bingAnalyticsReady, data.engineAvailability?.bingConnected]);
  const disabledReasonByEngine = useMemo(
    () => ({
      bing: "Bing connected. Analytics data not available yet.",
    }),
    []
  );

  const { selectedEngines, setSelectedEngines } = useEngineSelection();
  const { series, setSeries } = useSparkSeries();
  const selectedMetrics = useMemo(
    () =>
      (Object.entries(series)
        .filter(([, enabled]) => enabled)
        .map(([k]) => k) as ("clicks" | "impressions" | "ctr" | "position")[]),
    [series]
  );
  const effectiveSelectedEngines = useMemo((): SearchEngine[] => {
    const allowed = selectedEngines.filter((e) => availableEngines.includes(e) && !disabledEngines.includes(e));
    return allowed.length > 0 ? allowed : (["google"] as SearchEngine[]);
  }, [availableEngines, selectedEngines, disabledEngines]);

  const budget = useMemo(
    () =>
      applySeriesBudget({
        selectedSources: effectiveSelectedEngines,
        selectedMetrics,
        currentSeriesState: series,
      }),
    [effectiveSelectedEngines, selectedMetrics, series]
  );

  useEffect(() => {
    if (effectiveSelectedEngines.join("|") !== selectedEngines.join("|")) {
      setSelectedEngines(effectiveSelectedEngines);
    }
  }, [effectiveSelectedEngines, selectedEngines, setSelectedEngines]);

  useEffect(() => {
    const current = JSON.stringify(series);
    const next = JSON.stringify(budget.nextSeriesState);
    if (budget.wasAutoTrimmed && current !== next) {
      setSeries(budget.nextSeriesState);
      setBudgetMessage(budget.helperMessage);
      return;
    }
    if (!budget.wasAutoTrimmed) setBudgetMessage(null);
  }, [budget.helperMessage, budget.nextSeriesState, budget.wasAutoTrimmed, series, setSeries]);

  const enginesLabel = useMemo(() => {
    if (effectiveSelectedEngines.length === 0) return "Source: Google";
    if (effectiveSelectedEngines.length === 2) return "Source: Google + Bing";
    return effectiveSelectedEngines[0] === "google" ? "Source: Google" : "Source: Bing";
  }, [effectiveSelectedEngines]);

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
    <section aria-label="Trend" className="space-y-6">
      <div className="flex flex-col gap-6 min-w-0 lg:flex-row lg:items-stretch">
        <div className="performance-chart-card rounded-lg border border-border bg-surface transition-colors duration-[120ms] min-w-0 flex-1 flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.05)]" style={{ minHeight: CHART_CARD_MIN_H.primary }}>
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
              <InfoTooltip title="Search performance by selected source and metric for the current date range" />
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
              <EngineSelector
                selectedEngines={effectiveSelectedEngines}
                availableEngines={availableEngines}
                disabledEngines={disabledEngines}
                disabledReasonByEngine={disabledReasonByEngine}
                onChange={setSelectedEngines}
                label="Search engine:"
              />
              <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
                {quickRanges.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRangeKey(r.key)}
                    className={
                      rangeKey === r.key
                        ? "rounded px-2 py-1 text-xs font-medium bg-background text-foreground border border-input"
                        : "rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {propertyId && onAddAnnotation && (
                <button
                  type="button"
                  onClick={() => {
                    setNewAnnotationDate(startDate);
                    setNewAnnotationLabel("");
                    setAddAnnotationOpen(true);
                  }}
                  className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  title="Add annotation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
            </div>
          </div>
          {addAnnotationOpen && propertyId && onAddAnnotation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setAddAnnotationOpen(false)}>
              <div className="w-full max-w-sm rounded-lg border border-border bg-surface shadow-lg px-4 py-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-foreground">Add chart annotation</h3>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={newAnnotationDate}
                    onChange={(e) => setNewAnnotationDate(e.target.value)}
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  />
                  <label className="block text-xs font-medium text-muted-foreground">Label</label>
                  <input
                    type="text"
                    value={newAnnotationLabel}
                    onChange={(e) => setNewAnnotationLabel(e.target.value)}
                    placeholder="e.g. Algorithm update"
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAddAnnotationOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">Cancel</button>
                  <button
                    type="button"
                    disabled={!newAnnotationDate || !newAnnotationLabel.trim() || addAnnotationSubmitting}
                    onClick={async () => {
                      setAddAnnotationSubmitting(true);
                      try {
                        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/annotations`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ date: newAnnotationDate, label: newAnnotationLabel.trim() }),
                        });
                        if (res.ok) {
                          onAddAnnotation();
                          setAddAnnotationOpen(false);
                        }
                      } finally {
                        setAddAnnotationSubmitting(false);
                      }
                    }}
                    className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={trendChartContainerRef} className="flex-1 min-h-0 px-4 pb-3 pt-2 flex flex-col">
            {budgetMessage && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{budgetMessage}</p>
            )}
            {data.daily.length === 0 && (!data.bingDaily || data.bingDaily.length === 0) ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px] text-sm text-muted-foreground">
                No data for this period yet. Data syncs nightly from Search Console.
              </div>
            ) : (
              <>
                <TrendChart
                  data={data.daily}
                  analyticsSeries={data.series}
                  dataByEngine={
                    data.bingDaily && data.bingDaily.length > 0
                      ? { google: data.daily, bing: data.bingDaily }
                      : undefined
                  }
                  selectedEngines={budget.effectiveSources}
                  priorData={data.priorDaily}
                  height={CHART_PLOT_H.primary}
                  showImpressions
                  useSeriesContext
                  compareToPrior={compareToPrior}
                  normalizeWhenMultiSeries={showPercentView}
                  annotations={chartAnnotations}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">{enginesLabel}</p>
              </>
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
