"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/data-table";
import { QueryFootprintContent, type BandFilter } from "@/components/query-footprint-content";

export type { BandFilter };

interface QueryFootprintProps {
  queries: DataTableRow[];
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

export function QueryFootprint({
  queries,
  className,
  onBandSelect,
  selectedBand = null,
  compareToPrior,
}: QueryFootprintProps) {
  const [view, setView] = useState<FootprintView>("total");

  const withPosition = useMemo(() => queries.filter((r) => r.position != null), [queries]);
  const total = queries.length;
  const firstPosition = useMemo(() => countInBand(withPosition, 1, 1), [withPosition]);
  const top3 = useMemo(() => countInBand(withPosition, 1, 3), [withPosition]);
  const top10 = useMemo(() => countInBand(withPosition, 1, 10), [withPosition]);
  const top20 = useMemo(() => countInBand(withPosition, 1, 20), [withPosition]);
  const top50 = useMemo(() => countInBand(withPosition, 1, 50), [withPosition]);
  const top100 = useMemo(() => countInBand(withPosition, 1, 100), [withPosition]);

  const bands = useMemo(
    () => BANDS.map((b) => ({ ...b, count: countInBand(withPosition, b.min, b.max) })),
    [withPosition]
  );

  const maxBandCount = Math.max(...bands.map((b) => b.count), 1);

  const pillStats = [
    { label: "First position", value: firstPosition },
    { label: "Top 3", value: top3 },
    { label: "Top 10", value: top10 },
    { label: "Top 20", value: top20 },
    { label: "Top 50", value: top50 },
    { label: "Top 100", value: top100 },
  ];

  const rootClassName = cn(
    "rounded-lg border border-border bg-surface transition-colors duration-[120ms] hover:border-foreground/20 overflow-hidden flex flex-col",
    className
  );

  return (
    <QueryFootprintContent
      view={view}
      setView={setView}
      total={total}
      bands={bands}
      maxBandCount={maxBandCount}
      pillStats={pillStats}
      rootClassName={rootClassName}
      onBandSelect={onBandSelect}
      selectedBand={selectedBand}
      compareToPrior={compareToPrior}
    />
  );
}
