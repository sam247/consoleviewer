"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { exportToCsv } from "@/lib/export-csv";
import { useTableSort } from "@/hooks/use-table-sort";
import { useDataViewRows, type DataViewDimension } from "@/hooks/use-data-view";
import { useSavedViews, type SavedView } from "@/hooks/use-saved-views";
import { DataViewFilters, type DataViewFilterState } from "@/components/data-view/data-view-filters";
import { DataViewVirtualTable } from "@/components/data-view/data-view-virtual-table";
import {
  applyDataViewFilters,
  computeSortValue,
  parseNum,
  type DataViewSortKey,
} from "@/lib/data-view-utils";

export function TableDataViewModal({
  open,
  onClose,
  title,
  propertyId,
  dimension,
  startDate,
  endDate,
  priorStartDate,
  priorEndDate,
  exportFilename,
  siteLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  propertyId: string;
  dimension: DataViewDimension;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  exportFilename: string;
  siteLabel?: string;
}) {
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<DataViewFilterState>({
    textMode: "contains",
    text: "",
    posMin: "",
    posMax: "",
    ctrMax: "",
    impressionsMin: "",
    clicksMin: "",
  });

  const [smartInput, setSmartInput] = useState("");
  const [smartLoading, setSmartLoading] = useState(false);

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const deferredText = useDeferredValue(filter.text);
  const deferredTextMode = useDeferredValue(filter.textMode);
  const deferredPosMin = useDeferredValue(filter.posMin);
  const deferredPosMax = useDeferredValue(filter.posMax);
  const deferredCtrMax = useDeferredValue(filter.ctrMax);
  const deferredImprMin = useDeferredValue(filter.impressionsMin);
  const deferredClicksMin = useDeferredValue(filter.clicksMin);

  const { sortKey, sortDir, onSort } = useTableSort<DataViewSortKey>("clicks", "desc");

  const savedViews = useSavedViews({ propertyId, dimension, enabled: open });
  const views = useMemo(() => savedViews.query.data ?? [], [savedViews.query.data]);
  const activeView: SavedView | null = useMemo(() => {
    if (!activeViewId) return null;
    return views.find((v) => v.id === activeViewId) ?? null;
  }, [activeViewId, views]);

  const query = useDataViewRows({
    enabled: open,
    propertyId,
    dimension,
    startDate,
    endDate,
    priorStartDate,
    priorEndDate,
    pageSize: 2000,
  });

  const allRows = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.flatMap((p) => p.rows ?? []);
  }, [query.data]);

  useEffect(() => {
    if (!open) return;
    if (query.isFetchingNextPage) return;
    if (!query.hasNextPage) return;
    if (allRows.length >= 10_000) {
      void query.fetchNextPage();
      return;
    }
    void query.fetchNextPage();
  }, [open, query, allRows.length]);

  const filtered = useMemo(() => {
    return applyDataViewFilters(allRows, {
      text: deferredText,
      textMode: deferredTextMode,
      posMin: parseNum(deferredPosMin),
      posMax: parseNum(deferredPosMax),
      ctrMax: parseNum(deferredCtrMax),
      impressionsMin: parseNum(deferredImprMin),
      clicksMin: parseNum(deferredClicksMin),
    });
  }, [
    allRows,
    deferredText,
    deferredTextMode,
    deferredPosMin,
    deferredPosMax,
    deferredCtrMax,
    deferredImprMin,
    deferredClicksMin,
  ]);

  const applySmart = async () => {
    const input = smartInput.trim();
    if (!input) return;
    setSmartLoading(true);
    try {
      const res = await fetch("/api/ai/smart-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          dimension,
          domain: siteLabel,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        filters?: {
          text_contains?: string;
          text_not_contains?: string;
          position_min?: number;
          position_max?: number;
          ctr_max?: number;
          impressions_min?: number;
          clicks_min?: number;
        };
        error?: string;
      };

      const f = payload.filters;
      if (!f) {
        startTransition(() => setFilter((prev) => ({ ...prev, textMode: "contains", text: input })));
        return;
      }

      startTransition(() =>
        setFilter((prev) => ({
          ...prev,
          textMode: f.text_not_contains ? "not_contains" : "contains",
          text: (f.text_not_contains ?? f.text_contains ?? "").trim() || prev.text,
          posMin: f.position_min != null ? String(f.position_min) : prev.posMin,
          posMax: f.position_max != null ? String(f.position_max) : prev.posMax,
          ctrMax: f.ctr_max != null ? String(f.ctr_max) : prev.ctrMax,
          impressionsMin: f.impressions_min != null ? String(f.impressions_min) : prev.impressionsMin,
          clicksMin: f.clicks_min != null ? String(f.clicks_min) : prev.clicksMin,
        }))
      );
    } catch {
      startTransition(() => setFilter((prev) => ({ ...prev, textMode: "contains", text: input })));
    } finally {
      setSmartLoading(false);
    }
  };

  const buildStateForSave = () => ({
    ...filter,
  });

  const applySavedState = (state: unknown) => {
    if (!state || typeof state !== "object") return;
    const candidate =
      "filter" in (state as Record<string, unknown>) &&
      (state as Record<string, unknown>).filter &&
      typeof (state as Record<string, unknown>).filter === "object"
        ? ((state as Record<string, unknown>).filter as Record<string, unknown>)
        : (state as Record<string, unknown>);

    const next: Partial<DataViewFilterState> = {
      textMode:
        candidate.textMode === "contains" || candidate.textMode === "not_contains"
          ? (candidate.textMode as DataViewFilterState["textMode"])
          : undefined,
      text: typeof candidate.text === "string" ? candidate.text : undefined,
      posMin: typeof candidate.posMin === "string" ? candidate.posMin : undefined,
      posMax: typeof candidate.posMax === "string" ? candidate.posMax : undefined,
      ctrMax: typeof candidate.ctrMax === "string" ? candidate.ctrMax : undefined,
      impressionsMin: typeof candidate.impressionsMin === "string" ? candidate.impressionsMin : undefined,
      clicksMin: typeof candidate.clicksMin === "string" ? candidate.clicksMin : undefined,
    };

    startTransition(() => setFilter((prev) => ({ ...prev, ...next })));
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = computeSortValue(a, sortKey);
      const bv = computeSortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * (Number(av) - Number(bv));
    });
  }, [filtered, sortDir, sortKey]);

  const onExport = () => {
    const rows = sorted.map((r) => ({
      key: r.key,
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: Number(r.ctr.toFixed(3)),
      position: r.position == null ? "" : Number(r.position.toFixed(2)),
      clicks_prev: r.clicks_prev ?? "",
      impressions_prev: r.impressions_prev ?? "",
      ctr_prev: r.ctr_prev ?? "",
      position_prev: r.position_prev ?? "",
      clicks_change: r.clicks_change ?? "",
      impressions_change: r.impressions_change ?? "",
      ctr_change: r.ctr_change ?? "",
      position_change: r.position_change ?? "",
      clicks_change_percent: r.clicks_change_percent ?? "",
    }));
    exportToCsv(rows, exportFilename);
  };

  if (!open) return null;

  const hasPrior = query.data?.pages?.[0]?.hasPrior ?? true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-view-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-6xl max-h-[88vh] rounded-lg border border-border bg-surface shadow-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="data-view-title" className="text-sm font-semibold text-foreground truncate">{title}</h2>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={smartInput}
                  onChange={(e) => setSmartInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applySmart();
                    }
                  }}
                  placeholder="Smart filter (e.g. low CTR high impressions, position 5 to 15)"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void applySmart()}
                  disabled={!smartInput.trim() || smartLoading}
                  className="h-9 shrink-0 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {smartLoading ? "…" : "Apply"}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Saved views</span>
                  <select
                    value={activeViewId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setActiveViewId(null);
                        return;
                      }
                      const v = views.find((x) => x.id === id);
                      setActiveViewId(id);
                      if (v) applySavedState(v.state);
                    }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-[11px]"
                    disabled={savedViews.query.isLoading}
                  >
                    <option value="">None</option>
                    {views.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {activeView ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Active: {activeView.name}</span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      onClick={() => {
                        const next = window.prompt("Rename view", activeView.name);
                        if (!next) return;
                        void savedViews.rename.mutateAsync({ id: activeView.id, name: next.trim() });
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      onClick={() => {
                        if (!window.confirm(`Delete view “${activeView.name}”?`)) return;
                        void savedViews.remove.mutateAsync({ id: activeView.id }).then(() => setActiveViewId(null));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}

                <div className="ml-auto flex items-center gap-2">
                  {saveOpen ? (
                    <>
                      <input
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="View name"
                        className="h-8 w-[180px] rounded-md border border-input bg-background px-2 text-[11px]"
                      />
                      <button
                        type="button"
                        disabled={!saveName.trim() || savedViews.create.isPending}
                        onClick={() => {
                          const name = saveName.trim();
                          if (!name) return;
                          void savedViews.create
                            .mutateAsync({ name, state: buildStateForSave() })
                            .then((v) => {
                              setActiveViewId(v.id);
                              setSaveOpen(false);
                              setSaveName("");
                            });
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveOpen(false);
                          setSaveName("");
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSaveOpen(true)}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      Save view
                    </button>
                  )}
                </div>
              </div>

              <DataViewFilters
                dimension={dimension}
                loaded={allRows.length}
                shown={sorted.length}
                isUpdating={query.isFetching && !query.isFetchingNextPage}
                isFiltering={false}
                filter={filter}
                onChange={(next) => setFilter((prev) => ({ ...prev, ...next }))}
                onSort={onSort}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onExport}
                className="text-xs text-muted-foreground hover:text-foreground underline"
                disabled={sorted.length === 0}
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded text-muted-foreground hover:bg-accent transition-colors duration-[120ms]"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

        </div>

        <DataViewVirtualTable
          dimension={dimension}
          rows={sorted}
          hasPrior={hasPrior}
          isLoadingMore={query.isFetchingNextPage}
        />
      </div>
    </div>
  );
}
