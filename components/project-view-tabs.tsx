"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type ProjectViewTab = "overview" | "analysis";

export function ProjectViewTabs({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") as ProjectViewTab | null) ?? "overview";

  const tabs = useMemo(
    () =>
      [
        { key: "overview" as const, label: "Overview" },
        { key: "analysis" as const, label: "Analysis" },
      ] as const,
    []
  );

  return (
    <div className={cn("inline-flex rounded-md border border-border bg-background p-0.5", className)} role="tablist" aria-label="Project view tabs">
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              if (t.key === "overview") next.delete("tab");
              else next.set("tab", t.key);
              const qs = next.toString();
              router.replace(qs ? `${pathname}?${qs}` : pathname);
            }}
            className={cn(
              "min-h-[40px] px-3 text-sm font-medium rounded",
              active
                ? "bg-surface text-foreground border border-border shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

