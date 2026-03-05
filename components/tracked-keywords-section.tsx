"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import type { MockTrackedKeyword } from "@/lib/mock-rank";
import { InfoTooltip } from "@/components/info-tooltip";
import { exportToCsv } from "@/lib/export-csv";
import { cn } from "@/lib/utils";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = useMemo(
    () => data.map((value, i) => ({ i, value })),
    [data]
  );
  if (!data.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="h-6 w-16 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.7}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TrackedKeywordsSectionProps {
  /** Optional fallback keywords; by default we only render real SerpRobot data. */
  keywords?: MockTrackedKeyword[];
  /** Optional export filename (without .csv) for CSV export. */
  exportFilename?: string;
}

async function fetchSerprobotKeywords(): Promise<{
  configured: boolean;
  canManageKeywords?: boolean;
  keywords: MockTrackedKeyword[];
  message?: string;
}> {
  const res = await fetch("/api/serprobot/keywords");
  if (!res.ok) return { configured: false, keywords: [] };
  return res.json();
}

type KeywordRow = MockTrackedKeyword & { id?: string };

export function TrackedKeywordsSection({ keywords: fallbackKeywords = [], exportFilename }: TrackedKeywordsSectionProps) {
  const queryClient = useQueryClient();
  const [addInput, setAddInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: serpData } = useQuery({
    queryKey: ["serprobotKeywords"],
    queryFn: fetchSerprobotKeywords,
  });

  const keywords: KeywordRow[] = serpData?.configured
    ? ((serpData.keywords ?? []) as KeywordRow[])
    : fallbackKeywords.map((k) => ({ ...k }));
  const showConnectMessage = serpData?.configured === false;
  const canAddDelete = serpData?.configured === true && serpData?.canManageKeywords === true;

  const handleAdd = async () => {
    const phrase = addInput.trim();
    if (!phrase || addLoading) return;
    setAddLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/serprobot/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        const message = data.error ? (data.hint ? `${data.error} (${data.hint})` : data.error) : "Failed to add keyword";
        throw new Error(message);
      }
      setAddInput("");
      await queryClient.invalidateQueries({ queryKey: ["serprobotKeywords"] });
      setActionSuccess(`Added "${phrase}"`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add keyword";
      setActionError(message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (row: KeywordRow) => {
    if (deleteLoading) return;
    setDeleteLoading(row.keyword);
    setActionError(null);
    setActionSuccess(null);
    try {
      const url = row.id
        ? `/api/serprobot/keywords?keywordId=${encodeURIComponent(row.id)}`
        : `/api/serprobot/keywords?phrase=${encodeURIComponent(row.keyword)}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        const message = data.error ? (data.hint ? `${data.error} (${data.hint})` : data.error) : "Failed to remove keyword";
        throw new Error(message);
      }
      await queryClient.invalidateQueries({ queryKey: ["serprobotKeywords"] });
      setActionSuccess(`Removed "${row.keyword}"`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove keyword";
      setActionError(message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleExport = () => {
    const rows = keywords.map((r) => ({
      keyword: r.keyword,
      position: r.position,
      delta1d: r.delta1d,
      delta7d: r.delta7d,
    }));
    exportToCsv(rows, (exportFilename ?? "keywords-tracked") + ".csv");
  };

  return (
    <div
      className="min-w-0 rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 flex flex-col"
      aria-label="Keywords tracked"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <span className="font-semibold text-sm text-foreground flex items-center gap-1">Keywords tracked<InfoTooltip title="Rank-tracked keywords with position and trend" /></span>
          {showConnectMessage && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Add keywords to start tracking.
            </p>
          )}
          {!showConnectMessage && serpData?.canManageKeywords === false && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Read-only mode. Add/remove keywords in SerpRobot dashboard.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {canAddDelete && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Add keyword"
                className="rounded border border-border bg-background px-2 py-1 text-xs w-32 focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={addLoading}
                className="rounded px-2 py-1 text-xs font-medium bg-background text-foreground border border-input hover:bg-accent transition-colors disabled:opacity-50"
              >
                {addLoading ? "…" : "Add"}
              </button>
            </div>
          )}
          {keywords.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
              title="Export CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto min-w-0">
        {actionError && (
          <p className="px-4 py-2 text-xs text-destructive border-b border-border">
            {actionError}
          </p>
        )}
        {actionSuccess && (
          <p className="px-4 py-2 text-xs text-positive border-b border-border">
            {actionSuccess}
          </p>
        )}
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">
            {showConnectMessage
              ? "Add keywords to start tracking."
              : "No tracked keywords yet. Add keywords to start tracking."}
          </p>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className={TABLE_BASE_CLASS}>
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <th className={cn("text-left px-4 font-semibold min-w-0 w-[35%]", TABLE_CELL_Y)}>Name</th>
                  <th className={cn("text-right px-4 font-semibold w-20", TABLE_CELL_Y)}>Position</th>
                  <th className={cn("text-right px-4 font-semibold w-16", TABLE_CELL_Y)}>1D Δ</th>
                  <th className={cn("text-right px-4 font-semibold w-16", TABLE_CELL_Y)}>7D Δ</th>
                  <th className={cn("text-right px-4 font-semibold w-20", TABLE_CELL_Y)}>Trend</th>
                  {canAddDelete && <th className={cn("w-10 px-2", TABLE_CELL_Y)} aria-label="Remove" />}
                </tr>
              </thead>
              <tbody>
                {keywords.map((row, idx) => (
                  <tr
                    key={`${row.keyword}-${idx}`}
                    className={TABLE_ROW_CLASS}
                  >
                    <td className={cn("px-4 text-foreground truncate min-w-0", TABLE_CELL_Y)} title={row.keyword}>
                      {row.keyword}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums text-foreground", TABLE_CELL_Y)}>
                      {row.position.toFixed(1)}
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className={row.delta1d < 0 ? "text-positive" : row.delta1d > 0 ? "text-negative" : "text-muted-foreground"}>
                        {row.delta1d > 0 ? "+" : ""}{row.delta1d}
                      </span>
                    </td>
                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>
                      <span className={row.delta7d < 0 ? "text-positive" : row.delta7d > 0 ? "text-negative" : "text-muted-foreground"}>
                        {row.delta7d > 0 ? "+" : ""}{row.delta7d}
                      </span>
                    </td>
                    <td className={cn("px-4 text-right", TABLE_CELL_Y)}>
                      <MiniSparkline data={row.sparkData} />
                    </td>
                    {canAddDelete && (
                      <td className={cn("px-2 text-right", TABLE_CELL_Y)}>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={deleteLoading === row.keyword}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
                          aria-label={`Remove ${row.keyword}`}
                          title="Remove keyword"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
