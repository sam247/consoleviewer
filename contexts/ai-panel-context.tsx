"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDateRange } from "@/contexts/date-range-context";

export type AiPanelScope = "dashboard" | "project";

export interface AiPanelContextData {
  scope: AiPanelScope;
  propertyId?: string;
  siteUrl?: string;
  startDate: string;
  endDate: string;
}

export interface AiPromptMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface AiPanelEntry {
  id: string;
  prompt: AiPromptMessage;
  response: AiPromptMessage;
}

interface AiPanelContextValue {
  isOpen: boolean;
  panelContext: AiPanelContextData | null;
  prompt: string;
  entries: AiPanelEntry[];
  openPanel: (
    nextContext: Omit<AiPanelContextData, "startDate" | "endDate">,
    trigger?: HTMLElement | null
  ) => void;
  closePanel: () => void;
  setPrompt: (value: string) => void;
  submitPrompt: (overridePrompt?: string) => void;
}

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

const MAX_ENTRIES = 20;

function buildPlaceholderResponse(prompt: string, context: AiPanelContextData | null): string {
  const clean = prompt.trim();
  if (!clean) return "Ask about movement, winners, losses, or anomalies and I’ll summarize it.";
  const scopeLabel = context?.scope === "project" ? "this project" : "all visible projects";
  return `Placeholder insight for ${scopeLabel}: "${clean}". MCP/DeepSeek wiring will replace this deterministic response.`;
}

export function AiPanelProvider({ children }: { children: ReactNode }) {
  const { startDate, endDate } = useDateRange();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [entries, setEntries] = useState<AiPanelEntry[]>([]);
  const [panelContext, setPanelContext] = useState<AiPanelContextData | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const openPanel = useCallback(
    (
      nextContext: Omit<AiPanelContextData, "startDate" | "endDate">,
      trigger?: HTMLElement | null
    ) => {
      if (trigger) lastTriggerRef.current = trigger;
      setPanelContext({
        ...nextContext,
        startDate,
        endDate,
      });
      setIsOpen(true);
    },
    [endDate, startDate]
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
    lastTriggerRef.current?.focus();
  }, []);

  const submitPrompt = useCallback(
    (overridePrompt?: string) => {
      const nextPrompt = (overridePrompt ?? prompt).trim();
      if (!nextPrompt) return;
      const now = Date.now();
      const entry: AiPanelEntry = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        prompt: { role: "user", text: nextPrompt, timestamp: now },
        response: {
          role: "assistant",
          text: buildPlaceholderResponse(nextPrompt, panelContext),
          timestamp: now + 1,
        },
      };
      setEntries((prev) => [...prev, entry].slice(-MAX_ENTRIES));
      setPrompt("");
    },
    [panelContext, prompt]
  );

  const value = useMemo<AiPanelContextValue>(
    () => ({
      isOpen,
      panelContext,
      prompt,
      entries,
      openPanel,
      closePanel,
      setPrompt,
      submitPrompt,
    }),
    [closePanel, entries, isOpen, openPanel, panelContext, prompt, submitPrompt]
  );

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
}

export function useAiPanel() {
  const ctx = useContext(AiPanelContext);
  if (!ctx) throw new Error("useAiPanel must be used within AiPanelProvider");
  return ctx;
}

