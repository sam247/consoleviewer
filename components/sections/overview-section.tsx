import { HeaderMetricRow } from "@/components/header-metric-row";
import { InfoTooltip } from "@/components/info-tooltip";
import type { Summary } from "@/hooks/use-property-data";

export function OverviewSection({
  summary,
  queryCounting,
  endDate,
}: {
  summary: Summary | null;
  queryCounting: { total: number; top10: number; top3: number };
  endDate?: string;
}) {
  return (
    <section aria-label="Overview" className="border-b border-border pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <HeaderMetricRow summary={summary} />
          {endDate && (
            <p className="text-[11px] text-muted-foreground mt-1.5">Data as of {endDate}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1 justify-end">
              Ranking distribution
              <InfoTooltip title="How many of your queries rank in the Top 3 and Top 10 positions" />
            </div>
            <div className="text-sm font-semibold tabular-nums text-foreground mt-0.5">
              Top 10: {queryCounting.top10} · Top 3: {queryCounting.top3}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
