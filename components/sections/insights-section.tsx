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
  effectiveEngine,
}: {
  queriesRows: DataTableRow[];
  daily: DailyRow[];
  propertyId: string;
  siteSlug: string;
  startDate: string;
  endDate: string;
  effectiveEngine?: "google" | "bing";
}) {
  return (
    <section aria-label="Insights" className="rounded-lg border border-border bg-surface p-4 md:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <h2 className="text-sm font-semibold text-foreground mb-4">Insights</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch min-w-0">
      {queriesRows.length > 0 && (
        <AiQuerySignalsCard queries={queriesRows} daily={daily} sourceEngine={effectiveEngine} />
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
