"use client";

import { useSparkSeries, type SparkSeriesKey } from "@/contexts/spark-series-context";
import { cn } from "@/lib/utils";

const SERIES_CONFIG: {
  key: SparkSeriesKey;
  label: string;
  title: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "clicks",
    label: "Clicks",
    title: "Show clicks in sparklines",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      </svg>
    ),
  },
  {
    key: "impressions",
    label: "Impressions",
    title: "Show impressions in sparklines",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: "ctr",
    label: "CTR",
    title: "Show CTR in sparklines",
    icon: (
      <span className="text-xs font-medium" aria-hidden>%</span>
    ),
  },
  {
    key: "position",
    label: "Position",
    title: "Show average position in sparklines",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 17v-2h6v2H3zm0-4v-2h10v2H3zm0-4V7h14v2H3z" />
      </svg>
    ),
  },
];

export function SparkToggles() {
  const { series, toggle } = useSparkSeries();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Sparkline metrics">
      {SERIES_CONFIG.map(({ key, label, title, icon }) => (
        <button
          key={key}
          type="button"
          title={title}
          onClick={() => toggle(key)}
          className={cn(
            "rounded-md p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            series[key]
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
          aria-pressed={series[key]}
          aria-label={`${label}: ${series[key] ? "on" : "off"}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
