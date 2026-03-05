"use client";

import { cn } from "@/lib/utils";
import { TABLE_CELL_Y } from "@/components/ui/table-styles";

interface SortableHeaderProps<K extends string> {
  label: string;
  column: K;
  sortKey: K;
  sortDir: "asc" | "desc";
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}

export function SortableHeader<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "right",
  className,
}: SortableHeaderProps<K>) {
  const active = sortKey === column;
  return (
    <th className={cn("px-4 font-semibold", align === "left" ? "text-left" : "text-right", TABLE_CELL_Y, className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "hover:text-foreground transition-colors inline-flex items-center gap-0.5",
          align === "right" && "ml-auto"
        )}
      >
        {label}
        {active && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
