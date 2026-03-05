"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useDateRange } from "@/contexts/date-range-context";
import { DATE_RANGE_GROUPS, DATE_RANGE_OPTIONS } from "@/lib/date-range";
import type { DateRangeKey } from "@/types/gsc";
import { cn } from "@/lib/utils";

export function DateRangeSelect() {
  const { rangeKey, setRangeKey, customStart, customEnd, setCustomDates, startDate, endDate } = useDateRange();
  const [open, setOpen] = useState(false);
  const [localStart, setLocalStart] = useState(customStart);
  const [localEnd, setLocalEnd] = useState(customEnd);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalStart(customStart);
    setLocalEnd(customEnd);
  }, [customStart, customEnd]);

  const handleSelect = useCallback(
    (key: DateRangeKey) => {
      if (key === "custom") {
        setRangeKey(key);
        return;
      }
      setRangeKey(key);
      setOpen(false);
    },
    [setRangeKey]
  );

  const handleApplyCustom = useCallback(() => {
    if (localStart && localEnd && localStart <= localEnd) {
      setCustomDates(localStart, localEnd);
      setOpen(false);
    }
  }, [localStart, localEnd, setCustomDates]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const label = rangeKey === "custom" && customStart && customEnd
    ? `${customStart} – ${customEnd}`
    : DATE_RANGE_OPTIONS.find((o) => o.value === rangeKey)?.label ?? rangeKey;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 py-0 text-sm",
          "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        )}
      >
        {label}
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1 min-w-[220px] rounded-md border border-input bg-background shadow-md overflow-hidden"
          role="listbox"
        >
          <div className="max-h-[360px] overflow-y-auto py-1">
            {DATE_RANGE_GROUPS.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="border-t border-border my-1" />}
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {group.label}
                </div>
                {group.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={rangeKey === opt.value}
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
                ))}
              </div>
            ))}
          </div>

          {rangeKey === "custom" && (
            <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-10 shrink-0">From</label>
                <input
                  type="date"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className="flex-1 h-8 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-10 shrink-0">To</label>
                <input
                  type="date"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  className="flex-1 h-8 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!localStart || !localEnd || localStart > localEnd}
                className={cn(
                  "w-full h-8 rounded text-sm font-medium",
                  localStart && localEnd && localStart <= localEnd
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
