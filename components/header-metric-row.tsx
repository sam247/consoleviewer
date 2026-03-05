import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/info-tooltip";
import type { Summary } from "@/hooks/use-property-data";
import { formatNum } from "@/hooks/use-property-data";

export function HeaderMetricRow({
  summary,
}: {
  summary: Summary | null | undefined;
}) {
  if (!summary) return null;
  const ctr = summary.ctr ?? (summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0);
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Clicks<InfoTooltip title="Total clicks from Google Search Console for the selected date range" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatNum(summary.clicks)}</span>
        {summary.clicksChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.clicksChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.clicksChangePercent >= 0 ? "+" : ""}{summary.clicksChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Impr.<InfoTooltip title="Total impressions in search results" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatNum(summary.impressions)}</span>
        {summary.impressionsChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.impressionsChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.impressionsChangePercent >= 0 ? "+" : ""}{summary.impressionsChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">CTR<InfoTooltip title="Click-through rate (clicks ÷ impressions)" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{ctr.toFixed(2)}%</span>
        {summary.ctrChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.ctrChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.ctrChangePercent >= 0 ? "+" : ""}{summary.ctrChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Avg pos.<InfoTooltip title="Average position across all queries" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {summary.position != null ? summary.position.toFixed(1) : "—"}
        </span>
        {summary.positionChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.positionChangePercent <= 0 ? "text-positive" : "text-negative")}>
            {summary.positionChangePercent >= 0 ? "+" : ""}{summary.positionChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Queries<InfoTooltip title="Number of distinct queries that received clicks or impressions" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {summary.queryCount != null ? formatNum(summary.queryCount) : "—"}
        </span>
        {summary.queryCountChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.queryCountChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.queryCountChangePercent >= 0 ? "+" : ""}{summary.queryCountChangePercent}%
          </span>
        )}
      </div>
    </div>
  );
}
