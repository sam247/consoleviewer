import type { DataTableRow } from "@/components/data-table";
import { IndexSignalsCard } from "@/components/index-signals-card";
import { CannibalisationCard, type CannibalisationConflict } from "@/components/cannibalisation-card";

export function IndexCannibalisationSection({
  propertyId,
  pagesRows,
  cannibalisationData,
  cannibalisationLoading,
  cannibalisationError,
}: {
  propertyId: string;
  pagesRows: DataTableRow[];
  cannibalisationData: { conflicts: CannibalisationConflict[] } | undefined;
  cannibalisationLoading: boolean;
  cannibalisationError: Error | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-0">
        <IndexSignalsCard propertyId={propertyId} pagesRows={pagesRows} />
      </div>
      <CannibalisationCard
        conflicts={cannibalisationData?.conflicts ?? null}
        isLoading={cannibalisationLoading}
        error={cannibalisationError ?? null}
      />
    </div>
  );
}
