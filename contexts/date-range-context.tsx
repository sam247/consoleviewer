"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DateRangeKey } from "@/types/gsc";
import { getDateRange } from "@/lib/date-range";

type DateRangeContextValue = {
  rangeKey: DateRangeKey;
  setRangeKey: (key: DateRangeKey) => void;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

const DEFAULT_RANGE: DateRangeKey = "28d";

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [rangeKey, setRangeKeyState] = useState<DateRangeKey>(DEFAULT_RANGE);
  const range = useMemo(
    () => getDateRange(rangeKey),
    [rangeKey]
  );

  const setRangeKey = useCallback((key: DateRangeKey) => {
    setRangeKeyState(key);
  }, []);

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
