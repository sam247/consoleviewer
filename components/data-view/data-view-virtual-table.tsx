"use client";

import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { DataViewDimension, DataViewRow } from "@/hooks/use-data-view";
import { useVirtualWindow } from "@/hooks/use-virtual-window";
import { formatCompact, formatCtr, formatPos, formatSignedInt } from "@/lib/data-view-utils";

export function DataViewVirtualTable({
  dimension,
  rows,
  hasPrior,
  isLoadingMore,
}: {
  dimension: DataViewDimension;
  rows: DataViewRow[];
  hasPrior: boolean;
  isLoadingMore: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const virtual = useVirtualWindow({ containerRef: bodyRef, itemCount: rows.length, rowHeight: 44, overscan: 10 });
  const visible = useMemo(() => rows.slice(virtual.from, virtual.to), [rows, virtual.from, virtual.to]);

  const headerCell = "px-3 py-2 text-[11px] font-semibold text-muted-foreground";
  const rowCell = "px-3 py-2 text-xs";

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div className="border-b border-border bg-muted/10">
        <div className="grid grid-cols-12 gap-0">
          <div className={cn(headerCell, "col-span-5")}>{dimension === "page" ? "Page" : "Query"}</div>
          <div className={cn(headerCell, "col-span-2 text-right")}>Clicks</div>
          <div className={cn(headerCell, "col-span-2 text-right")}>Impr.</div>
          <div className={cn(headerCell, "col-span-1 text-right")}>CTR</div>
          <div className={cn(headerCell, "col-span-1 text-right")}>Pos</div>
          <div className={cn(headerCell, "col-span-1 text-right")}>Change</div>
        </div>
      </div>

      <div ref={bodyRef} className="h-full overflow-auto">
        <div style={{ height: virtual.padTop }} />

        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">No rows match these filters.</div>
        ) : (
          visible.map((row) => {
            const pos = row.position;
            const prevPos = row.position_prev;
            const hasPosPair = pos != null && prevPos != null && Number.isFinite(pos) && Number.isFinite(prevPos);
            const posChange = hasPosPair ? `${prevPos.toFixed(1)}→${pos.toFixed(1)}` : null;
            const clickDelta = hasPrior && row.clicks_change != null ? `${formatSignedInt(row.clicks_change)} clicks` : null;

            return (
              <div
                key={row.key}
                className="grid grid-cols-12 items-center border-b border-border/60 hover:bg-accent/30"
                style={{ height: 44 }}
              >
                <div className={cn(rowCell, "col-span-5 truncate min-w-0 font-medium text-foreground")} title={row.key}>
                  {row.key}
                </div>
                <div className={cn(rowCell, "col-span-2 text-right tabular-nums text-foreground")}>{formatCompact(row.clicks)}</div>
                <div className={cn(rowCell, "col-span-2 text-right tabular-nums text-muted-foreground")}>{formatCompact(row.impressions)}</div>
                <div className={cn(rowCell, "col-span-1 text-right tabular-nums text-muted-foreground")}>{formatCtr(row.ctr)}</div>
                <div className={cn(rowCell, "col-span-1 text-right tabular-nums text-muted-foreground")}>{formatPos(pos)}</div>
                <div className={cn(rowCell, "col-span-1 text-right tabular-nums")}>
                  {hasPrior && (clickDelta || posChange) ? (
                    <span className="text-[11px] text-muted-foreground">
                      {clickDelta ?? ""}
                      {clickDelta && posChange ? " · " : ""}
                      {posChange ? `pos ${posChange}` : ""}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div style={{ height: virtual.padBottom }} />

        {isLoadingMore ? <div className="px-4 py-3 text-xs text-muted-foreground">Loading more…</div> : null}
      </div>
    </div>
  );
}

