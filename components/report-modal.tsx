"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ReportModal({
  open,
  onClose,
  title,
  subtitle,
  search,
  actions,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  search?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-5xl max-h-[85vh] rounded-lg border border-border bg-surface shadow-lg flex flex-col overflow-hidden",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{title}</div>
            {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-muted-foreground hover:bg-accent transition-colors duration-[120ms]"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {search ? <div className="border-b border-border px-4 py-3 shrink-0">{search}</div> : null}
        <div className="overflow-auto min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

