"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DashboardCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}

export function DashboardCard({
  title,
  subtitle,
  action,
  footer,
  children,
  className,
  contentClassName,
  headerClassName,
}: DashboardCardProps) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-2 border-b border-border px-5 py-4 flex-wrap",
          headerClassName
        )}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        {action ? <div className="ml-auto min-w-0">{action}</div> : null}
      </div>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
      {footer ? <div className="border-t border-border px-5 py-2.5 flex justify-center">{footer}</div> : null}
    </section>
  );
}
