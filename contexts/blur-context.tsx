"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BlurContextValue = {
  blurEnabled: boolean;
  setBlurEnabled: (enabled: boolean) => void;
  toggleBlur: () => void;
};

const BlurContext = createContext<BlurContextValue | null>(null);

const STORAGE_KEY = "consoleview_blur_global";

function readStoredBlur(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "1";
}

export function BlurProvider({ children }: { children: React.ReactNode }) {
  const [blurEnabled, setBlurEnabledState] = useState(false);

  useEffect(() => {
    setBlurEnabledState(readStoredBlur());
  }, []);

  const setBlurEnabled = useCallback((enabled: boolean) => {
    setBlurEnabledState(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    }
  }, []);

  const toggleBlur = useCallback(() => {
    setBlurEnabled(!blurEnabled);
  }, [blurEnabled, setBlurEnabled]);

  const value = useMemo(
    () => ({ blurEnabled, setBlurEnabled, toggleBlur }),
    [blurEnabled, setBlurEnabled, toggleBlur]
  );

  return <BlurContext.Provider value={value}>{children}</BlurContext.Provider>;
}

export function useBlur() {
  const ctx = useContext(BlurContext);
  if (!ctx) throw new Error("useBlur must be used within BlurProvider");
  return ctx;
}

