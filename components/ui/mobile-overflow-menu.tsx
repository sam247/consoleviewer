"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileOverflowMenuProps {
  children: ReactNode;
  buttonLabel?: string;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
}

export function MobileOverflowMenu({
  children,
  buttonLabel = "More actions",
  className,
  buttonClassName,
  panelClassName,
}: MobileOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-menu-close='true']")) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          buttonClassName
        )}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-30 mt-1 min-w-[220px] max-w-[80vw] rounded-md border border-border bg-surface p-2 shadow-lg",
            panelClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

