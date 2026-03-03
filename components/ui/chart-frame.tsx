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

export const CHART_CARD_MIN_H = {
  primary: "20rem",
  secondary: "18.5rem",
  spark: "12rem",
} as const;

export const CHART_PLOT_H = {
  primary: 280,
  secondary: 220,
  spark: 96,
} as const;

export const CHART_EMPTY_STATE_MIN_H = {
  primary: 280,
  secondary: 220,
  spark: 96,
} as const;

export const CHART_MARGIN_PRIMARY = {
  top: 8,
  right: 10,
  left: 6,
  bottom: 4,
} as const;

export const CHART_MARGIN_SECONDARY = {
  top: 8,
  right: 10,
  left: 4,
  bottom: 4,
} as const;

export const CHART_MARGIN_SPARK = {
  top: 6,
  right: 6,
  left: 0,
  bottom: 4,
} as const;

export const CHART_Y_AXIS_WIDTH_PRIMARY = 40;
export const CHART_Y_AXIS_WIDTH_SECONDARY = 34;

export const CHART_GRID_PROPS = {
  stroke: "var(--border)",
  strokeDasharray: "3 4",
  strokeOpacity: 0.4,
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

function formatMonthDay(value: string): string {
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getTickStep(totalPoints: number): number {
  if (totalPoints > 180) return 30;
  if (totalPoints > 90) return 14;
  if (totalPoints > 45) return 7;
  if (totalPoints > 21) return 4;
  return 2;
}

export function createDateTickFormatter(totalPoints: number) {
  const step = getTickStep(totalPoints);
  return (value: string, index: number) => (index % step === 0 ? formatMonthDay(value) : "");
}
