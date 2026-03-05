import { cn } from "@/lib/utils";

export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface animate-pulse", className)}>
      <div className="h-6 w-1/3 rounded bg-muted m-3" />
      <div className="h-4 w-2/3 rounded bg-muted m-3" />
    </div>
  );
}
