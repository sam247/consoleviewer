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
import type { DateRangeKey } from "@/types/gsc";
import { getDateRange } from "@/lib/date-range";

const STORAGE_KEY = "consoleview-date-range";

type DateRangeContextValue = {
  rangeKey: DateRangeKey;
  setRangeKey: (key: DateRangeKey) => void;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

const DEFAULT_RANGE: DateRangeKey = "3m";

const VALID_KEYS: DateRangeKey[] = ["7d", "28d", "30d", "3m", "6m", "12m", "16m", "qtd"];

function readStoredKey(): DateRangeKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && VALID_KEYS.includes(raw as DateRangeKey)) return raw as DateRangeKey;
  } catch {
    // ignore
  }
  return null;
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [rangeKey, setRangeKeyState] = useState<DateRangeKey>(DEFAULT_RANGE);

  useEffect(() => {
    const stored = readStoredKey();
    if (stored) setRangeKeyState(stored);
  }, []);

  const setRangeKey = useCallback((key: DateRangeKey) => {
    setRangeKeyState(key);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // ignore
    }
  }, []);

  const range = useMemo(() => getDateRange(rangeKey), [rangeKey]);

  const value = useMemo<DateRangeContextValue>(
    () => ({
      rangeKey,
      setRangeKey,
      startDate: range.startDate,
      endDate: range.endDate,
      priorStartDate: range.priorStartDate,
      priorEndDate: range.priorEndDate,
    }),
    [rangeKey, setRangeKey, range]
  );

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
