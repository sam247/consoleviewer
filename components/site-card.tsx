"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SiteOverviewMetrics } from "@/types/gsc";
import { encodePropertyId } from "@/types/gsc";
import { Sparkline } from "./trend-chart";
import { useDateRange } from "@/contexts/date-range-context";
import { useHiddenProjects } from "@/contexts/hidden-projects-context";
import { usePinnedProjects } from "@/contexts/pinned-projects-context";
import { useSparkSeries } from "@/contexts/spark-series-context";
import { cn } from "@/lib/utils";

interface SiteCardProps {
  metrics: SiteOverviewMetrics;
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

/** Display like GSC/SEO Gets: xxx.com or https://xxx (no sc-domain: prefix) */
function displayUrl(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).replace(/\/$/, "");
  }
  return siteUrl.replace(/\/$/, "") || siteUrl;
}

/** Domain for favicon: sc-domain:example.com -> example.com; URL -> hostname */
function faviconDomain(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).replace(/\/$/, "");
  }
  try {
    return new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname;
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").split("/")[0] || siteUrl;
  }
}

/** Latest day and previous day from daily for "Sunday • 53 (-11) clicks" summary */
function getRecentDaySummary(daily: { date: string; clicks: number; impressions: number }[]) {
  if (!daily?.length) return null;
  const latest = daily[daily.length - 1];
  const prev = daily.length > 1 ? daily[daily.length - 2] : null;
  const dayName = new Date(latest.date).toLocaleDateString("en-GB", { weekday: "long" });
  const clickDelta = prev != null ? latest.clicks - prev.clicks : null;
  const impressionDelta = prev != null ? latest.impressions - prev.impressions : null;
  return { dayName, latest, clickDelta, impressionDelta };
}

