"use client";

import { useState } from "react";
import type { DataTableRow, TrendFilter } from "@/components/data-table";
import { OpportunityIndex } from "@/components/opportunity-index";
import { OpportunityIntelligence } from "@/components/opportunity-intelligence";
import { MovementIntelligence } from "@/components/movement-intelligence";
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
      {queriesRows.length > 0 && (
        <OpportunityIndex
          queries={queriesRows}
          className="shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
          exportFilename={formatExportFilename(siteSlug, "opportunity-index", startDate, endDate)}
        />
      )}
      {queriesRows.length > 0 && (
        <OpportunityIntelligence queries={queriesRows} />
      )}
      <MovementIntelligence
        queriesRows={queriesRows}
        pagesRows={pagesRows}
        newQueriesRows={newQueriesRows}
        querySparklines={querySparklines}
        siteName={siteName}
        trendFilter={trendFilter}
        onTrendFilterChange={setTrendFilter}
        propertyId={propertyId}
      />
    </div>
  );
}
