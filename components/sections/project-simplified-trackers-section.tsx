import { AiQueriesTrackerCard } from "@/components/ai-queries-tracker-card";
import { TrackedKeywordsMiniCard } from "@/components/tracked-keywords-mini-card";
import type { DataTableRow } from "@/components/data-table";

export function ProjectSimplifiedTrackersSection({
  propertyId,
  queriesRows,
  siteUrl,
}: {
  propertyId: string;
  queriesRows: DataTableRow[];
  siteUrl?: string;
}) {
  const analysisHref = `/sites/${encodeURIComponent(propertyId)}?tab=analysis`;

  return (
    <section aria-label="Trackers" className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
      <AiQueriesTrackerCard queries={queriesRows} siteUrl={siteUrl} className="min-h-[360px]" />
      <TrackedKeywordsMiniCard propertyId={propertyId} viewAllHref={analysisHref} className="min-h-[360px]" />
    </section>
  );
}
