"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export type SortKey = "clicks" | "clicksChange" | "impressions" | "impressionsChange";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "clicks", label: "Clicks (high first)" },
  { value: "clicksChange", label: "Click change %" },
  { value: "impressions", label: "Impressions (high first)" },
  { value: "impressionsChange", label: "Impression change %" },
];

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

  const label = OPTIONS.find((o) => o.value === value)?.label ?? value;

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
        <span className="max-w-[120px] truncate">{label}</span>
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-10 mt-1 min-w-[180px] rounded-md border border-input bg-surface py-1 shadow-md"
          role="listbox"
        >
          {OPTIONS.map((opt) => (
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
