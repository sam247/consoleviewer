"use client";

import { useEngineSelectionOptional } from "@/contexts/engine-selection-context";
import type { EngineMode, SearchEngine } from "@/contexts/engine-selection-context";
import { cn } from "@/lib/utils";

const ENGINE_LABELS: Record<SearchEngine, string> = {
  google: "Google",
  bing: "Bing",
};

/** G icon: simple "G" in a circle style */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full bg-[#4285f4] text-[10px] font-bold text-white w-5 h-5", className)}
      aria-hidden
    >
      G
    </span>
  );
}

/** B icon: simple "B" for Bing */
function BingIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded bg-[#008373] text-[10px] font-bold text-white w-5 h-5", className)}
      aria-hidden
    >
      B
    </span>
  );
}

export interface EngineSwitchProps {
  /** When false, Bing option is disabled (e.g. not connected). */
  bingAvailable?: boolean;
  /** When true, show "Both" option for graph. Default false for initial ship. */
  showBothOption?: boolean;
  className?: string;
}

export function EngineSwitch({
  bingAvailable = true,
  showBothOption = false,
  className,
}: EngineSwitchProps) {
  const ctx = useEngineSelectionOptional();
  if (!ctx) return null;

  const { engineMode, setEngineMode } = ctx;

  const setMode = (mode: EngineMode) => {
    if (mode === "bing" && !bingAvailable) return;
    setEngineMode(mode);
  };

  return (
    <div
      className={cn("flex items-center gap-0.5 rounded-md border border-input bg-surface p-0.5", className)}
      role="group"
      aria-label="Search engine"
    >
      <button
        type="button"
        onClick={() => setMode("google")}
        className={cn(
          "flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors h-9",
          engineMode === "google"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        aria-pressed={engineMode === "google"}
        aria-label="Google"
        title="Google Search Console"
      >
        <GoogleIcon />
        <span className="hidden sm:inline">{ENGINE_LABELS.google}</span>
      </button>
      <button
        type="button"
        onClick={() => setMode("bing")}
        disabled={!bingAvailable}
        title={!bingAvailable ? "Bing Webmaster Tools not connected" : "Bing Webmaster Tools"}
        className={cn(
          "flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors h-9",
          engineMode === "bing"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          !bingAvailable && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
        )}
        aria-pressed={engineMode === "bing"}
        aria-label="Bing"
        aria-disabled={!bingAvailable}
      >
        <BingIcon />
        <span className="hidden sm:inline">{ENGINE_LABELS.bing}</span>
      </button>
      {showBothOption && (
        <>
          <span className="w-px h-4 bg-border mx-0.5" aria-hidden />
          <button
            type="button"
            onClick={() => setMode("both")}
            className={cn(
              "rounded px-2 py-1.5 text-xs font-medium transition-colors h-9",
              engineMode === "both"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            aria-pressed={engineMode === "both"}
            aria-label="Both engines on graph"
          >
            Both
          </button>
        </>
      )}
    </div>
  );
}
