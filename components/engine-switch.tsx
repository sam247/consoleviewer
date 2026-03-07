"use client";

import { useEngineSelectionOptional } from "@/contexts/engine-selection-context";
import type { EngineMode, SearchEngine } from "@/contexts/engine-selection-context";
import { cn } from "@/lib/utils";

const ENGINE_LABELS: Record<SearchEngine, string> = {
  google: "Google",
  bing: "Bing",
};

const headerButtonBase =
  "flex h-9 items-center gap-1.5 rounded-md border border-border px-3 py-0 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      width={18}
      height={18}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M 25.996094 48 C 13.3125 48 2.992188 37.683594 2.992188 25 C 2.992188 12.316406 13.3125 2 25.996094 2 C 31.742188 2 37.242188 4.128906 41.488281 7.996094 L 42.261719 8.703125 L 34.675781 16.289063 L 33.972656 15.6875 C 31.746094 13.78125 28.914063 12.730469 25.996094 12.730469 C 19.230469 12.730469 13.722656 18.234375 13.722656 25 C 13.722656 31.765625 19.230469 37.269531 25.996094 37.269531 C 30.875 37.269531 34.730469 34.777344 36.546875 30.53125 L 24.996094 30.53125 L 24.996094 20.175781 L 47.546875 20.207031 L 47.714844 21 C 48.890625 26.582031 47.949219 34.792969 43.183594 40.667969 C 39.238281 45.53125 33.457031 48 25.996094 48 Z"
      />
    </svg>
  );
}

function BingIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      width={18}
      height={18}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M 45 26.101563 L 45 21 C 45 20.101563 44.398438 19.300781 43.601563 19.101563 L 39 17.699219 C 33.699219 16.101563 28.699219 14.699219 23.398438 13 C 23.398438 13 23.300781 13 23.300781 13 C 22.5 12.800781 21.699219 13.699219 22.101563 14.5 C 24 18.398438 26 24 26 24 L 32.699219 26.601563 C 32.398438 26.601563 11 38 11 38 L 20 30 L 20 7 C 20 6.101563 19.398438 5.199219 18.601563 5 C 18.601563 5 13.699219 3.101563 10.601563 2.101563 C 10.398438 2 10.199219 2 10 2 C 9.601563 2 9.199219 2.101563 8.800781 2.398438 C 8.300781 2.800781 8 3.398438 8 4 L 8 38.699219 C 8 39.398438 8.300781 40 8.898438 40.300781 C 11 41.800781 13.199219 43.300781 15.300781 44.800781 L 18.300781 46.898438 C 18.601563 47.101563 19 47.300781 19.398438 47.300781 C 19.800781 47.300781 20.101563 47.199219 20.398438 47 C 24.699219 44.398438 29.101563 41.800781 33.398438 39.199219 L 44 32.898438 C 44.601563 32.5 45 31.898438 45 31.199219 Z"
      />
    </svg>
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
      className={cn("flex items-center gap-0.5", className)}
      role="group"
      aria-label="Search engine"
    >
      <button
        type="button"
        onClick={() => setMode("google")}
        className={cn(
          headerButtonBase,
          engineMode === "google"
            ? "bg-accent text-foreground border-foreground/20"
            : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
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
          headerButtonBase,
          engineMode === "bing"
            ? "bg-accent text-foreground border-foreground/20"
            : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
          !bingAvailable && "opacity-50 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
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
              headerButtonBase,
              engineMode === "both"
                ? "bg-accent text-foreground border-foreground/20"
                : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
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
