import type { DataTableRow } from "@/components/data-table";
import { ToggleChangeTableCard, type ToggleChangeRow } from "@/components/toggle-change-table-card";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function toSlugLabel(url: string): { label: string; title: string } {
  try {
    const u = url.startsWith("http") ? new URL(url) : null;
    const path = u ? u.pathname : url;
    const cleaned = path.length > 1 ? path.replace(/\/$/, "") : path;
    const label = cleaned === "" ? "/" : cleaned;
    return { label, title: url };
  } catch {
    return { label: url, title: url };
  }
}

function rising(rows: DataTableRow[]) {
  return rows
    .filter((r) => r.changePercent != null && r.changePercent > 0)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
}

function dropping(rows: DataTableRow[]) {
  return rows
    .filter((r) => r.changePercent != null && r.changePercent < 0)
    .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
}

export function ProjectSimplifiedChangeTablesSection({
  propertyId,
  queriesRows,
  pagesRows,
  selectedRange,
  onClearSelectedRange,
}: {
  propertyId: string;
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  selectedRange?: { startDate: string; endDate: string } | null;
  onClearSelectedRange?: () => void;
}) {
  const range = selectedRange ?? null;

  const computePrior = (startDate: string, endDate: string) => {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const len = days + 1;
    const priorEnd = new Date(start);
    priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setUTCDate(priorStart.getUTCDate() - (len - 1));
    return {
      priorStartDate: priorStart.toISOString().slice(0, 10),
      priorEndDate: priorEnd.toISOString().slice(0, 10),
    };
  };

  const queriesOverride = useQuery({
    queryKey: ["changeTable", propertyId, "query", range?.startDate, range?.endDate],
    enabled: Boolean(range),
    queryFn: async () => {
      const w = computePrior(range!.startDate, range!.endDate);
      const params = new URLSearchParams({
        dimension: "query",
        startDate: range!.startDate,
        endDate: range!.endDate,
        priorStartDate: w.priorStartDate,
        priorEndDate: w.priorEndDate,
      });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/change-table?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load queries");
      return (await res.json()) as { rising: { count: number; rows: ToggleChangeRow[] }; dropping: { count: number; rows: ToggleChangeRow[] } };
    },
  });

  const pagesOverride = useQuery({
    queryKey: ["changeTable", propertyId, "page", range?.startDate, range?.endDate],
    enabled: Boolean(range),
    queryFn: async () => {
      const w = computePrior(range!.startDate, range!.endDate);
      const params = new URLSearchParams({
        dimension: "page",
        startDate: range!.startDate,
        endDate: range!.endDate,
        priorStartDate: w.priorStartDate,
        priorEndDate: w.priorEndDate,
      });
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/change-table?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load pages");
      return (await res.json()) as { rising: { count: number; rows: ToggleChangeRow[] }; dropping: { count: number; rows: ToggleChangeRow[] } };
    },
  });

  const risingQueries = rising(queriesRows).map((r) => ({
    key: r.key,
    label: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
    impressionsChangePercent: r.impressionsChangePercent,
    title: r.key,
  }));
  const droppingQueries = dropping(queriesRows).map((r) => ({
    key: r.key,
    label: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
    impressionsChangePercent: r.impressionsChangePercent,
    title: r.key,
  }));
  const risingPages = rising(pagesRows).map((r) => {
    const s = toSlugLabel(r.key);
    return {
      key: r.key,
      label: s.label,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: r.changePercent,
      impressionsChangePercent: r.impressionsChangePercent,
      title: s.title,
      url: r.key,
    };
  });
  const droppingPages = dropping(pagesRows).map((r) => {
    const s = toSlugLabel(r.key);
    return {
      key: r.key,
      label: s.label,
      clicks: r.clicks,
      impressions: r.impressions,
      changePercent: r.changePercent,
      impressionsChangePercent: r.impressionsChangePercent,
      title: s.title,
      url: r.key,
    };
  });

  const queriesRisingFinal = range ? (queriesOverride.data?.rising.rows ?? []) : risingQueries;
  const queriesDroppingFinal = range ? (queriesOverride.data?.dropping.rows ?? []) : droppingQueries;
  const pagesRisingFinal = range ? (pagesOverride.data?.rising.rows ?? []) : risingPages;
  const pagesDroppingFinal = range ? (pagesOverride.data?.dropping.rows ?? []) : droppingPages;

  return (
    <section aria-label="Changes" className="space-y-6">
      {range ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs">
          <div className="min-w-0 truncate text-muted-foreground">Filtered by graph: {range.startDate} to {range.endDate}</div>
          <button type="button" onClick={onClearSelectedRange} className="shrink-0 text-muted-foreground hover:text-foreground underline">
            Reset
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <ToggleChangeTableCard
          propertyId={propertyId}
          title="Queries"
          scope="queries"
          risingRows={queriesRisingFinal}
          droppingRows={queriesDroppingFinal}
          maxRows={10}
          className={cn(range && queriesOverride.isLoading ? "opacity-70" : "")}
        />
        <ToggleChangeTableCard
          propertyId={propertyId}
          title="Pages"
          scope="pages"
          risingRows={pagesRisingFinal}
          droppingRows={pagesDroppingFinal}
          maxRows={10}
          className={cn(range && pagesOverride.isLoading ? "opacity-70" : "")}
        />
      </div>
    </section>
  );
}
