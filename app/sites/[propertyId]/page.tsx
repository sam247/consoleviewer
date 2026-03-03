"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { TrendChart } from "@/components/trend-chart";
import { DataTable, type DataTableRow, type TrendFilter } from "@/components/data-table";
import { BrandedChart } from "@/components/branded-chart";
import { SparkToggles } from "@/components/spark-toggles";
import { TrackedKeywordsSection } from "@/components/tracked-keywords-section";
import { IndexSignalsCard } from "@/components/index-signals-card";
import { CannibalisationCard } from "@/components/cannibalisation-card";
import { QueryFootprint, type BandFilter } from "@/components/query-footprint";
import { AiQuerySignalsCard } from "@/components/ai-query-signals-card";
import { PositionVolatilityChart } from "@/components/position-volatility-chart";
import { MomentumScoreCard } from "@/components/momentum-score-card";
import { OpportunityIntelligence } from "@/components/opportunity-intelligence";
import { OpportunityIndex } from "@/components/opportunity-index";
import { useDateRange } from "@/contexts/date-range-context";
import { decodePropertyId } from "@/types/gsc";
import { exportToCsv, exportChartToPng, formatExportFilename } from "@/lib/export-csv";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/info-tooltip";
import { TableFullViewModal } from "@/components/table-full-view-modal";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

async function fetchSiteDetail(
  siteUrl: string,
  startDate: string,
  endDate: string,
  priorStartDate: string,
  priorEndDate: string
) {
  const params = new URLSearchParams({
    site: siteUrl,
    startDate,
    endDate,
    priorStartDate,
    priorEndDate,
  });
  const res = await fetch(`/api/analytics/detail?${params}`);
  if (!res.ok) throw new Error("Failed to fetch site detail");
  return res.json();
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface animate-pulse", className)}>
      <div className="h-6 w-1/3 rounded bg-muted m-3" />
      <div className="h-4 w-2/3 rounded bg-muted m-3" />
    </div>
  );
}

type Summary = {
  clicks: number;
  impressions: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
  position?: number;
  positionChangePercent?: number;
  ctr?: number;
  ctrChangePercent?: number;
  queryCount?: number;
  queryCountChangePercent?: number;
};

function HeaderMetricRow({
  summary,
  formatNum,
}: {
  summary: Summary | null | undefined;
  formatNum: (n: number) => string;
}) {
  if (!summary) return null;
  const ctr = summary.ctr ?? (summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0);
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Clicks<InfoTooltip title="Total clicks from Google Search Console for the selected date range" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatNum(summary.clicks)}</span>
        {summary.clicksChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.clicksChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.clicksChangePercent >= 0 ? "+" : ""}{summary.clicksChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Impr.<InfoTooltip title="Total impressions in search results" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatNum(summary.impressions)}</span>
        {summary.impressionsChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.impressionsChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.impressionsChangePercent >= 0 ? "+" : ""}{summary.impressionsChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">CTR<InfoTooltip title="Click-through rate (clicks ÷ impressions)" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{ctr.toFixed(2)}%</span>
        {summary.ctrChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.ctrChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.ctrChangePercent >= 0 ? "+" : ""}{summary.ctrChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Avg pos.<InfoTooltip title="Average position across all queries" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {summary.position != null ? summary.position.toFixed(1) : "—"}
        </span>
        {summary.positionChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.positionChangePercent <= 0 ? "text-positive" : "text-negative")}>
            {summary.positionChangePercent >= 0 ? "+" : ""}{summary.positionChangePercent}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">Queries<InfoTooltip title="Number of distinct queries that received clicks or impressions" /></span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {summary.queryCount != null ? formatNum(summary.queryCount) : "—"}
        </span>
        {summary.queryCountChangePercent != null && (
          <span className={cn("text-xs tabular-nums", summary.queryCountChangePercent >= 0 ? "text-positive" : "text-negative")}>
            {summary.queryCountChangePercent >= 0 ? "+" : ""}{summary.queryCountChangePercent}%
          </span>
        )}
      </div>
    </div>
  );
}

function buildInsightSentence(
  type: "query" | "page",
  direction: "growing" | "decaying",
  row: DataTableRow
): string {
  const label = type === "query" ? `The query '${row.key}'` : `The page '${row.key}'`;
  const pct = Math.abs(row.changePercent ?? 0);
  const posInfo =
    row.position != null
      ? direction === "growing" && row.position <= 10
        ? ` and is in the top 10 (pos ${row.position.toFixed(1)})`
        : ` at position ${row.position.toFixed(1)}`
      : "";
  if (direction === "growing") {
    return `${label} gained +${pct}% clicks${posInfo}.`;
  }
  return `${label} lost ${pct}% clicks${posInfo}.`;
}

