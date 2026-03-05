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
const STORAGE_CUSTOM_START = "consoleview-custom-start";
const STORAGE_CUSTOM_END = "consoleview-custom-end";

type DateRangeContextValue = {
  rangeKey: DateRangeKey;
  setRangeKey: (key: DateRangeKey) => void;
  customStart: string;
  customEnd: string;
  setCustomDates: (start: string, end: string) => void;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

const DEFAULT_RANGE: DateRangeKey = "3m";

const VALID_KEYS: ReadonlySet<string> = new Set([
  "7d", "28d", "30d", "3m", "6m", "12m", "16m",
  "l90d", "mtd", "lm", "qtd", "lq", "ytd", "fy", "lfy", "custom",
]);

function readStored(key: string, validSet?: ReadonlySet<string>): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    if (validSet && !validSet.has(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [rangeKey, setRangeKeyState] = useState<DateRangeKey>(DEFAULT_RANGE);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    const stored = readStored(STORAGE_KEY, VALID_KEYS);
    if (stored) setRangeKeyState(stored as DateRangeKey);
    const cs = readStored(STORAGE_CUSTOM_START);
    const ce = readStored(STORAGE_CUSTOM_END);
    if (cs) setCustomStart(cs);
    if (ce) setCustomEnd(ce);
  }, []);

  const setRangeKey = useCallback((key: DateRangeKey) => {
    setRangeKeyState(key);
    writeStored(STORAGE_KEY, key);
  }, []);

  const setCustomDates = useCallback((start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    writeStored(STORAGE_CUSTOM_START, start);
    writeStored(STORAGE_CUSTOM_END, end);
    setRangeKeyState("custom");
    writeStored(STORAGE_KEY, "custom");
  }, []);

  const range = useMemo(
    () => getDateRange(rangeKey, customStart, customEnd),
    [rangeKey, customStart, customEnd]
  );

  const value = useMemo<DateRangeContextValue>(
    () => ({
      rangeKey,
      setRangeKey,
      customStart,
      customEnd,
      setCustomDates,
      startDate: range.startDate,
      endDate: range.endDate,
      priorStartDate: range.priorStartDate,
      priorEndDate: range.priorEndDate,
    }),
    [rangeKey, setRangeKey, customStart, customEnd, setCustomDates, range]
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
