"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SearchEngine = "google" | "bing";

export type EngineMode = "google" | "bing" | "both";

const STORAGE_KEY = "consoleview-engine-selection";
const LAST_SINGLE_KEY = "consoleview-engine-last-single";

const DEFAULT_MODE: EngineMode = "google";

function loadEngineMode(): EngineMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "google" || raw === "bing" || raw === "both") return raw;
  } catch { /* ignore */ }
  return DEFAULT_MODE;
}

function loadLastSingleEngine(): SearchEngine {
  if (typeof window === "undefined") return "google";
  try {
    const raw = localStorage.getItem(LAST_SINGLE_KEY);
    if (raw === "google" || raw === "bing") return raw;
  } catch { /* ignore */ }
  return "google";
}

type EngineSelectionContextValue = {
  engineMode: EngineMode;
  setEngineMode: (mode: EngineMode) => void;
  /** When mode is "both", rest of UI uses this; graph shows both. */
  effectiveEngine: SearchEngine;
  /** For graph: when mode is "both", show both; otherwise single series. */
  showBothOnGraph: boolean;
};

const EngineSelectionContext = createContext<EngineSelectionContextValue | null>(null);

export function EngineSelectionProvider({ children }: { children: ReactNode }) {
  const [engineMode, setEngineModeState] = useState<EngineMode>(loadEngineMode);
  const [lastSingleEngine, setLastSingleEngine] = useState<SearchEngine>(loadLastSingleEngine);

  const setEngineMode = useCallback((mode: EngineMode) => {
    setEngineModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
    if (mode === "google" || mode === "bing") {
      setLastSingleEngine(mode);
      try {
        localStorage.setItem(LAST_SINGLE_KEY, mode);
      } catch { /* ignore */ }
    }
  }, []);

  const effectiveEngine: SearchEngine = engineMode === "both" ? lastSingleEngine : engineMode;
  const showBothOnGraph = engineMode === "both";

  const value = useMemo(
    () => ({
      engineMode,
      setEngineMode,
      effectiveEngine,
      showBothOnGraph,
    }),
    [engineMode, setEngineMode, effectiveEngine, showBothOnGraph]
  );

  return (
    <EngineSelectionContext.Provider value={value}>
      {children}
    </EngineSelectionContext.Provider>
  );
}

export function useEngineSelection() {
  const ctx = useContext(EngineSelectionContext);
  if (!ctx) throw new Error("useEngineSelection must be used within EngineSelectionProvider");
  return ctx;
}

export function useEngineSelectionOptional() {
  return useContext(EngineSelectionContext);
}
