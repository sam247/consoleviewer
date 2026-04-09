"use client";

import type { DataTableRow } from "@/components/data-table";
import type { PropertyData } from "@/hooks/use-property-data";
import { OverviewSection } from "@/components/sections/overview-section";
import { SignalStrip } from "@/components/signal-strip";
import { SearchEngineShareCard } from "@/components/search-engine-share-card";
import { QueryFootprint, type BandFilter } from "@/components/query-footprint";
import { VolatilityBrandedSection } from "@/components/sections/volatility-branded-section";
import { OpportunitySection } from "@/components/sections/opportunity-section";
import { IndexCannibalisationSection } from "@/components/sections/index-cannibalisation-section";
import { PerformanceTablesSection } from "@/components/sections/performance-tables-section";
import { AddMetricSection } from "@/components/sections/add-metric-section";
import type { CannibalisationConflict } from "@/components/cannibalisation-card";

export function ProjectAnalysisTab({
  propertyId,
  data,
  queriesRows,
  pagesRows,
  queryCounting,
  endDate,
  startDate,
  siteSlug,
  bandFilter,
  onBandSelect,
  onClearBandFilter,
  querySparklines,
  queryAppearances,
  cannibalisationData,
  cannibalisationLoading,
  cannibalisationError,
}: {
  propertyId: string;
  data: PropertyData;
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  queryCounting: { total: number; top10: number; top3: number };
  endDate: string;
  startDate: string;
  siteSlug: string;
  bandFilter: BandFilter;
  onBandSelect: (b: BandFilter) => void;
  onClearBandFilter: () => void;
  querySparklines?: Record<string, number[]>;
  queryAppearances?: Record<string, string[]>;
  cannibalisationData: { conflicts: CannibalisationConflict[] } | undefined;
  cannibalisationLoading: boolean;
  cannibalisationError: Error | null;
}) {
  return (
    <div className="space-y-8">
      <OverviewSection summary={data.summary} queryCounting={queryCounting} endDate={endDate} />

      {(data.daily?.length > 0 || (data.bingDaily?.length ?? 0) > 0) && (
        <SearchEngineShareCard
          googleClicks={(data.daily ?? []).reduce((s, d) => s + d.clicks, 0)}
          bingClicks={(data.bingDaily ?? []).reduce((s, d) => s + d.clicks, 0)}
          googleImpressions={(data.daily ?? []).reduce((s, d) => s + d.impressions, 0)}
          bingImpressions={(data.bingDaily ?? []).reduce((s, d) => s + d.impressions, 0)}
        />
      )}

      <SignalStrip
        summary={data.summary}
        queriesRows={queriesRows}
        pagesRows={pagesRows}
        newQueries={data.newQueries}
        dateKey={`${startDate}:${endDate}`}
      />

      {queriesRows.length > 0 && (
        <QueryFootprint
          queries={queriesRows}
          onBandSelect={onBandSelect}
          selectedBand={bandFilter}
          compareToPrior={false}
        />
      )}

      {data.daily.length > 0 && (
        <VolatilityBrandedSection data={data} daily={data.daily} propertyId={propertyId} />
      )}

      <OpportunitySection
        queriesRows={queriesRows}
        pagesRows={pagesRows}
        siteSlug={siteSlug}
        siteName={data.siteUrl}
        startDate={startDate}
        endDate={endDate}
        propertyId={propertyId}
        querySparklines={querySparklines}
        newQueriesRows={data.newQueries}
      />

      <IndexCannibalisationSection
        propertyId={propertyId}
        pagesRows={pagesRows}
        cannibalisationData={cannibalisationData}
        cannibalisationLoading={cannibalisationLoading}
        cannibalisationError={cannibalisationError ?? null}
      />

      <PerformanceTablesSection
        data={data}
        queriesRows={queriesRows}
        pagesRows={pagesRows}
        bandFilter={bandFilter}
        onClearBandFilter={onClearBandFilter}
        siteSlug={siteSlug}
        startDate={startDate}
        endDate={endDate}
        propertyId={propertyId}
        querySparklines={querySparklines}
        queryAppearances={queryAppearances}
      />

      <AddMetricSection
        countriesRows={data.countries}
        devicesRows={data.devices}
        siteSlug={siteSlug}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

