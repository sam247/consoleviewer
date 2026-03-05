import { HeaderMetricRow } from "@/components/header-metric-row";
import type { Summary } from "@/hooks/use-property-data";

export function OverviewSection({
  summary,
  queryCounting,
}: {
  summary: Summary | null;
  queryCounting: { total: number; top10: number; top3: number };
}) {
  return (
    <section aria-label="Overview" className="border-b border-border pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <HeaderMetricRow summary={summary} />
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Queries in band</div>
            <div className="text-sm font-semibold tabular-nums text-foreground mt-0.5">
              Top 10: {queryCounting.top10} · Top 3: {queryCounting.top3}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
