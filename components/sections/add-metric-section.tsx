"use client";

import { useState } from "react";
import { DataTable, type DataTableRow } from "@/components/data-table";
import { exportToCsv, formatExportFilename } from "@/lib/export-csv";

type AddMetricId = "countries" | "devices" | null;

export function AddMetricSection({
  countriesRows,
  devicesRows,
  siteSlug,
  startDate,
  endDate,
}: {
  countriesRows: DataTableRow[];
  devicesRows: DataTableRow[];
  siteSlug: string;
  startDate: string;
  endDate: string;
}) {
  const [addedMetrics, setAddedMetrics] = useState<[AddMetricId, AddMetricId]>([null, null]);
  const [addMetricModalOpen, setAddMetricModalOpen] = useState(false);
  const [addMetricSlotTarget, setAddMetricSlotTarget] = useState<0 | 1 | null>(null);

  return (
    <>
      <section aria-label="Add a metric" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {([0, 1] as const).map((slotIndex) => {
          const metric = addedMetrics[slotIndex];
          return (
            <div
              key={slotIndex}
              className="min-h-[200px] rounded-lg border border-border bg-muted/20 flex flex-col overflow-hidden"
            >
              {metric === null ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddMetricSlotTarget(slotIndex);
                    setAddMetricModalOpen(true);
                  }}
                  className="flex-1 min-h-[200px] flex items-center justify-center text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
                >
                  Add a metric
                </button>
              ) : metric === "countries" && countriesRows.length > 0 ? (
                <div className="flex flex-col min-h-0 flex-1 rounded-lg border border-border bg-surface overflow-hidden">
                  <DataTable
                    title="Countries"
                    rows={countriesRows}
                    showFilter={false}
                    expandInModal={true}
                    onExportCsv={() => exportToCsv(countriesRows as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "countries", startDate, endDate))}
                  />
                </div>
              ) : metric === "devices" && devicesRows.length > 0 ? (
                <div className="flex flex-col min-h-0 flex-1 rounded-lg border border-border bg-surface overflow-hidden">
                  <DataTable
                    title="Devices"
                    rows={devicesRows}
                    showFilter={false}
                    expandInModal={true}
                    onExportCsv={() => exportToCsv(devicesRows as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "devices", startDate, endDate))}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {addMetricModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-metric-title"
          onClick={(e) => e.target === e.currentTarget && (setAddMetricModalOpen(false), setAddMetricSlotTarget(null))}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-surface shadow-lg px-4 py-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-metric-title" className="text-sm font-semibold text-foreground">
              Add a metric
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose a pre-built metric to show in the slot. Toggle off to remove.
            </p>
            <div className="space-y-2">
              {countriesRows.length > 0 && (
                <label className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
                  <span className="text-sm text-foreground">Countries</span>
                  <input
                    type="checkbox"
                    checked={addedMetrics[0] === "countries" || addedMetrics[1] === "countries"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const target = addMetricSlotTarget ?? (addedMetrics[0] === null ? 0 : 1);
                        setAddedMetrics((prev) => {
                          const next: [AddMetricId, AddMetricId] = [...prev];
                          next[target] = "countries";
                          return next;
                        });
                      } else {
                        setAddedMetrics((prev) => {
                          const next: [AddMetricId, AddMetricId] = [...prev];
                          if (next[0] === "countries") next[0] = null;
                          if (next[1] === "countries") next[1] = null;
                          return next;
                        });
                      }
                    }}
                    className="rounded border-border"
                  />
                </label>
              )}
              {devicesRows.length > 0 && (
                <label className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
                  <span className="text-sm text-foreground">Devices</span>
                  <input
                    type="checkbox"
                    checked={addedMetrics[0] === "devices" || addedMetrics[1] === "devices"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const target = addMetricSlotTarget ?? (addedMetrics[0] === null ? 0 : addedMetrics[1] === null ? 1 : 0);
                        setAddedMetrics((prev) => {
                          const next: [AddMetricId, AddMetricId] = [...prev];
                          next[target] = "devices";
                          return next;
                        });
                      } else {
                        setAddedMetrics((prev) => {
                          const next: [AddMetricId, AddMetricId] = [...prev];
                          if (next[0] === "devices") next[0] = null;
                          if (next[1] === "devices") next[1] = null;
                          return next;
                        });
                      }
                    }}
                    className="rounded border-border"
                  />
                </label>
              )}
              {countriesRows.length === 0 && devicesRows.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No metric data available for this property.</p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => { setAddMetricModalOpen(false); setAddMetricSlotTarget(null); }}
                className="rounded border border-border bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
