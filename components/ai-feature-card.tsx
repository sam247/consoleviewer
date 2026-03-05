"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function AiHeaderButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border border-border",
          "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        )}
        aria-label="AI Insights — coming soon"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-float"
          aria-hidden
        >
          <rect x="8" y="12" width="24" height="18" rx="4" className="stroke-current" strokeWidth="2.5" />
          <rect x="14" y="18" width="4" height="4" rx="1" className="fill-current opacity-60" />
          <rect x="22" y="18" width="4" height="4" rx="1" className="fill-current opacity-60" />
          <path d="M16 26h8" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="6" x2="20" y2="12" className="stroke-current" strokeWidth="2.5" />
          <circle cx="20" cy="5" r="2" className="fill-current opacity-60" />
          <line x1="4" y1="20" x2="8" y2="20" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="32" y1="20" x2="36" y2="20" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
      {hovered && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-48 rounded-md border border-border bg-background px-3 py-2 shadow-md pointer-events-none">
          <p className="text-xs font-medium text-foreground">AI Insights</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Powered by AI — coming soon</p>
        </div>
      )}
    </div>
  );
}
