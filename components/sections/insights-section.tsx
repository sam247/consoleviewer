import { AiQuerySignalsCard } from "@/components/ai-query-signals-card";
import { TrackedKeywordsSection } from "@/components/tracked-keywords-section";
import { AiFeatureCard } from "@/components/ai-feature-card";
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch min-w-0">
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
      <AiFeatureCard />
    </div>
  );
}
