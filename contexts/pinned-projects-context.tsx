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

const STORAGE_KEY = "consoleview-pinned-sites";

function loadPinned(): Set<string> {
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

function savePinned(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

type PinnedProjectsContextValue = {
  pinnedSet: Set<string>;
  isPinned: (siteUrl: string) => boolean;
  togglePin: (siteUrl: string) => void;
};

const PinnedProjectsContext = createContext<PinnedProjectsContextValue | null>(null);

export function PinnedProjectsProvider({ children }: { children: ReactNode }) {
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(loadPinned);

  useEffect(() => {
    setPinnedSet(loadPinned());
  }, []);

  const togglePin = useCallback((siteUrl: string) => {
    setPinnedSet((prev) => {
      const next = new Set(prev);
      if (next.has(siteUrl)) next.delete(siteUrl);
      else next.add(siteUrl);
      savePinned(next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (siteUrl: string) => pinnedSet.has(siteUrl),
    [pinnedSet]
  );

  const value = useMemo(
    () => ({ pinnedSet, isPinned, togglePin }),
    [pinnedSet, isPinned, togglePin]
  );

  return (
    <PinnedProjectsContext.Provider value={value}>
      {children}
    </PinnedProjectsContext.Provider>
  );
}

export function usePinnedProjects() {
  const ctx = useContext(PinnedProjectsContext);
  if (!ctx) throw new Error("usePinnedProjects must be used within PinnedProjectsProvider");
  return ctx;
}
