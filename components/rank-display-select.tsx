"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export type RankVariant = "footer" | "kpi";

const OPTIONS: { value: RankVariant; label: string }[] = [
  { value: "footer", label: "Footer" },
  { value: "kpi", label: "KPI" },
];

export function RankDisplaySelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const rankVariant = (searchParams.get("rankVariant") === "kpi" ? "kpi" : "footer") as RankVariant;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (value: RankVariant) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === "footer") {
        next.delete("rankVariant");
      } else {
        next.set("rankVariant", value);
      }
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      setOpen(false);
    },
    [pathname, router, searchParams]
  );

  if (pathname !== "/") return null;

  const label = OPTIONS.find((o) => o.value === rankVariant)?.label ?? "Footer";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Rank display"
        className={cn(
          "flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm",
          "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        )}
      >
        <span className="text-muted-foreground">Rank:</span>
        <span className="max-w-[80px] truncate">{label}</span>
        <span className="text-muted-foreground" aria-hidden>▾</span>
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-md border border-input bg-surface py-1 shadow-md"
          role="listbox"
        >
          {OPTIONS.map((opt) => (
            <li key={opt.value} role="option" aria-selected={rankVariant === opt.value}>
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm",
                  rankVariant === opt.value
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
