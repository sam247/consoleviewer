"use client";

import { useState } from "react";
import type { DataTableRow, TrendFilter } from "@/components/data-table";
import { OpportunityIndex } from "@/components/opportunity-index";
import { OpportunityIntelligence } from "@/components/opportunity-intelligence";
import { MovementIntelligence } from "@/components/movement-intelligence";
import { ShareSeoWinCard } from "@/components/share-seo-win-card";
import { formatExportFilename } from "@/lib/export-csv";

export function OpportunitySection({
  queriesRows,
  pagesRows,
  siteSlug,
  siteName,
  startDate,
  endDate,
  propertyId,
  querySparklines,
  newQueriesRows,
}: {
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  siteSlug: string;
  siteName: string;
  startDate: string;
  endDate: string;
  propertyId?: string;
  querySparklines?: Record<string, number[]>;
  newQueriesRows?: DataTableRow[];
}) {
  const [trendFilter, setTrendFilter] = useState<TrendFilter>("all");

  return (
    <div className="space-y-6">
      <ShareSeoWinCard
        siteName={siteName}
        queriesRows={queriesRows}
        newQueriesRows={newQueriesRows}
        querySparklines={querySparklines}
      />
      {queriesRows.length > 0 && (
        <OpportunityIndex
          queries={queriesRows}
          exportFilename={formatExportFilename(siteSlug, "opportunity-index", startDate, endDate)}
        />
      )}
      {queriesRows.length > 0 && (
        <OpportunityIntelligence queries={queriesRows} />
      )}
      <MovementIntelligence
        queriesRows={queriesRows}
        pagesRows={pagesRows}
        trendFilter={trendFilter}
        onTrendFilterChange={setTrendFilter}
        propertyId={propertyId}
      />
    </div>
  );
}
