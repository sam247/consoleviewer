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

const STORAGE_KEY = "consoleview-engine-selection";

const DEFAULT_ENGINES: SearchEngine[] = ["google"];

function loadSelectedEngines(): SearchEngine[] {
  if (typeof window === "undefined") return DEFAULT_ENGINES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((e) => e === "google" || e === "bing")) {
        return parsed.length > 0 ? parsed : DEFAULT_ENGINES;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_ENGINES;
}

type EngineSelectionContextValue = {
  selectedEngines: SearchEngine[];
  setSelectedEngines: (engines: SearchEngine[]) => void;
};

const EngineSelectionContext = createContext<EngineSelectionContextValue | null>(null);

export function EngineSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedEngines, setSelectedEnginesState] = useState<SearchEngine[]>(loadSelectedEngines);

  const setSelectedEngines = useCallback((engines: SearchEngine[]) => {
    const next = engines.length > 0 ? engines : DEFAULT_ENGINES;
    setSelectedEnginesState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  const value = useMemo(
    () => ({ selectedEngines, setSelectedEngines }),
    [selectedEngines, setSelectedEngines]
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
