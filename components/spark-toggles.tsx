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

const bingIcon = (
  <svg className="size-4" viewBox="0 0 50 50" fill="currentColor" aria-hidden>
    <path d="M 45 26.101563 L 45 21 C 45 20.101563 44.398438 19.300781 43.601563 19.101563 L 39 17.699219 C 33.699219 16.101563 28.699219 14.699219 23.398438 13 C 23.398438 13 23.300781 13 23.300781 13 C 22.5 12.800781 21.699219 13.699219 22.101563 14.5 C 24 18.398438 26 24 26 24 L 32.699219 26.601563 C 32.398438 26.601563 11 38 11 38 L 20 30 L 20 7 C 20 6.101563 19.398438 5.199219 18.601563 5 C 18.601563 5 13.699219 3.101563 10.601563 2.101563 C 10.398438 2 10.199219 2 10 2 C 9.601563 2 9.199219 2.101563 8.800781 2.398438 C 8.300781 2.800781 8 3.398438 8 4 L 8 38.699219 C 8 39.398438 8.300781 40 8.898438 40.300781 C 11 41.800781 13.199219 43.300781 15.300781 44.800781 L 18.300781 46.898438 C 18.601563 47.101563 19 47.300781 19.398438 47.300781 C 19.800781 47.300781 20.101563 47.199219 20.398438 47 C 24.699219 44.398438 29.101563 41.800781 33.398438 39.199219 L 44 32.898438 C 44.601563 32.5 45 31.898438 45 31.199219 Z" />
  </svg>
);

export function SparkToggles() {
  const { series, toggle, engines, setEngine } = useSparkSeries();

  return (
    <div className="flex h-9 items-center gap-1">
      <div className="flex h-9 items-center gap-0.5 rounded-md border border-input bg-surface px-0.5" role="group" aria-label="Sparkline metrics and Bing overlay">
        {SERIES_CONFIG.map(({ key, label, title, icon }) => (
          <button
            key={key}
            type="button"
            title={title}
            onClick={() => toggle(key)}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              series[key]
                ? "border-border bg-background text-foreground"
                : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"
            )}
            aria-pressed={series[key]}
            aria-label={`${label}: ${series[key] ? "on" : "off"}`}
          >
            <span className="inline-flex size-4 shrink-0 items-center justify-center">{icon}</span>
          </button>
        ))}
        <button
          type="button"
          title={engines.bing ? "Hide Bing overlay" : "Show Bing overlay"}
          onClick={() => setEngine("bing", !engines.bing)}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            engines.bing
              ? "border-border bg-background text-foreground"
              : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"
          )}
          aria-pressed={engines.bing}
          aria-label={`Bing overlay: ${engines.bing ? "on" : "off"}`}
        >
          <span className="inline-flex size-4 shrink-0 items-center justify-center">{bingIcon}</span>
        </button>
      </div>
    </div>
  );
}
