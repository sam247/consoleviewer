"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

const HOVER_DELAY_MS = 1000;

interface InfoTooltipProps {
  title: string;
  className?: string;
  "aria-label"?: string;
}

export function InfoTooltip({ title, className, "aria-label": ariaLabel = "Help" }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), HOVER_DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <span
      className={cn("relative inline-flex cursor-help", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-label={ariaLabel}
      role="img"
    >
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-muted-foreground text-[10px] font-medium opacity-70"
        aria-hidden
      >
        i
      </span>
      {visible && (
        <span
          className="absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface px-2 py-1 text-[11px] text-foreground shadow-lg"
          role="tooltip"
        >
          {title}
        </span>
      )}
    </span>
  );
}
