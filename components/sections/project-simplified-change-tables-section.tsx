import type { DataTableRow } from "@/components/data-table";
import { ToggleChangeTableCard } from "@/components/toggle-change-table-card";

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
}: {
  propertyId: string;
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
}) {
  const analysisHref = `/sites/${encodeURIComponent(propertyId)}?tab=analysis`;

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

  return (
    <section aria-label="Changes" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <ToggleChangeTableCard
          propertyId={propertyId}
          title="Queries"
          scope="queries"
          risingRows={risingQueries}
          droppingRows={droppingQueries}
          viewMoreHref={analysisHref}
          maxRows={8}
        />
        <ToggleChangeTableCard
          propertyId={propertyId}
          title="Pages"
          scope="pages"
          risingRows={risingPages}
          droppingRows={droppingPages}
          viewMoreHref={analysisHref}
          maxRows={8}
        />
      </div>
    </section>
  );
}
