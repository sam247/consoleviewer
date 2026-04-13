"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAiPanel } from "@/contexts/ai-panel-context";
import { cn } from "@/lib/utils";
import { exportToCsv } from "@/lib/export-csv";
import { uiResponseToText, type UiResponse } from "@/lib/ai/response-shaper";

const DASHBOARD_PROMPTS = [
  "Which projects need attention?",
  "What changed across sites?",
  "Biggest declines across projects",
  "Top opportunities across sites",
];

const PROJECT_PROMPTS = [
  "What changed?",
  "Biggest losers",
  "Biggest winners",
  "Opportunities",
];

export function AiPanelShell() {
  const { isOpen, panelContext, prompt, setPrompt, submitPrompt, entries, closePanel, isSubmitting } = useAiPanel();
  const panelRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const contextLabel = useMemo(() => {
    if (!panelContext) return "No context";
    return panelContext.scope === "project" ? "For this site" : "Across all projects";
  }, [panelContext]);

  const suggestedPrompts = useMemo(() => {
    if (!panelContext) return [];
    return panelContext.scope === "project" ? PROJECT_PROMPTS : DASHBOARD_PROMPTS;
  }, [panelContext]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "button, [href], input, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const focusable = panelRef.current?.querySelector<HTMLElement>("input,button,textarea,[tabindex]:not([tabindex='-1'])");
    focusable?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePanel, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close AI panel"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={closePanel}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI insights panel"
        className={cn(
          "fixed right-0 top-0 z-50 h-dvh w-full max-w-[420px] border-l border-border bg-surface shadow-2xl",
          "translate-x-0 transition-transform duration-200"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">AI Insights</p>
              <p className="text-xs text-muted-foreground">{contextLabel}</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {entries.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                Ask about trends, winners, losses, or anomalies. This shell is ready for MCP-backed responses.
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="space-y-1.5">
                    <div className="rounded-md bg-accent px-2.5 py-2 text-xs text-foreground">
                      {entry.prompt.text}
                    </div>
                    <div className="rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground">
                      {entry.response.ui ? (
                        <div className="space-y-2">
                          {(() => {
                            const ui = entry.response.ui as UiResponse;
                            return (
                              <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-semibold text-foreground">{ui.summary}</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  const text = uiResponseToText(ui);
                                  try {
                                    await navigator.clipboard.writeText(text);
                                    setCopiedId(entry.id);
                                    setTimeout(() => setCopiedId((cur) => (cur === entry.id ? null : cur)), 1200);
                                  } catch {}
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground underline"
                              >
                                {copiedId === entry.id ? "Copied" : "Copy"}
                              </button>
                              {ui.csv && ui.csv.rows.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => exportToCsv(ui.csv!.rows, ui.csv!.filename)}
                                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                                >
                                  Export CSV
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {ui.sections
                            .filter((s: UiResponse["sections"][number]) => s.items.length > 0)
                            .map((section: UiResponse["sections"][number], idx: number) => (
                              <div key={`${entry.id}-sec-${idx}`} className="space-y-1">
                                {section.label ? <div className="text-[11px] text-muted-foreground">{section.label}</div> : null}
                                <div className="space-y-1">
                                  {section.items.map((item: UiResponse["sections"][number]["items"][number], itemIdx: number) => (
                                    <div key={`${entry.id}-item-${idx}-${itemIdx}`}>
                                      <div className="text-xs font-semibold text-foreground">{item.primary}</div>
                                      {item.meta.length ? (
                                        <div className="mt-0.5 text-[11px] text-muted-foreground">{item.meta.join(" • ")}</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{entry.response.text}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestedPrompts.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => submitPrompt(item)}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  disabled={isSubmitting}
                >
                  {item}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitPrompt();
              }}
            >
              <input
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask anything..."
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="h-10 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                disabled={!prompt.trim() || isSubmitting}
              >
                {isSubmitting ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
