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
import { callMcp, createMcpCallBudgetContext } from "@/lib/mcp-client";
import { routeAiIntent, routeFromIntent } from "@/lib/ai/tool-router";
import { shapeMcpResponse, uiResponseToText, type UiResponse } from "@/lib/ai/response-shaper";
import type { ToolName } from "@/mcp/types";

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
  ui?: UiResponse;
  method?: ToolName;
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
  isSubmitting: boolean;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const cacheRef = useRef<Map<string, { ui: UiResponse; method: ToolName }>>(new Map());

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
      const entryId = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: AiPanelEntry = {
        id: entryId,
        prompt: { role: "user", text: nextPrompt, timestamp: now },
        response: {
          role: "assistant",
          text: "Thinking…",
          timestamp: now + 1,
        },
      };
      setEntries((prev) => [...prev, entry].slice(-MAX_ENTRIES));
      setPrompt("");

      const ctx = panelContext;
      void (async () => {
        setIsSubmitting(true);
        try {
          if (!ctx) {
            throw new Error("No context available. Open the AI panel from a page with data.");
          }

          let route = routeAiIntent(nextPrompt);
          if (!route) {
            try {
              const controller = new AbortController();
              const t = setTimeout(() => controller.abort(), 1200);
              const res = await fetch("/api/ai/intent-router", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input: nextPrompt }),
                signal: controller.signal,
              });
              clearTimeout(t);
              const payload = (await res.json().catch(() => null)) as { intent?: string } | null;
              const intent = payload?.intent;
              if (
                intent === "movement_summary" ||
                intent === "biggest_losers" ||
                intent === "biggest_winners" ||
                intent === "opportunities" ||
                intent === "projects_attention" ||
                intent === "not_found_pages"
              ) {
                route = routeFromIntent(intent);
              }
            } catch {}
          }

          if (!route) {
            const clean = nextPrompt.toLowerCase();
            const looksLike404 =
              clean.includes("404") || clean.includes("not found") || clean.includes("status code");
            const responseText = looksLike404
              ? "I can’t export 404s yet — we don’t currently ingest HTTP status codes or crawl errors. I can help with movement, winners, losers, opportunities, or projects needing attention."
              : "I can help with movement, biggest losers, biggest winners, opportunities, or projects needing attention. Try one of those, or use the suggested chips.";
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      response: { role: "assistant", text: responseText, timestamp: Date.now() },
                    }
                  : e
              )
            );
            return;
          }

          const scope = ctx.scope === "project" ? "project" : "all_projects";
          const params = route.paramsBuilder({ scope, projectId: ctx.propertyId });
          const cacheKey = JSON.stringify({ method: route.method, scope, projectId: ctx.propertyId ?? null, dateRange: "last_7_days" });

          const cached = cacheRef.current.get(cacheKey);
          if (cached) {
            const responseText = uiResponseToText(cached.ui);
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      response: {
                        role: "assistant",
                        text: responseText,
                        ui: cached.ui,
                        method: cached.method,
                        timestamp: Date.now(),
                      },
                    }
                  : e
              )
            );
            return;
          }

          const budget = createMcpCallBudgetContext(4);
          const res = await callMcp(route.method, params, { timeoutMs: 2000, budgetContext: budget });

          let responseText: string;
          let ui: UiResponse | undefined;
          let method: ToolName | undefined;
          if (res.ok) {
            method = route.method as ToolName;
            ui = shapeMcpResponse(method, res.result);
            responseText = uiResponseToText(ui);
            cacheRef.current.set(cacheKey, { ui, method });
          } else {
            responseText = `MCP error (${res.type}): ${res.message}`;
          }

          setEntries((prev) =>
            prev.map((e) =>
              e.id === entryId
                ? {
                    ...e,
                    response: { role: "assistant", text: responseText, ui, method, timestamp: Date.now() },
                  }
                : e
            )
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Something went wrong.";
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entryId
                ? {
                    ...e,
                    response: { role: "assistant", text: message, timestamp: Date.now() },
                  }
                : e
            )
          );
        } finally {
          setIsSubmitting(false);
        }
      })();
    },
    [panelContext, prompt]
  );

  const value = useMemo<AiPanelContextValue>(
    () => ({
      isOpen,
      panelContext,
      prompt,
      entries,
      isSubmitting,
      openPanel,
      closePanel,
      setPrompt,
      submitPrompt,
    }),
    [closePanel, entries, isOpen, isSubmitting, openPanel, panelContext, prompt, submitPrompt]
  );

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
}

export function useAiPanel() {
  const ctx = useContext(AiPanelContext);
  if (!ctx) throw new Error("useAiPanel must be used within AiPanelProvider");
  return ctx;
}
