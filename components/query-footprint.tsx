"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";
import { QueryFootprintContent, type BandFilter } from "@/components/query-footprint-content";

export type { BandFilter };

interface QueryFootprintProps {
  queries: DataTableRow[];
  daily: { date: string; clicks: number }[];
  className?: string;
  onBandSelect?: (band: BandFilter) => void;
  selectedBand?: BandFilter;
  compareToPrior?: boolean;
}

type FootprintView = "total" | "bands";

const BANDS = [
  { label: "Top 3", min: 1, max: 3, color: "var(--chart-clicks)" },
  { label: "4–10", min: 4, max: 10, color: "var(--chart-impressions)" },
  { label: "11–20", min: 11, max: 20, color: "var(--chart-ctr)" },
  { label: "21–50", min: 21, max: 50, color: "var(--chart-position)" },
  { label: "50+", min: 51, max: Infinity, color: "var(--muted-foreground)" },
];

function countInBand(queries: DataTableRow[], min: number, max: number): number {
  return queries.filter((r) => r.position != null && r.position >= min && r.position <= max).length;
}

export function QueryFootprint({ queries, daily, className, onBandSelect, selectedBand = null, compareToPrior }: QueryFootprintProps) {
  const [view, setView] = useState<FootprintView>("total");

  const withPosition = useMemo(() => queries.filter((r) => r.position != null), [queries]);
  const total = queries.length;
  const top3 = useMemo(() => countInBand(withPosition, 1, 3), [withPosition]);
  const top10 = useMemo(() => countInBand(withPosition, 1, 10), [withPosition]);
  const top20 = useMemo(() => countInBand(withPosition, 1, 20), [withPosition]);

  const bands = useMemo(
    () => BANDS.map((b) => ({ ...b, count: countInBand(withPosition, b.min, b.max) })),
    [withPosition]
  );

  const maxBandCount = Math.max(...bands.map((b) => b.count), 1);

  const sparkData = useMemo(
    () => daily.slice(-14).map((d) => ({ date: d.date, clicks: d.clicks })),
    [daily]
  );

  const pillStats = [
    { label: "Top 3", value: top3 },
    { label: "Top 10", value: top10 },
    { label: "Top 20", value: top20 },
    { label: "Total", value: total },
  ];

  const rootClassName = cn(
    "rounded-lg border border-border bg-surface transition-transform duration-[120ms] hover:border-foreground/20 hover:scale-[1.01] transform-gpu overflow-hidden",
    className
  );

  return (
    <QueryFootprintContent
      view={view}
      setView={setView}
      top10={top10}
      top3={top3}
      total={total}
      bands={bands}
      maxBandCount={maxBandCount}
      sparkData={sparkData}
      pillStats={pillStats}
      rootClassName={rootClassName}
      onBandSelect={onBandSelect}
      selectedBand={selectedBand}
      compareToPrior={compareToPrior}
    />
  );
}
