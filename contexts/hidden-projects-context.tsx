"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "consoleview-hidden-sites";

function loadHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveHidden(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

type HiddenProjectsContextValue = {
  hiddenSet: Set<string>;
  isHidden: (siteUrl: string) => boolean;
  hide: (siteUrl: string) => void;
  unhide: (siteUrl: string) => void;
};

const HiddenProjectsContext = createContext<HiddenProjectsContextValue | null>(null);

export function HiddenProjectsProvider({ children }: { children: ReactNode }) {
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(loadHidden);

  useEffect(() => {
    const stored = loadHidden();
    setHiddenSet(stored);
  }, []);

  const hide = useCallback((siteUrl: string) => {
    setHiddenSet((prev) => {
      const next = new Set(prev);
      next.add(siteUrl);
      saveHidden(next);
      return next;
    });
  }, []);

  const unhide = useCallback((siteUrl: string) => {
    setHiddenSet((prev) => {
      const next = new Set(prev);
      next.delete(siteUrl);
      saveHidden(next);
      return next;
    });
  }, []);

  const isHidden = useCallback(
    (siteUrl: string) => hiddenSet.has(siteUrl),
    [hiddenSet]
  );

  const value = useMemo(
    () => ({ hiddenSet, isHidden, hide, unhide }),
    [hiddenSet, isHidden, hide, unhide]
  );

  return (
    <HiddenProjectsContext.Provider value={value}>
      {children}
    </HiddenProjectsContext.Provider>
  );
}

export function useHiddenProjects() {
  const ctx = useContext(HiddenProjectsContext);
  if (!ctx) throw new Error("useHiddenProjects must be used within HiddenProjectsProvider");
  return ctx;
}
