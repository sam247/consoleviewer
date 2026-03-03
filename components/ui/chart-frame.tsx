"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function ChartFrame({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  children,
}: ChartFrameProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div className="border-b border-border px-4 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("px-4 py-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export const CHART_GRID_PROPS = {
  stroke: "var(--border)",
  strokeDasharray: "2 3",
  strokeOpacity: 0.5,
  vertical: false,
} as const;

export const CHART_AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 10,
} as const;

export const CHART_TOOLTIP_STYLE = {
  fontSize: 11,
  padding: "6px 10px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
} as const;
