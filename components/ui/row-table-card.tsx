"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TABLE_CARD_CLASS } from "@/components/ui/table-styles";

interface RowTableCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function RowTableCard({
  title,
  subtitle,
  headerRight,
  className,
  bodyClassName,
  footer,
  children,
}: RowTableCardProps) {
  return (
    <div className={cn(TABLE_CARD_CLASS, "p-0", className)}>
      <div className="flex items-start justify-between border-b border-border px-4 py-2.5 gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle ? <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div> : null}
        </div>
        {headerRight ? <div className="ml-auto shrink-0">{headerRight}</div> : null}
      </div>
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-border px-4 py-2 flex justify-center">{footer}</div> : null}
    </div>
  );
}
