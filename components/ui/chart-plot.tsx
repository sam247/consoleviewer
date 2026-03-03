"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartPlotProps {
  height: number;
  minHeight?: number;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  children?: ReactNode;
}

export function ChartPlot({
  height,
  minHeight,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No data in range.",
  className,
  children,
}: ChartPlotProps) {
  const resolvedMinHeight = minHeight ?? height;

  return (
    <div
      className={cn("w-full min-w-0", className)}
      style={{ height, minHeight: resolvedMinHeight }}
    >
      {isLoading ? (
        <div className="h-full w-full animate-pulse rounded-md border border-border/60 bg-muted/35" />
      ) : isEmpty ? (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/20 px-3 text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
