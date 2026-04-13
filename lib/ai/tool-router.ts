import type { AllowedAiMcpMethod } from "@/lib/mcp-client";

export type AiToolRoute = {
  method: AllowedAiMcpMethod;
  paramsBuilder: (input: { scope: "project" | "all_projects"; projectId?: string }) => Record<string, unknown>;
};

type Intent =
  | "movement_summary"
  | "biggest_losers"
  | "biggest_winners"
  | "opportunities"
  | "projects_attention";

type IntentRule = {
  intent: Intent;
  method: AllowedAiMcpMethod;
  phrases: string[];
};

const RULES: IntentRule[] = [
  {
    intent: "movement_summary",
    method: "get_movement_summary",
    phrases: ["what changed", "movement", "summary"],
  },
  {
    intent: "biggest_losers",
    method: "get_biggest_losers",
    phrases: ["losers", "decline", "dropped"],
  },
  {
    intent: "biggest_winners",
    method: "get_biggest_winners",
    phrases: ["winners", "gains", "growth"],
  },
  {
    intent: "opportunities",
    method: "get_opportunities",
    phrases: ["opportunities", "low hanging", "quick wins"],
  },
  {
    intent: "projects_attention",
    method: "get_projects_attention",
    phrases: ["projects", "attention", "which sites"],
  },
];

function score(text: string, phrases: string[]): number {
  let s = 0;
  for (const p of phrases) {
    if (text.includes(p)) s += p.includes(" ") ? 2 : 1;
  }
  return s;
}

function pickIntent(question: string): IntentRule | null {
  const normalized = question.toLowerCase().trim();
  if (!normalized) return null;
  let best: { rule: IntentRule; score: number } | null = null;
  for (const rule of RULES) {
    const s = score(normalized, rule.phrases);
    if (s <= 0) continue;
    if (!best || s > best.score) best = { rule, score: s };
  }
  return best?.rule ?? null;
}

export function routeAiIntent(question: string): AiToolRoute | null {
  const picked = pickIntent(question);
  if (!picked) return null;

  return {
    method: picked.method,
    paramsBuilder: ({ scope, projectId }) => ({
      scope,
      ...(scope === "project" && projectId ? { project_id: projectId } : {}),
      date_range: "last_7_days",
      compare: "previous_period",
    }),
  };
}
