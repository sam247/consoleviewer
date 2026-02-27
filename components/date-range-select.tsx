"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useDateRange } from "@/contexts/date-range-context";
import { DATE_RANGE_OPTIONS } from "@/lib/date-range";
import type { DateRangeKey } from "@/types/gsc";
import { cn } from "@/lib/utils";

export function DateRangeSelect() {
  const { rangeKey, setRangeKey } = useDateRange();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (key: DateRangeKey) => {
      setRangeKey(key);
      setOpen(false);
    },
    [setRangeKey]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const label = DATE_RANGE_OPTIONS.find((o) => o.value === rangeKey)?.label ?? rangeKey;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
          "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        )}
      >
        {label}
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-md border border-input bg-background py-1 shadow-md"
          role="listbox"
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <li key={opt.value} role="option">
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm",
                  rangeKey === opt.value
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50"
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
