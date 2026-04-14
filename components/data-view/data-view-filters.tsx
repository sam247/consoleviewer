"use client";

import { useMemo, useTransition } from "react";
import type { DataViewDimension } from "@/hooks/use-data-view";
import type { DataViewSortKey, DataViewTextMode } from "@/lib/data-view-utils";
import { formatCompact } from "@/lib/data-view-utils";

export type DataViewFilterState = {
  textMode: DataViewTextMode;
  text: string;
  posMin: string;
  posMax: string;
  ctrMax: string;
  impressionsMin: string;
  clicksMin: string;
};

export function DataViewFilters({
  dimension,
  loaded,
  shown,
  isUpdating,
  isFiltering,
  filter,
  onChange,
  onSort,
}: {
  dimension: DataViewDimension;
  loaded: number;
  shown: number;
  isUpdating: boolean;
  isFiltering: boolean;
  filter: DataViewFilterState;
  onChange: (next: Partial<DataViewFilterState>) => void;
  onSort: (key: DataViewSortKey) => void;
}) {
  const [, startTransition] = useTransition();

  const header = useMemo(() => {
    const parts = [`Data view · ${formatCompact(shown)} shown / ${formatCompact(loaded)} loaded`];
    if (isUpdating) parts.push("updating");
    if (isFiltering) parts.push("filtering");
    return parts.join(" · ");
  }, [isFiltering, isUpdating, loaded, shown]);

  return (
    <div>
      <p className="mt-0.5 text-xs text-muted-foreground">{header}</p>

      <div className="mt-3 grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-5 flex gap-2">
          <select
            value={filter.textMode}
            onChange={(e) => {
              const next = (e.target.value as DataViewTextMode) || "contains";
              startTransition(() => onChange({ textMode: next }));
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
            aria-label="Text filter mode"
          >
            <option value="contains">Contains</option>
            <option value="not_contains">Does not contain</option>
          </select>
          <input
            value={filter.text}
            onChange={(e) => startTransition(() => onChange({ text: e.target.value }))}
            placeholder={dimension === "page" ? "Filter page" : "Filter query"}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs"
          />
        </div>
        <div className="col-span-6 md:col-span-2">
          <input
            value={filter.posMin}
            onChange={(e) => startTransition(() => onChange({ posMin: e.target.value }))}
            placeholder="Pos min"
            inputMode="decimal"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
          />
        </div>
        <div className="col-span-6 md:col-span-2">
          <input
            value={filter.posMax}
            onChange={(e) => startTransition(() => onChange({ posMax: e.target.value }))}
            placeholder="Pos max"
            inputMode="decimal"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
          />
        </div>
        <div className="col-span-6 md:col-span-1">
          <input
            value={filter.ctrMax}
            onChange={(e) => startTransition(() => onChange({ ctrMax: e.target.value }))}
            placeholder="CTR max"
            inputMode="decimal"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
          />
        </div>
        <div className="col-span-6 md:col-span-1">
          <input
            value={filter.impressionsMin}
            onChange={(e) => startTransition(() => onChange({ impressionsMin: e.target.value }))}
            placeholder="Impr"
            inputMode="numeric"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
          />
        </div>
        <div className="col-span-6 md:col-span-1">
          <input
            value={filter.clicksMin}
            onChange={(e) => startTransition(() => onChange({ clicksMin: e.target.value }))}
            placeholder="Clicks"
            inputMode="numeric"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {filter.text.trim() ? (
          <button
            type="button"
            onClick={() => onChange({ text: "" })}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Remove text filter"
          >
            {filter.textMode === "contains" ? "Contains" : "Not"}: {filter.text.trim()} ×
          </button>
        ) : null}
        {filter.posMin.trim() || filter.posMax.trim() ? (
          <button
            type="button"
            onClick={() => onChange({ posMin: "", posMax: "" })}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Remove position filter"
          >
            Pos {filter.posMin.trim() || "—"}–{filter.posMax.trim() || "—"} ×
          </button>
        ) : null}
        {filter.ctrMax.trim() ? (
          <button
            type="button"
            onClick={() => onChange({ ctrMax: "" })}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Remove CTR filter"
          >
            CTR ≤ {filter.ctrMax.trim()}% ×
          </button>
        ) : null}
        {filter.impressionsMin.trim() ? (
          <button
            type="button"
            onClick={() => onChange({ impressionsMin: "" })}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Remove impressions filter"
          >
            Impr ≥ {filter.impressionsMin.trim()} ×
          </button>
        ) : null}
        {filter.clicksMin.trim() ? (
          <button
            type="button"
            onClick={() => onChange({ clicksMin: "" })}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Remove clicks filter"
          >
            Clicks ≥ {filter.clicksMin.trim()} ×
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <button type="button" className="hover:text-foreground underline" onClick={() => onSort("clicks")}>clicks</button>
        <button type="button" className="hover:text-foreground underline" onClick={() => onSort("impressions")}>impr</button>
        <button type="button" className="hover:text-foreground underline" onClick={() => onSort("ctr")}>ctr</button>
        <button type="button" className="hover:text-foreground underline" onClick={() => onSort("position")}>pos</button>
        <button type="button" className="hover:text-foreground underline" onClick={() => onSort("key")}>name</button>
      </div>
    </div>
  );
}