function MovementIntelligence({
  queriesRows,
  pagesRows,
  trendFilter,
  onTrendFilterChange,
}: {
  queriesRows: DataTableRow[];
  pagesRows: DataTableRow[];
  trendFilter: TrendFilter;
  onTrendFilterChange: (t: TrendFilter) => void;
}) {
  const topGrowingQuery = useMemo(() => {
    return queriesRows
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  }, [queriesRows]);
  const topDecayingQuery = useMemo(() => {
    return queriesRows
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  }, [queriesRows]);
  const topGrowingPage = useMemo(() => {
    return pagesRows
      .filter((r) => (r.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  }, [pagesRows]);
  const topDecayingPage = useMemo(() => {
    return pagesRows
      .filter((r) => (r.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  }, [pagesRows]);

  const signals = [
    topGrowingQuery && { direction: "growing" as const, sentence: buildInsightSentence("query", "growing", topGrowingQuery) },
    topDecayingQuery && { direction: "decaying" as const, sentence: buildInsightSentence("query", "decaying", topDecayingQuery) },
    topGrowingPage && { direction: "growing" as const, sentence: buildInsightSentence("page", "growing", topGrowingPage) },
    topDecayingPage && { direction: "decaying" as const, sentence: buildInsightSentence("page", "decaying", topDecayingPage) },
  ].filter(Boolean) as { direction: "growing" | "decaying"; sentence: string }[];

  // Bold numeric parts in sentence: +N%, -N%, "top N", "pos N.N"
  const boldMetrics = (sentence: string) => {
    const parts = sentence.split(/([+-]?\d+(?:\.\d+)?%|top \d+|pos \d+(?:\.\d+)?)/gi);
    return parts.map((part, i) =>
      /^([+-]?\d+(?:\.\d+)?%|top \d+|pos \d+(?:\.\d+)?)$/i.test(part) ? (
        <span key={i} className="font-semibold text-foreground">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <section aria-label="Movement intelligence" className="rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-[120ms] hover:border-foreground/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Movement intelligence</h2>
        <div className="flex gap-0.5 rounded-md border border-input bg-background p-0.5">
          {(["all", "growing", "decaying", "new", "lost"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTrendFilterChange(t)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium capitalize transition-colors duration-[120ms]",
                trendFilter === t
                  ? "bg-background text-foreground border border-input"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {signals.length > 0 && (
        <div className="px-4 py-2.5 space-y-1 border-b border-border/50">
          {signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className={cn("mt-px shrink-0 text-xs", s.direction === "growing" ? "text-positive" : "text-negative")}>
                {s.direction === "growing" ? "↑" : "↓"}
              </span>
              <span>{boldMetrics(s.sentence)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-border/40">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-medium">AI summary</p>
        <p className="text-sm text-muted-foreground/60 italic">
          Detailed opportunity and trend summary will appear here. Coming soon.
        </p>
      </div>
    </section>
  );
}

export default function SiteDetailPage({
  params,
}: {
  params: { propertyId: string };
}) {
  const { propertyId } = params;
  const siteUrl = decodePropertyId(propertyId);
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "siteDetail",
      siteUrl,
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
    ],
    queryFn: () =>
      fetchSiteDetail(
        siteUrl,
        startDate,
        endDate,
        priorStartDate,
        priorEndDate
      ),
  });

  const [queriesTrendFilter, setQueriesTrendFilter] = useState<TrendFilter>("all");
  const [pagesTrendFilter, setPagesTrendFilter] = useState<TrendFilter>("all");
  const [compareToPrior, setCompareToPrior] = useState(false);
  const [showPercentView, setShowPercentView] = useState(true);
  const [contentFilterPattern, setContentFilterPattern] = useState("");
  const [contentFilterExclude, setContentFilterExclude] = useState(false);
  const [bandFilter, setBandFilter] = useState<BandFilter>(null);
  const trendChartContainerRef = useRef<HTMLDivElement>(null);
  const trendExportMenuRef = useRef<HTMLDivElement>(null);
  const [trendExportMenuOpen, setTrendExportMenuOpen] = useState(false);
  const [contentMounted, setContentMounted] = useState(false);
  const siteSlug = useMemo(() => {
    try {
      const host = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./, "");
      return host.replace(/\./g, "-").toLowerCase();
    } catch {
      return propertyId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    }
  }, [siteUrl, propertyId]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (trendExportMenuRef.current && !trendExportMenuRef.current.contains(e.target as Node)) setTrendExportMenuOpen(false);
    };
    if (trendExportMenuOpen) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [trendExportMenuOpen]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setContentMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const SEGMENTS_KEY = "consoleview_content_segments";
  const BRANDED_TERMS_KEY = `consoleview_branded_terms_${propertyId}`;
  type SavedSegment = { id: string; name: string; pattern: string };
  const [savedSegments, setSavedSegments] = useState<SavedSegment[]>([]);
  const [brandedTerms, setBrandedTerms] = useState<string[]>([]);
  const [brandedTermInput, setBrandedTermInput] = useState("");
  const [countriesDevicesOpen, setCountriesDevicesOpen] = useState(false);
  type AddMetricId = "countries" | "devices" | null;
  const [addedMetrics, setAddedMetrics] = useState<[AddMetricId, AddMetricId]>([null, null]);
  const [addMetricModalOpen, setAddMetricModalOpen] = useState(false);
  const [addMetricSlotTarget, setAddMetricSlotTarget] = useState<0 | 1 | null>(null);
  const [contentGroupsFullViewOpen, setContentGroupsFullViewOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SEGMENTS_KEY) : null;
      if (raw) setSavedSegments(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(BRANDED_TERMS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) setBrandedTerms(parsed);
      }
    } catch {
      // ignore
    }
  }, [BRANDED_TERMS_KEY]);
  const addBrandedTerm = () => {
    const t = brandedTermInput.trim().toLowerCase();
    if (!t || brandedTerms.includes(t)) return;
    const next = [...brandedTerms, t];
    setBrandedTerms(next);
    setBrandedTermInput("");
    try {
      localStorage.setItem(BRANDED_TERMS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const removeBrandedTerm = (term: string) => {
    const next = brandedTerms.filter((x) => x !== term);
    setBrandedTerms(next);
    try {
      localStorage.setItem(BRANDED_TERMS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const saveSegment = () => {
    if (contentGroupsFilteredPages.error || !contentFilterPattern.trim()) return;
    const next: SavedSegment[] = [
      ...savedSegments,
      { id: crypto.randomUUID?.() ?? String(Date.now()), name: contentFilterPattern.trim().slice(0, 30) || "Segment", pattern: contentFilterPattern.trim() },
    ];
    setSavedSegments(next);
    try {
      localStorage.setItem(SEGMENTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const queriesRows = useMemo<DataTableRow[]>(
    () =>
      data?.queries?.map((r: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }) => ({
        key: r.key,
        clicks: r.clicks,
        impressions: r.impressions,
        changePercent: r.changePercent,
        position: r.position,
      })) ?? [],
    [data?.queries]
  );
  const pagesRows = useMemo<DataTableRow[]>(
    () =>
      data?.pages?.map((r: { key: string; clicks: number; impressions: number; changePercent: number; position?: number }) => ({
        key: r.key,
        clicks: r.clicks,
        impressions: r.impressions,
        changePercent: r.changePercent,
        position: r.position,
      })) ?? [],
    [data?.pages]
  );
  const newQueriesRows: DataTableRow[] = (data?.newQueries ?? []).map((r: { key: string; clicks: number; impressions: number; changePercent?: number; position?: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
    position: r.position,
  }));
  const lostQueriesRows: DataTableRow[] = (data?.lostQueries ?? []).map((r: { key: string; clicks: number; impressions: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: undefined,
  }));
  const newPagesRows: DataTableRow[] = (data?.newPages ?? []).map((r: { key: string; clicks: number; impressions: number; changePercent?: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  }));
  const lostPagesRows: DataTableRow[] = (data?.lostPages ?? []).map((r: { key: string; clicks: number; impressions: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: undefined,
  }));
  const queriesRowsForTable = useMemo(() => {
    let rows = queriesTrendFilter === "new" ? newQueriesRows : queriesTrendFilter === "lost" ? lostQueriesRows : queriesRows;
    if (bandFilter) {
      rows = rows.filter((r) => r.position != null && r.position >= bandFilter.min && r.position <= bandFilter.max);
    }
    return rows;
  }, [queriesTrendFilter, queriesRows, newQueriesRows, lostQueriesRows, bandFilter]);
  const pagesRowsForTable = useMemo(() => {
    if (pagesTrendFilter === "new") return newPagesRows;
    if (pagesTrendFilter === "lost") return lostPagesRows;
    return pagesRows;
  }, [pagesTrendFilter, pagesRows, newPagesRows, lostPagesRows]);

  const queryCounting = useMemo(() => {
    const q = data?.queries ?? [];
    const withPos = q as { position?: number }[];
    return {
      total: q.length,
      top10: withPos.filter((r) => r.position != null && r.position <= 10).length,
      top3: withPos.filter((r) => r.position != null && r.position <= 3).length,
    };
  }, [data?.queries]);

  const dailyForCharts = useMemo(() => data?.daily ?? [], [data?.daily]);

  const brandedFromQueries = useMemo(() => {
    if (brandedTerms.length === 0) return null;
    const queries = data?.queries ?? [];
    let brandedClicks = 0;
    let nonBrandedClicks = 0;
    for (const r of queries as { key: string; clicks: number }[]) {
      const q = (r.key ?? "").toLowerCase();
      const isBranded = brandedTerms.some((t) => q.includes(t));
      if (isBranded) brandedClicks += r.clicks ?? 0;
      else nonBrandedClicks += r.clicks ?? 0;
    }
    return { brandedClicks, nonBrandedClicks };
  }, [data?.queries, brandedTerms]);

  const contentGroupsFilteredPages = useMemo(() => {
    const raw = contentFilterPattern.trim();
    if (!raw) return { pages: pagesRows, error: null };
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const patterns: RegExp[] = [];
    for (const p of parts) {
      try {
        patterns.push(new RegExp(p));
      } catch {
        return { pages: pagesRows, error: "Invalid regex" };
      }
    }
    if (patterns.length === 0) return { pages: pagesRows, error: null };
    const match = (key: string) => patterns.some((re) => re.test(key));
    const filtered = contentFilterExclude
      ? pagesRows.filter((p) => !match(p.key))
      : pagesRows.filter((p) => match(p.key));
    return { pages: filtered, error: null };
  }, [pagesRows, contentFilterPattern, contentFilterExclude]);

  const contentGroups = useMemo(() => {
    const source = contentGroupsFilteredPages.pages;
    const groups = new Map<string, { clicks: number; impressions: number; changes: number[] }>();
    for (const p of source) {
      try {
        const pathname = p.key.startsWith("http") ? new URL(p.key).pathname : p.key;
        const segment = pathname.split("/").filter(Boolean)[0] ?? "/";
        const label = segment || "(root)";
        const cur = groups.get(label) ?? { clicks: 0, impressions: 0, changes: [] };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        if (p.changePercent != null) cur.changes.push(p.changePercent);
        groups.set(label, cur);
      } catch {
        const cur = groups.get("(other)") ?? { clicks: 0, impressions: 0, changes: [] };
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
        if (p.changePercent != null) cur.changes.push(p.changePercent);
        groups.set("(other)", cur);
      }
    }
    return Array.from(groups.entries())
      .map(([label, agg]) => ({
        label,
        clicks: agg.clicks,
        impressions: agg.impressions,
        avgChangePercent: agg.changes.length > 0
          ? Math.round(agg.changes.reduce((s, v) => s + v, 0) / agg.changes.length)
          : undefined,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
  }, [contentGroupsFilteredPages.pages]);

  const countriesRows: DataTableRow[] = data?.countries?.map((r: { key: string; clicks: number; impressions: number; changePercent: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];
  const devicesRows: DataTableRow[] = data?.devices?.map((r: { key: string; clicks: number; impressions: number; changePercent: number }) => ({
    key: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  })) ?? [];

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header shareScope="project" shareScopeId={propertyId} />
        <main className="flex-1 p-4 md:p-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error instanceof Error ? error.message : "Something went wrong"}
          </div>
          <Link href="/" className="text-sm text-foreground underline mt-2 inline-block">
            Back to overview
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header shareScope="project" shareScopeId={propertyId} />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Overview
          </Link>
          <h1 className="mt-1 text-lg font-medium text-foreground truncate">
            {siteUrl}
          </h1>
        </div>

        {isLoading ? (
          <div className="space-y-5">
            <SkeletonBox className="h-24 border-b border-border pb-4" />
            <SkeletonBox className="h-80" />
            <SkeletonBox className="h-20" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <SkeletonBox className="h-64" />
                <SkeletonBox className="h-64" />
              </div>
              <div className="flex flex-col gap-5">
                <SkeletonBox className="h-64" />
                <SkeletonBox className="h-64" />
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("space-y-4 transition-opacity duration-200", contentMounted ? "opacity-100" : "opacity-0")}>
            {/* Section A — Header metric row + footprint summary */}
            <section aria-label="Overview" className="border-b border-border pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <HeaderMetricRow summary={data?.summary} formatNum={formatNum} />
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Queries in band</div>
                    <div className="text-sm font-semibold tabular-nums text-foreground mt-0.5">
                      Top 10: {queryCounting.top10} · Top 3: {queryCounting.top3}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section B — Trend: graph + Query Footprint in one row; then AI-Style + Position volatility */}
            {data?.daily?.length > 0 && (
              <section aria-label="Trend" className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 min-w-0">
                  <div className="rounded-lg border border-border bg-surface transition-colors duration-[120ms] hover:border-foreground/20 min-w-0 flex-1 flex flex-col min-h-[320px]">
                    {data?.summary && (
                      <MomentumScoreCard
                        variant="strip"
                        summary={{
                          clicksChangePercent: data.summary.clicksChangePercent,
                          positionChangePercent: data.summary.positionChangePercent,
                          queryCountChangePercent: data.summary.queryCountChangePercent,
                        }}
                      />
                    )}
                    <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap border-b border-border">
                      <h2 className="text-sm font-semibold text-foreground flex items-center gap-1">
                        Performance over time
                        <InfoTooltip title="Clicks and impressions from Google Search Console for the selected date range" />
                      </h2>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative" ref={trendExportMenuRef}>
                        <button
                          type="button"
                          onClick={() => setTrendExportMenuOpen((o) => !o)}
                          className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                          title="Export"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                        {trendExportMenuOpen && (
                          <div className="absolute right-0 top-full mt-0.5 z-20 min-w-[120px] rounded border border-border bg-surface py-1 shadow-lg">
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-1"
                              onClick={() => {
                                exportToCsv((data?.daily ?? []).map((d: { date: string; clicks: number; impressions?: number; ctr?: number; position?: number }) => ({
                                  date: d.date,
                                  clicks: d.clicks,
                                  impressions: d.impressions ?? 0,
                                  ctr: d.ctr ?? 0,
                                  position: d.position ?? "",
                                })), formatExportFilename(siteSlug, "performance-over-time", startDate, endDate));
                                setTrendExportMenuOpen(false);
                              }}
                            >
                              Export CSV
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-1"
                              onClick={() => {
                                exportChartToPng(trendChartContainerRef.current, formatExportFilename(siteSlug, "performance-over-time", startDate, endDate));
                                setTrendExportMenuOpen(false);
                              }}
                            >
                              Export PNG
                            </button>
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer transition-colors duration-[120ms]">
                        <input
                          type="checkbox"
                          checked={compareToPrior}
                          onChange={(e) => setCompareToPrior(e.target.checked)}
                          className="rounded border-border transition-all duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                        />
                        Compare to previous
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer transition-colors duration-[120ms]">
                        <input
                          type="checkbox"
                          checked={showPercentView}
                          onChange={(e) => setShowPercentView(e.target.checked)}
                          className="rounded border-border transition-all duration-[120ms] focus:ring-2 focus:ring-ring focus:ring-offset-1"
                        />
                        View as %
                      </label>
                      <SparkToggles />
                    </div>
                  </div>
                  <div ref={trendChartContainerRef} className="flex-1 min-h-0 px-4 pb-3 pt-2">
                    <TrendChart
                      data={data.daily}
                      priorData={data?.priorDaily}
                      height={280}
                      showImpressions
                      useSeriesContext
                      compareToPrior={compareToPrior}
                      normalizeWhenMultiSeries={showPercentView}
                    />
                  </div>
                  </div>
                  {queriesRows.length > 0 && (
                    <div className="w-full max-w-[320px] lg:w-[320px] lg:min-w-[280px] flex-shrink-0 flex flex-col min-h-[320px] lg:min-h-0">
                      <QueryFootprint
                        queries={queriesRows}
                        daily={dailyForCharts}
                        className="flex flex-col min-h-full"
                        onBandSelect={setBandFilter}
                        selectedBand={bandFilter}
                        compareToPrior={compareToPrior}
                      />
                    </div>
                  )}
                </div>
                {/* AI-Style Query Signals + Tracked Keywords: equal 2-column split (like Performance tables) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch min-w-0">
                  {queriesRows.length > 0 && (
                    <AiQuerySignalsCard queries={queriesRows} daily={data?.daily} />
                  )}
                  <div className="min-w-0">
                    <TrackedKeywordsSection
                      exportFilename={formatExportFilename(siteSlug, "keywords-tracked", startDate, endDate)}
                    />
                  </div>
                </div>
                {/* Position volatility + Branded vs non-branded: two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch min-w-0">
                  {data.daily.some((d: { position?: number }) => d.position != null) && (
                    <PositionVolatilityChart daily={data.daily} />
                  )}
                  <div className="rounded-lg border border-border bg-surface px-4 py-4 transition-colors hover:border-foreground/20 flex flex-col min-h-[320px] min-w-0">
                    <h2 className="text-sm font-semibold text-foreground mb-2">Branded vs non-branded</h2>
                    <p className="text-xs text-muted-foreground mb-1.5">Branded terms (queries containing these count as branded)</p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={brandedTermInput}
                        onChange={(e) => setBrandedTermInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBrandedTerm())}
                        placeholder="e.g. brand name"
                        className="rounded border border-border bg-background px-2 py-1 text-sm w-32 focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      />
                      <button
                        type="button"
                        onClick={addBrandedTerm}
                        className="rounded px-2 py-1 text-xs font-medium bg-background text-foreground border border-input hover:bg-accent transition-colors"
                      >
                        Add
                      </button>
                      {brandedTerms.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded bg-muted/70 px-2 py-0.5 text-xs text-foreground"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeBrandedTerm(t)}
                            className="text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-ring rounded"
                            aria-label={`Remove ${t}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex-1 min-h-[200px] min-w-0">
                      <BrandedChart
                        brandedClicks={brandedFromQueries?.brandedClicks ?? data?.branded?.brandedClicks ?? 0}
                        nonBrandedClicks={brandedFromQueries?.nonBrandedClicks ?? data?.branded?.nonBrandedClicks ?? (data?.summary?.clicks ?? 0)}
                        brandedChangePercent={brandedFromQueries ? undefined : data?.branded?.brandedChangePercent}
                        nonBrandedChangePercent={brandedFromQueries ? undefined : data?.branded?.nonBrandedChangePercent}
                        daily={data?.daily}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Query Footprint (full width when no daily data, so it still shows) */}
            {!data?.daily?.length && queriesRows.length > 0 && (
              <>
                <QueryFootprint
                  queries={queriesRows}
                  daily={dailyForCharts}
                  onBandSelect={setBandFilter}
                  selectedBand={bandFilter}
                />
                <AiQuerySignalsCard queries={queriesRows} />
              </>
            )}

            <div className="space-y-4">
            {/* Opportunity index (part of opportunities section) */}
            {queriesRows.length > 0 && (
              <OpportunityIndex
                queries={queriesRows}
                exportFilename={formatExportFilename(siteSlug, "opportunity-index", startDate, endDate)}
              />
            )}
            {/* Opportunity Intelligence */}
            {queriesRows.length > 0 && (
              <OpportunityIntelligence queries={queriesRows} />
            )}

            {/* Movement Intelligence */}
            <MovementIntelligence
              queriesRows={queriesRows}
              pagesRows={pagesRows}
              trendFilter={queriesTrendFilter}
              onTrendFilterChange={setQueriesTrendFilter}
            />
            </div>

            {/* Index signals + Cannibalisation (two columns like Performance tables) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-0">
                <IndexSignalsCard propertyId={propertyId} pagesRows={pagesRows} />
              </div>
              <CannibalisationCard
                siteUrl={siteUrl}
                startDate={startDate}
                endDate={endDate}
              />
            </div>

            {/* Section F — Performance tables + Query Counting + Content Groups */}
            <section aria-label="Performance tables" className="space-y-4">
              {bandFilter && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground bg-muted/60 rounded px-2 py-0.5">
                    Filtered by {bandFilter.min === 1 && bandFilter.max === 3 ? "Top 3" : bandFilter.min === 4 && bandFilter.max === 10 ? "Top 4–10" : bandFilter.min === 11 && bandFilter.max === 20 ? "Top 11–20" : bandFilter.min === 21 && bandFilter.max === 50 ? "Top 21–50" : "Top 50+"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBandFilter(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
                  >
                    Clear
                  </button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/80 mb-1" title="Shortcut coming soon">Press <kbd className="px-0.5 rounded bg-muted/50 font-mono text-[10px]">/</kbd> to search</p>
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
              Performance tables
              <InfoTooltip title="Top queries and pages by clicks and impressions" />
            </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-4 flex-1 min-w-0">
                  <DataTable
                    title="Queries"
                    titleTooltip="Top queries by clicks and impressions; filter by trend"
                    rows={queriesRowsForTable}
                    trendFilter={queriesTrendFilter}
                    onTrendFilterChange={setQueriesTrendFilter}
                    showFilter
                    onExportCsv={() => exportToCsv(queriesRowsForTable as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "queries", startDate, endDate))}
                  />
                  <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20 flex flex-col flex-1 min-h-0">
                    <div className="px-4 py-3 shrink-0 flex items-start justify-between gap-2">
                      <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1">Query counting<InfoTooltip title="Count of queries appearing in top 3 and top 10" /></h3>
                      <p className="text-xs text-muted-foreground mb-2">Queries in top 10</p>
                      <div className="flex flex-wrap gap-3 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Total queries</span>
                          <span className="ml-2 font-semibold tabular-nums text-foreground">{queryCounting.total}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Top 10</span>
                          <span className="ml-2 font-semibold tabular-nums text-foreground">{queryCounting.top10}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Top 3</span>
                          <span className="ml-2 font-semibold tabular-nums text-foreground">{queryCounting.top3}</span>
                        </div>
                      </div>
                      {queryCounting.total > 0 && (() => {
                        const top3 = queryCounting.top3;
                        const top4To10 = Math.max(0, queryCounting.top10 - queryCounting.top3);
                        const rest = Math.max(0, queryCounting.total - queryCounting.top10);
                        let chartData = [
                          { name: "Top 3", value: top3, fill: "var(--chart-clicks)" },
                          { name: "4–10", value: top4To10, fill: "var(--chart-impressions)" },
                          { name: "11+", value: rest, fill: "var(--muted-foreground)" },
                        ].filter((d) => d.value > 0);
                        if (chartData.length === 0) {
                          chartData = [{ name: "Queries", value: queryCounting.total, fill: "var(--chart-clicks)" }];
                        }
                        return (
                          <div className="h-16 w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 10 }} />
                                <Bar dataKey="value" radius={0} barSize={12}>
                                  {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => exportToCsv(
                          [
                            { metric: "Total queries", value: queryCounting.total },
                            { metric: "Top 10", value: queryCounting.top10 },
                            { metric: "Top 3", value: queryCounting.top3 },
                          ],
                          formatExportFilename(siteSlug, "query-counting", startDate, endDate)
                        )}
                        className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100 shrink-0"
                        title="Export CSV"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                    {dailyForCharts.length > 0 && (
                      <div className="flex-1 min-h-[200px] w-full min-w-0 border-t border-border/50 flex flex-col">
                        <p className="text-[10px] text-muted-foreground mb-1 px-4 pt-2 shrink-0">Performance trend</p>
                        <div className="flex-1 min-h-[180px] px-4 pb-3 w-full" style={{ minWidth: 0 }}>
                          <TrendChart
                            data={dailyForCharts}
                            height={200}
                            showImpressions
                            className="min-w-0 w-full h-full"
                            margin={{ top: 4, right: 0, left: 22, bottom: 12 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-0">
                  <DataTable
                    title="Pages"
                    titleTooltip="Top pages by clicks and impressions; filter by trend"
                    rows={pagesRowsForTable}
                    trendFilter={pagesTrendFilter}
                    onTrendFilterChange={setPagesTrendFilter}
                    showFilter
                    onExportCsv={() => exportToCsv(pagesRowsForTable as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "pages", startDate, endDate))}
                  />
                  {(contentFilterPattern.trim() || contentGroups.length > 0) && (() => {
                    const totalGroupClicks = contentGroups.reduce((s, g) => s + g.clicks, 0);
                    const totalSiteClicks = pagesRows.reduce((s, p) => s + p.clicks, 0);
                    const sharePct = totalSiteClicks > 0 ? Math.round((totalGroupClicks / totalSiteClicks) * 100) : 0;
                    const siteTrend = data?.summary?.clicksChangePercent;
                    const hasGroups = contentGroups.length > 0;
                    return (
                      <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-[120ms] hover:border-foreground/20 flex flex-col flex-1 min-h-0">
                        <div className="border-b border-border px-4 py-2.5 shrink-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">Content groups<InfoTooltip title="Group pages by path segment; filter by regex to analyse a subset" /></h3>
                            {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">Segment mode</span>
                            )}
                            {hasGroups && (
                              <button
                                type="button"
                                onClick={() => exportToCsv(contentGroups.map((g) => ({ label: g.label, clicks: g.clicks, impressions: g.impressions, avgChangePercent: g.avgChangePercent ?? "" })), formatExportFilename(siteSlug, "content-groups", startDate, endDate))}
                                className="p-1.5 rounded text-muted-foreground/80 hover:text-muted-foreground hover:bg-accent/50 transition-colors duration-[120ms] opacity-80 hover:opacity-100"
                                title="Export CSV"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {contentGroups.length} groups · {formatNum(totalGroupClicks)} clicks ({sharePct}% of total)
                            {siteTrend != null ? ` · Site trend ${siteTrend >= 0 ? "+" : ""}${siteTrend}%` : " · —"}
                          </p>
                          <label className="block text-xs text-muted-foreground mt-2 mb-1">Filter by path or URL regex (comma = OR)</label>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              placeholder="e.g. ^/blog/"
                              value={contentFilterPattern}
                              onChange={(e) => setContentFilterPattern(e.target.value)}
                              className={cn(
                                "flex-1 min-w-[140px] rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                                contentGroupsFilteredPages.error ? "border-negative" : "border-border"
                              )}
                            />
                            <div className="flex rounded border border-border bg-muted/30 p-0.5">
                              <button
                                type="button"
                                onClick={() => setContentFilterExclude(false)}
                                className={cn("rounded px-2 py-0.5 text-xs font-medium transition-colors duration-[120ms]", !contentFilterExclude ? "bg-background text-foreground border border-input" : "text-muted-foreground hover:bg-accent")}
                              >
                                Include
                              </button>
                              <button
                                type="button"
                                onClick={() => setContentFilterExclude(true)}
                                className={cn("rounded px-2 py-0.5 text-xs font-medium transition-colors duration-[120ms]", contentFilterExclude ? "bg-background text-foreground border border-input" : "text-muted-foreground hover:bg-accent")}
                              >
                                Exclude
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={saveSegment}
                              disabled={!!contentGroupsFilteredPages.error || !contentFilterPattern.trim()}
                              className="rounded border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors duration-[120ms]"
                            >
                              Save as segment
                            </button>
                            {contentGroupsFilteredPages.error && (
                              <span className="text-xs text-negative shrink-0">Invalid regex</span>
                            )}
                          </div>
                          {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && (() => {
                            const matched = contentGroupsFilteredPages.pages;
                            const n = matched.length;
                            const totalClicks = pagesRows.reduce((s, p) => s + p.clicks, 0);
                            const totalImpr = pagesRows.reduce((s, p) => s + p.impressions, 0);
                            const matchedClicks = matched.reduce((s, p) => s + p.clicks, 0);
                            const matchedImpr = matched.reduce((s, p) => s + p.impressions, 0);
                            const pctClicks = totalClicks > 0 ? Math.round((matchedClicks / totalClicks) * 100) : 0;
                            const pctImpr = totalImpr > 0 ? Math.round((matchedImpr / totalImpr) * 100) : 0;
                            const siteChanges = pagesRows.filter((p) => p.changePercent != null).map((p) => p.changePercent!);
                            const matchedChanges = matched.filter((p) => p.changePercent != null).map((p) => p.changePercent!);
                            const siteAvg = siteChanges.length ? Math.round(siteChanges.reduce((a, b) => a + b, 0) / siteChanges.length) : null;
                            const matchedAvg = matchedChanges.length ? Math.round(matchedChanges.reduce((a, b) => a + b, 0) / matchedChanges.length) : null;
                            const deltaVsSite = siteAvg != null && matchedAvg != null ? matchedAvg - siteAvg : null;
                            return (
                              <p className="text-xs text-muted-foreground mt-1">
                                {n} pages matched · {pctClicks}% of clicks · {pctImpr}% of impressions
                                {deltaVsSite != null ? ` · Matched Δ vs site: ${deltaVsSite >= 0 ? "+" : ""}${deltaVsSite}%` : " · Matched Δ vs site: —"}
                              </p>
                            );
                          })()}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {[
                              { label: "/blog", pattern: "^/blog" },
                              { label: "/products", pattern: "^/products" },
                              { label: "/category", pattern: "^/category" },
                              { label: "?utm", pattern: "\\?utm" },
                            ].map(({ label, pattern }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setContentFilterPattern(pattern)}
                                className="rounded border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms]"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {savedSegments.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Saved:</span>
                              {savedSegments.map((seg) => (
                                <button
                                  key={seg.id}
                                  type="button"
                                  onClick={() => setContentFilterPattern(seg.pattern)}
                                  className="rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-[120ms] truncate max-w-[120px]"
                                  title={seg.pattern}
                                >
                                  {seg.name || seg.pattern.slice(0, 15)}
                                </button>
                              ))}
                            </div>
                          )}
                          {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && data?.daily?.length > 0 && (() => {
                            const spark = (data.daily as { date: string; clicks: number }[]).slice(-14);
                            const vals = spark.map((d) => d.clicks);
                            const min = Math.min(...vals);
                            const max = Math.max(...vals);
                            const range = max - min || 1;
                            const pts = vals.map((v, i) => `${(i / (vals.length - 1 || 1)) * 80},${24 - ((v - min) / range) * 20}`);
                            return (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-muted-foreground shrink-0">Site trend (proxy)</span>
                                <svg width={80} height={24} className="shrink-0" aria-hidden>
                                  <polyline fill="none" stroke="var(--chart-clicks)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={pts.join(" ")} />
                                </svg>
                              </div>
                            );
                          })()}
                          {contentFilterPattern.trim() && !contentGroupsFilteredPages.error && (
                            <p className="text-xs text-muted-foreground mt-1">Grouped by: path (filtered)</p>
                          )}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                          <table className={TABLE_BASE_CLASS}>
                            <thead className={TABLE_HEAD_CLASS}>
                              <tr>
                                <th className={cn("px-4 font-semibold text-left min-w-0 w-[40%]", TABLE_CELL_Y)}>Name</th>
                                <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Clicks</th>
                                <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Impr.</th>
                                <th className={cn("px-4 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Change</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hasGroups ? (
                                contentGroups.slice(0, 10).map((g) => (
                                  <tr key={g.label} className={TABLE_ROW_CLASS}>
                                    <td className={cn("px-4 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={g.label}>/{g.label}</td>
                                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>{formatNum(g.clicks)}</td>
                                    <td className={cn("px-4 text-right tabular-nums", TABLE_CELL_Y)}>{formatNum(g.impressions)}</td>
                                    <td className={cn("px-4 text-right", TABLE_CELL_Y)}>
                                      {g.avgChangePercent != null ? (
                                        <span className={cn("tabular-nums", g.avgChangePercent >= 0 ? "text-positive" : "text-negative")}>
                                          {g.avgChangePercent >= 0 ? "+" : ""}{g.avgChangePercent}%
                                        </span>
                                      ) : "–"}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    No groups match the filter. Try a different path or regex.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {contentGroups.length > 10 && (
                            <div className="border-t border-border px-4 py-2 flex justify-center">
                              <button
                                type="button"
                                onClick={() => setContentGroupsFullViewOpen(true)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
                              >
                                View {contentGroups.length - 10} more
                              </button>
                            </div>
                          )}
                          <TableFullViewModal
                            open={contentGroupsFullViewOpen}
                            onClose={() => setContentGroupsFullViewOpen(false)}
                            title="Content groups"
                            rows={contentGroups.map((g) => ({ key: g.label, clicks: g.clicks, impressions: g.impressions, changePercent: g.avgChangePercent ?? undefined }))}
                            hasPosition={false}
                            onExportCsv={() => exportToCsv(contentGroups.map((g) => ({ label: g.label, clicks: g.clicks, impressions: g.impressions, avgChangePercent: g.avgChangePercent ?? "" })), formatExportFilename(siteSlug, "content-groups", startDate, endDate))}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              {false && (countriesRows.length > 0 || devicesRows.length > 0) && (
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCountriesDevicesOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-accent/50 transition-colors duration-100"
                    aria-expanded={countriesDevicesOpen}
                  >
                    <span>Countries &amp; Devices</span>
                    <svg
                      className={cn("w-4 h-4 text-muted-foreground transition-transform duration-150", countriesDevicesOpen && "rotate-180")}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {countriesDevicesOpen && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-border p-4">
                      {countriesRows.length > 0 && (
                        <DataTable
                          title="Countries"
                          rows={countriesRows}
                          showFilter={false}
                          onExportCsv={() => exportToCsv(countriesRows as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "countries", startDate, endDate))}
                        />
                      )}
                      {devicesRows.length > 0 && (
                        <DataTable
                          title="Devices"
                          rows={devicesRows}
                          showFilter={false}
                          onExportCsv={() => exportToCsv(devicesRows as unknown as Record<string, string | number | undefined>[], formatExportFilename(siteSlug, "devices", startDate, endDate))}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Add a metric (trial): two slots, modal to pick Countries/Devices */}
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
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
