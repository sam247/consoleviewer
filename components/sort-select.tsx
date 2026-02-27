"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export type SortKey =
  | "aToZ"
  | "total"
  | "growth"
  | "growthPct"
  | "clicks"
  | "clicksChange"
  | "impressions"
  | "impressionsChange";

const ORDER_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "aToZ", label: "A to Z" },
  { value: "total", label: "Total" },
  { value: "growth", label: "Growth" },
  { value: "growthPct", label: "Growth %" },
];

const METRIC_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "clicks", label: "Clicks" },
  { value: "impressions", label: "Impressions" },
  { value: "clicksChange", label: "Click change %" },
  { value: "impressionsChange", label: "Impression change %" },
];

const ALL_OPTIONS = [...ORDER_OPTIONS, ...METRIC_OPTIONS];

interface SortSelectProps {
  value: SortKey;
  onChange: (key: SortKey) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (key: SortKey) => {
      onChange(key);
      setOpen(false);
    },
    [onChange]
  );

  const label = ALL_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Sort by"
        className={cn(
          "flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm",
          "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        )}
      >
        <span className="text-muted-foreground">Sort:</span>
        <span className="max-w-[100px] truncate">{label}</span>
        <span className="text-muted-foreground" aria-hidden>▾</span>
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-md border border-input bg-surface py-1 shadow-md"
          role="listbox"
        >
          {ORDER_OPTIONS.map((opt) => (
            <li key={opt.value} role="option" aria-selected={value === opt.value}>
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm",
                  value === opt.value
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            </li>
          ))}
          <li role="separator" className="my-1 border-t border-border" />
          <li className="px-3 py-1 text-xs font-medium text-muted-foreground">Metric</li>
          {METRIC_OPTIONS.map((opt) => (
            <li key={opt.value} role="option" aria-selected={value === opt.value}>
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm",
                  value === opt.value
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
