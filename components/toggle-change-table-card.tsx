"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";
import { MobileOverflowMenu } from "@/components/ui/mobile-overflow-menu";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ReportModal } from "@/components/report-modal";
import { exportToCsv } from "@/lib/export-csv";

type Variant = "rising" | "dropping";

type ChangeSortKey = "label" | "clicks" | "impressions" | "changePercent" | "impressionsChangePercent";

function getSortValue(row: ToggleChangeRow, key: ChangeSortKey): string | number {
  switch (key) {
    case "label":
      return row.label;
    case "clicks":
      return row.clicks;
    case "impressions":
      return row.impressions;
    case "changePercent":
      return row.changePercent ?? -Infinity;
    case "impressionsChangePercent":
      return row.impressionsChangePercent ?? -Infinity;
  }
}

export type ToggleChangeRow = {
  key: string;
  label: string;
  title?: string;
  clicks: number;
  impressions: number;
  changePercent?: number;
  impressionsChangePercent?: number;
  url?: string;
};

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function formatDelta(value?: number): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (value == null || Number.isNaN(value)) return { text: "—", tone: "neutral" };
  const v = Math.round(value);
  if (v === 0) return { text: "±0%", tone: "neutral" };
  return { text: `${v > 0 ? "+" : ""}${v}%`, tone: v > 0 ? "positive" : "negative" };
}

function storageKey(scope: "queries" | "pages", propertyId: string) {
  return `consoleview_saved_${scope}_${propertyId}`;
}

function readSaved(scope: "queries" | "pages", propertyId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(scope, propertyId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSaved(scope: "queries" | "pages", propertyId: string, values: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope, propertyId), JSON.stringify(Array.from(values)));
  } catch {}
}

async function trackKeyword(propertyId: string, phrase: string) {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/tracked-keywords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phrase }),
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
  if (!res.ok) {
    const message = payload.error ? (payload.hint ? `${payload.error} (${payload.hint})` : payload.error) : "Failed to add keyword";
    throw new Error(message);
  }
}

function TogglePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-1 text-xs",
        active
          ? "bg-surface text-foreground border border-border font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ActionButton({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function normalizeExternalUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v.replace(/^\/+/, "")}`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 17.3l-6.18 3.25 1.18-6.88L2 8.97l6.91-1L12 1.8l3.09 6.17 6.91 1-5 4.7 1.18 6.88z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ToggleChangeTableCard({
  propertyId,
  title,
  scope,
  risingRows,
  droppingRows,
  viewMoreHref,
  maxRows = 8,
  className,
}: {
  propertyId: string;
  title: "Queries" | "Pages";
  scope: "queries" | "pages";
  risingRows: ToggleChangeRow[];
  droppingRows: ToggleChangeRow[];
  viewMoreHref: string;
  maxRows?: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [variant, setVariant] = useState<Variant>("rising");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const { sortKey, sortDir, onSort } = useTableSort<ChangeSortKey>("clicks");
  const [tracking, setTracking] = useState<Record<string, boolean>>({});
  const [tracked, setTracked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Set<string>>(() => readSaved(scope, propertyId));

  const activeRows = variant === "rising" ? risingRows : droppingRows;
  const sortedActive = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...activeRows].sort((a, b) => {
      if (sortKey === "label") return dir * String(getSortValue(a, sortKey)).localeCompare(String(getSortValue(b, sortKey)));
      return dir * (Number(getSortValue(a, sortKey)) - Number(getSortValue(b, sortKey)));
    });
  }, [activeRows, sortDir, sortKey]);
  const limited = useMemo(() => sortedActive.slice(0, maxRows), [maxRows, sortedActive]);
  const risingCount = risingRows.length;
  const droppingCount = droppingRows.length;

  const subtitle = (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-positive">Rising: +{risingCount}</span>
      <span className="text-muted-foreground">•</span>
      <span className="text-negative">Dropping: -{droppingCount}</span>
    </span>
  );

  const toggleAction = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
        <TogglePill active={variant === "rising"} onClick={() => setVariant("rising")}>
          Rising
        </TogglePill>
        <TogglePill active={variant === "dropping"} onClick={() => setVariant("dropping")}>
          Dropping
        </TogglePill>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        View full report
      </button>
      <Link href={viewMoreHref} className="text-xs text-muted-foreground hover:text-foreground underline" aria-label={`View more for ${title}`}>
        View more
      </Link>
    </div>
  );

  const onToggleSaved = (rowKey: string) => {
    const next = new Set(saved);
    if (next.has(rowKey)) next.delete(rowKey);
    else next.add(rowKey);
    setSaved(next);
    writeSaved(scope, propertyId, next);
  };

  const onTrack = async (phrase: string) => {
    if (tracking[phrase] || tracked[phrase]) return;
    setTracking((prev) => ({ ...prev, [phrase]: true }));
    try {
      await trackKeyword(propertyId, phrase);
      setTracked((prev) => ({ ...prev, [phrase]: true }));
      await queryClient.invalidateQueries({ queryKey: ["serprobotKeywords", propertyId] });
    } finally {
      setTracking((prev) => ({ ...prev, [phrase]: false }));
    }
  };

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">{title}</span>}
      subtitle={subtitle}
      action={toggleAction}
      className={cn("min-w-0 min-h-[360px]", className)}
    >
      <div className="max-h-[280px] overflow-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader
                label={title === "Queries" ? "Query" : "URL"}
                column="label"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="left"
                className="w-[60%]"
              />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[20%]" />
              <SortableHeader
                label="Impr."
                column="impressions"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="w-[20%]"
              />
              <th className={cn("px-3 font-semibold text-right w-[1%]", TABLE_CELL_Y)} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => {
              const r = limited[i];
              const rowKey = r?.key ?? `placeholder-${i}`;
              const showActions = Boolean(r);
              const queryText = r?.key ?? "";
              const href =
                title === "Queries"
                  ? `https://www.google.com/search?q=${encodeURIComponent(queryText)}`
                  : normalizeExternalUrl(r?.url ?? r?.title ?? "");

              return (
                <tr key={rowKey} className={cn(TABLE_ROW_CLASS, "group")}> 
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r?.title ?? r?.label}>
                    {r ? r.label : <span className="invisible">—</span>}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r ? (
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatNum(r.clicks)}</span>
                        {(() => {
                          const d = formatDelta(r.changePercent);
                          return (
                            <span
                              className={cn(
                                "text-xs",
                                d.tone === "positive" ? "text-positive" : d.tone === "negative" ? "text-negative" : "text-muted-foreground"
                              )}
                            >
                              ({d.text})
                            </span>
                          );
                        })()}
                      </span>
                    ) : (
                      <span className="invisible">0</span>
                    )}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    {r ? (
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-foreground">{formatNum(r.impressions)}</span>
                        {(() => {
                          const d = formatDelta(r.impressionsChangePercent);
                          return (
                            <span
                              className={cn(
                                "text-xs",
                                d.tone === "positive" ? "text-positive" : d.tone === "negative" ? "text-negative" : "text-muted-foreground"
                              )}
                            >
                              ({d.text})
                            </span>
                          );
                        })()}
                      </span>
                    ) : (
                      <span className="invisible">0</span>
                    )}
                  </td>
                  <td className={cn("px-3", TABLE_CELL_Y)}>
                    {showActions ? (
                      <div className="flex items-center justify-end">
                        <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {title === "Queries" && (
                            <ActionButton
                              title={tracked[queryText] ? "Tracked" : tracking[queryText] ? "Tracking…" : "Track keyword"}
                              onClick={() => onTrack(queryText)}
                              className={cn(tracked[queryText] ? "text-positive" : undefined)}
                            >
                              <PlusIcon />
                            </ActionButton>
                          )}
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                              aria-label={title === "Queries" ? "Open Google search" : "Open page"}
                              title={title === "Queries" ? "Open Google search" : "Open page"}
                            >
                              <ExternalLinkIcon />
                            </a>
                          ) : null}
                          <ActionButton title={saved.has(rowKey) ? "Saved" : "Save"} onClick={() => onToggleSaved(rowKey)}>
                            <StarIcon filled={saved.has(rowKey)} />
                          </ActionButton>
                        </div>
                        <div className="md:hidden">
                          <MobileOverflowMenu
                            buttonLabel="Row actions"
                            align="right"
                            buttonClassName="h-9 w-9"
                            panelClassName="p-1"
                          >
                            <div className="flex flex-col">
                              {title === "Queries" && (
                                <button
                                  type="button"
                                  onClick={() => onTrack(queryText)}
                                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                                  disabled={tracking[queryText] || tracked[queryText]}
                                >
                                  <span>{tracked[queryText] ? "Tracked" : "Track keyword"}</span>
                                  <span className="text-xs text-muted-foreground">{tracking[queryText] ? "…" : ""}</span>
                                </button>
                              )}
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                                >
                                  <span>{title === "Queries" ? "Open Google" : "Open page"}</span>
                                  <ExternalLinkIcon />
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => onToggleSaved(rowKey)}
                                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                              >
                                <span>{saved.has(rowKey) ? "Saved" : "Save"}</span>
                                <StarIcon filled={saved.has(rowKey)} />
                              </button>
                            </div>
                          </MobileOverflowMenu>
                        </div>
                      </div>
                    ) : (
                      <span className="invisible">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {limited.length === 0 && (
        <div className="px-5 pb-4 pt-2 text-xs text-muted-foreground">No {variant} items in this period.</div>
      )}

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={variant === "rising" ? "Rising" : "Dropping"}
        actions={
          <button
            type="button"
            onClick={() => {
              const rowsToExport = (variant === "rising" ? risingRows : droppingRows).map((r) => ({
                label: r.label,
                clicks: r.clicks,
                clicksDeltaPercent: r.changePercent,
                impressions: r.impressions,
                impressionsDeltaPercent: r.impressionsChangePercent,
              }));
              exportToCsv(rowsToExport, `${title.toLowerCase()}-${variant}.csv`);
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Export CSV
          </button>
        }
        search={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
            <TogglePill active={variant === "rising"} onClick={() => setVariant("rising")}>
              Rising
            </TogglePill>
            <TogglePill active={variant === "dropping"} onClick={() => setVariant("dropping")}>
              Dropping
            </TogglePill>
          </div>
          <span className="text-xs text-muted-foreground">Rising: +{risingCount} • Dropping: -{droppingCount}</span>
        </div>
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <SortableHeader
                label={title === "Queries" ? "Query" : "URL"}
                column="label"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="left"
                className="w-[55%]"
              />
              <SortableHeader label="Clicks" column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[22%]" />
              <SortableHeader label="Impr." column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[23%]" />
            </tr>
          </thead>
          <tbody>
            {(() => {
              const base = variant === "rising" ? risingRows : droppingRows;
              const q = filter.trim().toLowerCase();
              const filteredRows = q ? base.filter((r) => r.label.toLowerCase().includes(q)) : base;
              const dir = sortDir === "asc" ? 1 : -1;
              const sortedRows = [...filteredRows].sort((a, b) => {
                if (sortKey === "label") return dir * String(getSortValue(a, sortKey)).localeCompare(String(getSortValue(b, sortKey)));
                return dir * (Number(getSortValue(a, sortKey)) - Number(getSortValue(b, sortKey)));
              });
              return sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No rows to display.
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const clicksDelta = formatDelta(r.changePercent);
                  const imprDelta = formatDelta(r.impressionsChangePercent);
                  return (
                    <tr key={r.key} className={TABLE_ROW_CLASS}>
                      <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.title ?? r.label}>
                        {r.label}
                      </td>
                      <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                        <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                          <span className="text-foreground">{formatNum(r.clicks)}</span>
                          <span className={cn("text-xs", clicksDelta.tone === "positive" ? "text-positive" : clicksDelta.tone === "negative" ? "text-negative" : "text-muted-foreground")}>
                            ({clicksDelta.text})
                          </span>
                        </span>
                      </td>
                      <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                        <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                          <span className="text-foreground">{formatNum(r.impressions)}</span>
                          <span className={cn("text-xs", imprDelta.tone === "positive" ? "text-positive" : imprDelta.tone === "negative" ? "text-negative" : "text-muted-foreground")}>
                            ({imprDelta.text})
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              );
            })()}
          </tbody>
        </table>
      </ReportModal>
    </TableCard>
  );
}
