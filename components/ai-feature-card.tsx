"use client";

export function AiFeatureCard({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-border bg-muted/30 px-5 py-5 flex items-center gap-4 transition-colors hover:border-foreground/20 ${className ?? ""}`}
    >
      <div className="shrink-0 animate-float">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-muted-foreground"
          aria-hidden
        >
          <rect x="8" y="12" width="24" height="18" rx="4" className="stroke-current" strokeWidth="2" />
          <rect x="14" y="18" width="4" height="4" rx="1" className="fill-current opacity-60" />
          <rect x="22" y="18" width="4" height="4" rx="1" className="fill-current opacity-60" />
          <path d="M16 26h8" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="6" x2="20" y2="12" className="stroke-current" strokeWidth="2" />
          <circle cx="20" cy="5" r="2" className="fill-current opacity-60" />
          <line x1="4" y1="20" x2="8" y2="20" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="20" x2="36" y2="20" className="stroke-current" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Powered by AI — intelligent analysis coming soon
        </p>
      </div>
    </div>
  );
}
