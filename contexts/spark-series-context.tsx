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

export type ChartOverlays = { bing: boolean };

export interface ChartSettings {
  metrics: SparkSeriesState;
  overlays: ChartOverlays;
}

const SERIES_STORAGE_KEY = "consoleview-spark-series";
const OVERLAYS_STORAGE_KEY = "consoleview-chart-overlays";

const DEFAULT_SERIES: SparkSeriesState = {
  clicks: true,
  impressions: true,
  ctr: false,
  position: false,
};

const DEFAULT_OVERLAYS: ChartOverlays = { bing: false };

function loadSeries(): SparkSeriesState {
  if (typeof window === "undefined") return DEFAULT_SERIES;
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SERIES, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_SERIES;
}

function loadOverlays(): ChartOverlays {
  if (typeof window === "undefined") return DEFAULT_OVERLAYS;
  try {
    const raw = localStorage.getItem(OVERLAYS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_OVERLAYS, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_OVERLAYS;
}

type SparkSeriesContextValue = {
  series: SparkSeriesState;
  toggle: (key: SparkSeriesKey) => void;
  setSeries: (next: SparkSeriesState) => void;
  overlays: ChartOverlays;
  setOverlay: (key: keyof ChartOverlays, value: boolean) => void;
};

const SparkSeriesContext = createContext<SparkSeriesContextValue | null>(null);

export function SparkSeriesProvider({ children }: { children: ReactNode }) {
  const [series, setSeries] = useState<SparkSeriesState>(loadSeries);
  const [overlays, setOverlaysState] = useState<ChartOverlays>(loadOverlays);

  const toggle = useCallback((key: SparkSeriesKey) => {
    setSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setSeriesState = useCallback((next: SparkSeriesState) => {
    setSeries(next);
    try { localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const setOverlay = useCallback((key: keyof ChartOverlays, value: boolean) => {
    setOverlaysState((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ series, toggle, setSeries: setSeriesState, overlays, setOverlay }),
    [series, toggle, setSeriesState, overlays, setOverlay]
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
