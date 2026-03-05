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
  startDate,
  endDate,
}: {
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  siteSlug: string;
  startDate: string;
  endDate: string;
}) {
  const [trendFilter, setTrendFilter] = useState<TrendFilter>("all");

  return (
    <div className="space-y-4">
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
      />
    </div>
  );
}
