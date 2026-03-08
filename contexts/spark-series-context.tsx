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

export type ChartEngine = "google" | "bing";

export type EngineSelection = { google: boolean; bing: boolean };

export interface ChartSettings {
  metrics: SparkSeriesState;
  overlays: ChartOverlays;
  engines: EngineSelection;
}

const SERIES_STORAGE_KEY = "consoleview-spark-series";
const OVERLAYS_STORAGE_KEY = "consoleview-chart-overlays";
const ENGINES_STORAGE_KEY = "consoleview-chart-engines";

const DEFAULT_SERIES: SparkSeriesState = {
  clicks: true,
  impressions: true,
  ctr: false,
  position: false,
};

const DEFAULT_OVERLAYS: ChartOverlays = { bing: false };

const DEFAULT_ENGINES: EngineSelection = { google: true, bing: false };

function sanitizeSeries(input: Partial<SparkSeriesState> | null | undefined): SparkSeriesState {
  const next: SparkSeriesState = {
    clicks: input?.clicks === true,
    impressions: input?.impressions === true,
    ctr: input?.ctr === true,
    position: input?.position === true,
  };

  // Keep core GSC metrics as the fallback default when everything is disabled.
  if (!next.clicks && !next.impressions && !next.ctr && !next.position) {
    return { ...DEFAULT_SERIES };
  }
  return next;
}

function loadSeries(): SparkSeriesState {
  if (typeof window === "undefined") return DEFAULT_SERIES;
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return sanitizeSeries(parsed);
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

function loadEngines(): EngineSelection {
  if (typeof window === "undefined") return DEFAULT_ENGINES;
  try {
    const raw = localStorage.getItem(ENGINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const next = { ...DEFAULT_ENGINES, ...parsed };
      if (!next.google && !next.bing) return DEFAULT_ENGINES;
      // Google is always on (no Google toggle in UI); only Bing is user-togglable.
      if (!next.google) next.google = true;
      return next;
    }
    const overlays = loadOverlays();
    if (overlays.bing) return { google: true, bing: true };
  } catch { /* ignore */ }
  return DEFAULT_ENGINES;
}

type SparkSeriesContextValue = {
  series: SparkSeriesState;
  toggle: (key: SparkSeriesKey) => void;
  setSeries: (next: SparkSeriesState) => void;
  overlays: ChartOverlays;
  setOverlay: (key: keyof ChartOverlays, value: boolean) => void;
  engines: EngineSelection;
  setEngine: (engine: ChartEngine, value: boolean) => void;
};

const SparkSeriesContext = createContext<SparkSeriesContextValue | null>(null);

export function SparkSeriesProvider({ children }: { children: ReactNode }) {
  const [series, setSeries] = useState<SparkSeriesState>(loadSeries);
  const [overlays, setOverlaysState] = useState<ChartOverlays>(loadOverlays);
  const [engines, setEnginesState] = useState<EngineSelection>(loadEngines);

  const toggle = useCallback((key: SparkSeriesKey) => {
    setSeries((prev) => {
      const next = sanitizeSeries({ ...prev, [key]: !prev[key] });
      try { localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setSeriesState = useCallback((next: SparkSeriesState) => {
    const safeNext = sanitizeSeries(next);
    setSeries(safeNext);
    try { localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(safeNext)); } catch { /* ignore */ }
  }, []);

  const setOverlay = useCallback((key: keyof ChartOverlays, value: boolean) => {
    setOverlaysState((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setEngine = useCallback((engine: ChartEngine, value: boolean) => {
    setEnginesState((prev) => {
      const next = { ...prev, [engine]: value };
      const anyOn = next.google || next.bing;
      if (!anyOn) return prev;
      try { localStorage.setItem(ENGINES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ series, toggle, setSeries: setSeriesState, overlays, setOverlay, engines, setEngine }),
    [series, toggle, setSeriesState, overlays, setOverlay, engines, setEngine]
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
