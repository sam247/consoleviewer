"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SparkSeriesKey = "clicks" | "impressions" | "ctr" | "position";

export type SparkSeriesState = Record<SparkSeriesKey, boolean>;

const STORAGE_KEY = "consoleview-spark-series";

const DEFAULT_SERIES: SparkSeriesState = {
  clicks: true,
  impressions: true,
  ctr: false,
  position: false,
};

function loadSeries(): SparkSeriesState {
  if (typeof window === "undefined") return DEFAULT_SERIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SERIES, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_SERIES;
}

type SparkSeriesContextValue = {
  series: SparkSeriesState;
  toggle: (key: SparkSeriesKey) => void;
};

const SparkSeriesContext = createContext<SparkSeriesContextValue | null>(null);

export function SparkSeriesProvider({ children }: { children: ReactNode }) {
  const [series, setSeries] = useState<SparkSeriesState>(loadSeries);

  const toggle = useCallback((key: SparkSeriesKey) => {
    setSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ series, toggle }),
    [series, toggle]
  );

  return (
    <SparkSeriesContext.Provider value={value}>
      {children}
    </SparkSeriesContext.Provider>
  );
}

export function useSparkSeries() {
  const ctx = useContext(SparkSeriesContext);
  if (!ctx) throw new Error("useSparkSeries must be used within SparkSeriesProvider");
  return ctx;
}
