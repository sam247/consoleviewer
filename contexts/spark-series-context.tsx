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

const DEFAULT_SERIES: SparkSeriesState = {
  clicks: true,
  impressions: true,
  ctr: false,
  position: false,
};

type SparkSeriesContextValue = {
  series: SparkSeriesState;
  toggle: (key: SparkSeriesKey) => void;
};

const SparkSeriesContext = createContext<SparkSeriesContextValue | null>(null);

export function SparkSeriesProvider({ children }: { children: ReactNode }) {
  const [series, setSeries] = useState<SparkSeriesState>(DEFAULT_SERIES);

  const toggle = useCallback((key: SparkSeriesKey) => {
    setSeries((prev) => ({ ...prev, [key]: !prev[key] }));
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