const Favicon = ({ domain, className }: { domain: string; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- external favicon URL, dynamic domain
  <img
    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
    alt=""
    width={20}
    height={20}
    className={cn("shrink-0 rounded", className)}
  />
);

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg className={cn("size-4 shrink-0", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l1.5-4.5L2 13l4.5-1.5L5 7l1.5 4.5L11 13l-4.5 1.5L5 19z" />
    <path d="M19 19l-1.5-4.5L13 13l4.5-1.5L19 7l-1.5 4.5L13 13l4.5 1.5L19 19z" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={cn("size-4 shrink-0", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CTRIcon = ({ className }: { className?: string }) => (
  <span className={cn("text-xs font-medium shrink-0", className)} aria-hidden>%</span>
);

const PositionIcon = ({ className }: { className?: string }) => (
  <svg className={cn("size-3.5 shrink-0", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 17v-2h6v2H3zm0-4v-2h10v2H3zm0-4V7h14v2H3z" />
  </svg>
);

function CardMetricsRow({
  metrics,
  rankVariant,
}: {
  metrics: SiteOverviewMetrics;
  rankVariant: string | null;
}) {
  const { series } = useSparkSeries();
  const ctrPct = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
  const position = metrics.position;
  const positionChange = metrics.positionChangePercent;
  const avgRank = metrics.avgTrackedRank;
  const avgRankDelta = metrics.avgTrackedRankDelta;

  const cellClass = "min-w-0 flex flex-col items-center text-center gap-0.5";
  const valueClass = "text-sm font-semibold tabular-nums text-foreground truncate w-full";
  const labelClass = "text-[10px] text-muted-foreground uppercase tracking-wide";

  const cells: { key: string; label: string; content: ReactNode }[] = [];
  if (series.clicks) {
    cells.push({
      key: "clicks",
      label: "Clicks",
      content: (
        <>
          <div className="flex items-center justify-center gap-1">
            <SparkleIcon className="text-muted-foreground size-3" />
            <span className={valueClass}>{formatNum(metrics.clicks)}</span>
          </div>
          <div className="min-h-[1rem] flex items-center justify-center">
            <ChangeBadge value={metrics.clicksChangePercent} size="xs" />
          </div>
        </>
      ),
    });
  }
  if (series.impressions) {
    cells.push({
      key: "impressions",
      label: "Impr.",
      content: (
        <>
          <div className="flex items-center justify-center gap-1">
            <EyeIcon className="text-muted-foreground size-3" />
            <span className={valueClass}>{formatNum(metrics.impressions)}</span>
          </div>
          <div className="min-h-[1rem] flex items-center justify-center">
            <ChangeBadge value={metrics.impressionsChangePercent} size="xs" />
          </div>
        </>
      ),
    });
  }
  if (series.ctr) {
    cells.push({
      key: "ctr",
      label: "CTR",
      content: (
        <>
          <div className="flex items-center justify-center gap-1">
            <CTRIcon className="text-muted-foreground" />
            <span className={valueClass}>{ctrPct.toFixed(2)}%</span>
          </div>
          <div className="min-h-[1rem]" />
        </>
      ),
    });
  }
  if (series.position) {
    cells.push({
      key: "position",
      label: "Pos.",
      content: (
        <>
          <div className="flex items-center justify-center gap-1">
            <PositionIcon className="text-muted-foreground" />
            <span className={valueClass}>
              {position != null ? position.toFixed(1) : "—"}
            </span>
          </div>
          <div className="min-h-[1rem] flex items-center justify-center">
            {positionChange != null && <ChangeBadge value={positionChange} size="xs" />}
          </div>
        </>
      ),
    });
  }
  if (rankVariant === "kpi" && avgRank != null) {
    cells.push({
      key: "rank",
      label: "RANK",
      content: (
        <>
          <div className="flex items-center justify-center gap-1">
            <span className={valueClass}>{avgRank.toFixed(1)}</span>
          </div>
          <div className="min-h-[1rem] flex items-center justify-center">
            {avgRankDelta != null && (
              <span className={cn("text-xs tabular-nums", avgRankDelta < 0 ? "text-positive" : avgRankDelta > 0 ? "text-negative" : "text-muted-foreground")}>
                {avgRankDelta > 0 ? "+" : ""}{avgRankDelta}
              </span>
            )}
          </div>
        </>
      ),
    });
  }

  if (cells.length === 0) return null;

  return (
    <div
      className="grid gap-2 mb-4"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map(({ key, label, content }) => (
        <div key={key} className={cellClass}>
          {content}
          <span className={labelClass}>{label}</span>
        </div>
      ))}
    </div>
  );
}

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg className={cn("size-4 shrink-0 opacity-60", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

function StarButton({
  siteUrl,
  className,
}: {
  siteUrl: string;
  className?: string;
}) {
  const { isPinned, togglePin } = usePinnedProjects();
  const pinned = isPinned(siteUrl);
  return (
    <button
      type="button"
      aria-label={pinned ? "Unpin project" : "Pin project to top"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(siteUrl);
      }}
      className={cn(
        "shrink-0 rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        pinned ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <svg
        className="size-4"
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15 9 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 9 12 2" />
      </svg>
    </button>
  );
}

const KebabIcon = ({ className }: { className?: string }) => (
  <svg className={cn("size-4", className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="6" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="18" r="1.5" />
  </svg>
);

export function SiteCard({ metrics }: SiteCardProps) {
  const searchParams = useSearchParams();
  const rankVariant = searchParams.get("rankVariant");
  const propertyId = encodePropertyId(metrics.siteUrl);
  const href = `/sites/${propertyId}`;
  const queryClient = useQueryClient();
  const { startDate, endDate, priorStartDate, priorEndDate } = useDateRange();
  const { hide } = useHiddenProjects();
  const domain = faviconDomain(metrics.siteUrl);
  const recent = getRecentDaySummary(metrics.daily);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const prefetchDetail = () => {
    queryClient.prefetchQuery({
      queryKey: [
        "siteDetail",
        metrics.siteUrl,
        startDate,
        endDate,
        priorStartDate,
        priorEndDate,
      ],
      queryFn: async () => {
        const params = new URLSearchParams({
          site: metrics.siteUrl,
          startDate,
          endDate,
          priorStartDate,
          priorEndDate,
        });
        const res = await fetch(`/api/analytics/detail?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      },
    });
  };

  return (
    <Link
      href={href}
      onMouseEnter={prefetchDetail}
      title={metrics.siteUrl}
      className={cn(
        "block rounded-lg border border-border bg-surface p-5 transition-all duration-150 cursor-pointer",
        "hover:border-foreground/20 hover:shadow-sm hover:-translate-y-0.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {/* Domain row: favicon + domain + arrow + card menu */}
      <div className="flex items-center gap-2 mb-4">
        <Favicon domain={domain} />
        <span className="min-w-0 flex-1 font-medium text-foreground truncate text-sm" title={metrics.siteUrl}>
          {displayUrl(metrics.siteUrl)}
        </span>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label="Card options"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <KebabIcon />
          </button>
          {menuOpen && (
            <ul
              className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-md border border-border bg-surface py-1 shadow-lg"
              role="menu"
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hide(metrics.siteUrl);
                    setMenuOpen(false);
                  }}
                >
                  Hide project
                </button>
              </li>
            </ul>
          )}
        </div>
        <ArrowIcon />
      </div>

      {/* Metrics row: Clicks, Impressions, CTR, Position; optional RANK when rankVariant=kpi */}
      <CardMetricsRow metrics={metrics} rankVariant={rankVariant} />

      {/* Trend sparkline (clicks, impressions, optional CTR from toolbar toggles) */}
      <div className="pt-1 mb-4">
        <Sparkline
          data={metrics.daily.map((d) => ({
            ...d,
            ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
          }))}
        />
      </div>

      {/* Recent day summary; optional footer rank line when rankVariant=footer (or unset) */}
      {recent && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground min-w-0 break-words">
              <span className="font-medium text-foreground">{recent.dayName}</span>
              {" • "}
              <span className="text-foreground">{recent.latest.clicks}</span>
              {recent.clickDelta != null && (
                <span className={recent.clickDelta < 0 ? "text-negative" : "text-positive"}>
                  {" "}({recent.clickDelta >= 0 ? "+" : ""}{recent.clickDelta})
                </span>
              )}
              {" clicks • "}
              <span className="text-foreground">{formatNum(recent.latest.impressions)}</span>
              {recent.impressionDelta != null && (
                <span className={recent.impressionDelta < 0 ? "text-negative" : "text-positive"}>
                  {" "}({recent.impressionDelta >= 0 ? "+" : ""}{recent.impressionDelta})
                </span>
              )}
              {" impressions"}
            </p>
            {rankVariant !== "kpi" && metrics.avgTrackedRank != null && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Avg tracked rank: {metrics.avgTrackedRank.toFixed(1)}
                {metrics.avgTrackedRankDelta != null && (
                  <span className={metrics.avgTrackedRankDelta < 0 ? " text-positive" : metrics.avgTrackedRankDelta > 0 ? " text-negative" : ""}>
                    {" "}({metrics.avgTrackedRankDelta >= 0 ? "▲" : "▼"}
                    {Math.abs(metrics.avgTrackedRankDelta).toFixed(1)})
                  </span>
                )}
              </p>
            )}
          </div>
          <StarButton siteUrl={metrics.siteUrl} />
        </div>
      )}
    </Link>
  );
}

function ChangeBadge({
  value,
  size = "sm",
}: {
  value: number;
  size?: "xs" | "sm";
}) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={cn(
        size === "xs" ? "text-xs" : "text-sm",
        "text-right tabular-nums",
        positive ? "text-positive" : "text-negative"
      )}
    >
      {positive ? "+" : ""}{value}%
    </span>
  );
}
