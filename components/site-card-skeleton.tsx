export function SiteCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-background p-4 animate-pulse">
      <div className="mb-2 h-5 w-3/4 rounded bg-muted" />
      <div className="flex gap-3">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="mt-3 h-12 w-full rounded bg-muted" />
    </div>
  );
}
