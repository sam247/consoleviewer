import type { DataTableRow } from "@/components/data-table";
import { ChangeTableCard } from "@/components/change-table-card";

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

  const risingQueries = rising(queriesRows).map((r) => ({ label: r.key, clicks: r.clicks, changePercent: r.changePercent, title: r.key }));
  const droppingQueries = dropping(queriesRows).map((r) => ({ label: r.key, clicks: r.clicks, changePercent: r.changePercent, title: r.key }));
  const risingPages = rising(pagesRows).map((r) => {
    const s = toSlugLabel(r.key);
    return { label: s.label, clicks: r.clicks, changePercent: r.changePercent, title: s.title };
  });
  const droppingPages = dropping(pagesRows).map((r) => {
    const s = toSlugLabel(r.key);
    return { label: s.label, clicks: r.clicks, changePercent: r.changePercent, title: s.title };
  });

  return (
    <section aria-label="Changes" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <ChangeTableCard title="Rising queries" variant="rising" rows={risingQueries} viewMoreHref={analysisHref} />
        <ChangeTableCard title="Dropping queries" variant="dropping" rows={droppingQueries} viewMoreHref={analysisHref} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <ChangeTableCard title="Rising pages" variant="rising" rows={risingPages} viewMoreHref={analysisHref} />
        <ChangeTableCard title="Dropping pages" variant="dropping" rows={droppingPages} viewMoreHref={analysisHref} />
      </div>
    </section>
  );
}

