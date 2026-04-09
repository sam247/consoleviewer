"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileOverflowMenuProps {
  children: ReactNode;
  buttonLabel?: string;
  buttonIcon?: ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
}

export function MobileOverflowMenu({
  children,
  buttonLabel = "More actions",
  buttonIcon,
  className,
  buttonClassName,
  panelClassName,
}: MobileOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusables?.[0]?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open && wasOpenRef.current) buttonRef.current?.focus();
    wasOpenRef.current = open;
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
        ref={buttonRef}
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
        {buttonIcon ?? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          tabIndex={-1}
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
