export function SiteCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 animate-pulse">
      <div className="mb-4 h-4 w-3/4 rounded bg-muted" />
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="h-8 w-16 rounded bg-muted" />
        <div className="h-4 w-10 rounded bg-muted" />
      </div>
      <div className="mb-3 h-3 w-12 rounded bg-muted" />
      <div className="flex items-baseline justify-between gap-2">
        <div className="h-4 w-14 rounded bg-muted" />
        <div className="h-3 w-8 rounded bg-muted" />
      </div>
      <div className="mb-4 h-3 w-20 rounded bg-muted" />
      <div className="h-14 w-full rounded bg-muted" />
    </div>
  );
}
