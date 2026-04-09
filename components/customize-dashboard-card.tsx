"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type MetricLink = {
  label: string;
  href: string;
  description: string;
};

type MetricGroup = {
  title: string;
  items: MetricLink[];
};

export function CustomizeDashboardCard({
  propertyId,
  className,
}: {
  propertyId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const analysisBase = `/sites/${encodeURIComponent(propertyId)}?tab=analysis`;
  const groups: MetricGroup[] = [
    {
      title: "Analysis",
      items: [
        { label: "Query footprint", href: `${analysisBase}#query-footprint`, description: "Rank distribution + band selection" },
        { label: "Cannibalisation", href: `${analysisBase}#cannibalisation`, description: "Conflicting pages and query overlap" },
        { label: "Branded vs non-branded", href: `${analysisBase}#branded`, description: "Branded split + trend" },
      ],
    },
    {
      title: "Segmentation",
      items: [
        { label: "Countries", href: `${analysisBase}#segments`, description: "Clicks by country" },
        { label: "Devices", href: `${analysisBase}#segments`, description: "Clicks by device" },
        { label: "Content groups", href: `${analysisBase}#content-groups`, description: "Top folders with trend" },
      ],
    },
    {
      title: "Opportunities",
      items: [
        { label: "Momentum signals", href: `${analysisBase}#opportunities`, description: "Fast movers and shifts" },
        { label: "Opportunity signals", href: `${analysisBase}#opportunities`, description: "Targets to improve" },
      ],
    },
  ];

  return (
    <div className={cn("rounded-lg border border-border bg-surface px-5 py-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Customise your dashboard</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Add optional widgets from Analysis when you need them.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-[40px] rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Add metric
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Customise dashboard"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-lg px-4 py-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Add a metric</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Opens the corresponding module in Analysis.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[40px] rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Done
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              {groups.map((g) => (
                <div key={g.title} className="rounded-md border border-border/70 bg-muted/10 p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{g.title}</div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {g.items.map((i) => (
                      <Link
                        key={i.label}
                        href={i.href}
                        onClick={() => setOpen(false)}
                        className="rounded-md border border-border bg-background px-3 py-2 hover:bg-accent"
                      >
                        <div className="text-sm font-medium text-foreground">{i.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{i.description}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

