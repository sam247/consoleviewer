"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface RankPopoverKeyword {
  keyword: string;
  position: number;
  delta1d: number;
  delta7d: number;
}

interface RankPopoverProps {
  keywords: RankPopoverKeyword[];
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}

export function RankPopover({ keywords, anchorRef, open, onClose }: RankPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverHeight = 180;
    const gap = 4;
    setPosition({
      top: rect.top - popoverHeight - gap,
      left: rect.left,
    });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      const target = e.target as Node;
      if (
        anchor?.contains(target) ||
        popover?.contains(target)
      ) return;
      onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose, anchorRef]);

  if (!open || keywords.length === 0) return null;

  const content = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Top tracked keywords"
      className={cn(
        "fixed z-30 min-w-[240px] max-w-[320px] rounded-md border border-border bg-surface px-3 py-2 shadow-md",
        "transition-opacity duration-150",
        position ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={
        position
          ? { top: position.top, left: position.left }
          : undefined
      }
    >
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        Top tracked keywords
      </div>
      <div className="text-xs">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-1 pr-2 font-medium text-muted-foreground truncate">Keyword</th>
              <th className="text-right py-1 w-12 font-medium text-muted-foreground">Pos</th>
              <th className="text-right py-1 w-10 font-medium text-muted-foreground">1D</th>
              <th className="text-right py-1 w-10 font-medium text-muted-foreground">7D</th>
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 5).map((row, i) => (
              <tr key={`${row.keyword}-${i}`} className="border-b border-border/40 last:border-b-0">
                <td className="py-1 pr-2 truncate text-foreground" title={row.keyword}>
                  {row.keyword}
                </td>
                <td className="py-1 text-right tabular-nums text-foreground w-12">
                  {row.position.toFixed(1)}
                </td>
                <td className="py-1 text-right tabular-nums w-10">
                  <span className={row.delta1d < 0 ? "text-positive" : row.delta1d > 0 ? "text-negative" : "text-muted-foreground"}>
                    {row.delta1d > 0 ? "+" : ""}{row.delta1d}
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums w-10">
                  <span className={row.delta7d < 0 ? "text-positive" : row.delta7d > 0 ? "text-negative" : "text-muted-foreground"}>
                    {row.delta7d > 0 ? "+" : ""}{row.delta7d}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
