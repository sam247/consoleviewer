import type { DataViewRow } from "@/hooks/use-data-view";

export type DataViewSortKey = "key" | "clicks" | "impressions" | "ctr" | "position" | "clicks_change";

export type DataViewTextMode = "contains" | "not_contains";

export function formatCompact(n: number): string {
  const v = Math.round(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export function formatCtr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export function formatPos(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function formatSignedInt(n: number): string {
  const v = Math.round(n);
  return `${v > 0 ? "+" : ""}${v}`;
}

export function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(input: string) {
  return input.trim().toLowerCase();
}

function rowMatchesText(rowKey: string, text: string, mode: DataViewTextMode) {
  const q = normalizeKey(text);
  if (!q) return true;
  const hay = normalizeKey(rowKey);
  const hit = hay.includes(q);
  return mode === "contains" ? hit : !hit;
}

export function applyDataViewFilters(
  rows: DataViewRow[],
  input: {
    text: string;
    textMode: DataViewTextMode;
    posMin: number | null;
    posMax: number | null;
    ctrMax: number | null;
    impressionsMin: number | null;
    clicksMin: number | null;
  }
) {
  return rows.filter((r) => {
    if (!rowMatchesText(r.key, input.text, input.textMode)) return false;
    if (input.posMin != null && (r.position == null || r.position < input.posMin)) return false;
    if (input.posMax != null && (r.position == null || r.position > input.posMax)) return false;
    if (input.ctrMax != null && (!Number.isFinite(r.ctr) || r.ctr > input.ctrMax)) return false;
    if (input.impressionsMin != null && r.impressions < input.impressionsMin) return false;
    if (input.clicksMin != null && r.clicks < input.clicksMin) return false;
    return true;
  });
}

export function computeSortValue(row: DataViewRow, key: DataViewSortKey): number | string {
  if (key === "key") return row.key;
  if (key === "position") return row.position ?? Number.POSITIVE_INFINITY;
  const v = (row as unknown as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
