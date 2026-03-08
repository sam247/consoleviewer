import { AiQuerySignalsCard } from "@/components/ai-query-signals-card";
import { TrackedKeywordsSection } from "@/components/tracked-keywords-section";
import type { DataTableRow } from "@/components/data-table";
import type { DailyRow } from "@/hooks/use-property-data";
import { formatExportFilename } from "@/lib/export-csv";

export function InsightsSection({
  queriesRows,
  daily,
  propertyId,
  siteSlug,
  startDate,
  endDate,
}: {
  queriesRows: DataTableRow[];
  daily: DailyRow[];
  propertyId: string;
  siteSlug: string;
  startDate: string;
  endDate: string;
}) {
  return (
    <section aria-label="Insights">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Insights</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch min-w-0">
        {queriesRows.length > 0 && (
          <AiQuerySignalsCard queries={queriesRows} daily={daily} />
        )}
        <div className="min-w-0">
          <TrackedKeywordsSection
            propertyId={propertyId}
            exportFilename={formatExportFilename(siteSlug, "keywords-tracked", startDate, endDate)}
          />
        </div>
      </div>
    </section>
  );
}
