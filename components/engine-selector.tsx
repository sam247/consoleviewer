"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { SearchEngine } from "@/contexts/engine-selection-context";

const ENGINE_LABELS: Record<SearchEngine, string> = {
  google: "Google",
  bing: "Bing",
};

export interface EngineSelectorProps {
  selectedEngines: SearchEngine[];
  availableEngines: SearchEngine[];
  disabledEngines?: SearchEngine[];
  disabledReasonByEngine?: Partial<Record<SearchEngine, string>>;
  onChange: (engines: SearchEngine[]) => void;
  /** Optional label before the chips, e.g. "Search engine:" or "Search engines:" */
  label?: string;
  className?: string;
}

export function EngineSelector({
  selectedEngines,
  availableEngines,
  disabledEngines = [],
  disabledReasonByEngine,
  onChange,
  label = "Search engine:",
  className,
}: EngineSelectorProps) {
  const toggle = useCallback(
    (engine: SearchEngine) => {
      if (selectedEngines.includes(engine)) {
        const next = selectedEngines.filter((e) => e !== engine);
        onChange(next.length > 0 ? next : ["google"]);
      } else {
        onChange([...selectedEngines, engine].sort((a, _b) => (a === "google" ? -1 : 1)));
      }
    },
    [onChange, selectedEngines]
  );

  if (availableEngines.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)} role="group" aria-label="Search engine selection">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="inline-flex rounded-md border border-input bg-surface p-0.5 gap-0.5">
        {availableEngines.map((engine) => {
          const selected = selectedEngines.includes(engine);
          const disabled = disabledEngines.includes(engine);
          return (
            <button
              key={engine}
              type="button"
              onClick={() => !disabled && toggle(engine)}
              disabled={disabled}
              title={disabled ? disabledReasonByEngine?.[engine] : undefined}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
              )}
              aria-pressed={selected}
              aria-label={`${ENGINE_LABELS[engine]}: ${selected ? "on" : "off"}`}
            >
              {ENGINE_LABELS[engine]}
              {selected && " ✓"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
