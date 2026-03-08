import type { AllowedAiMcpMethod } from "@/lib/mcp-client";

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function dedupePreserveOrder(items: AllowedAiMcpMethod[]): AllowedAiMcpMethod[] {
  const seen = new Set<AllowedAiMcpMethod>();
  const out: AllowedAiMcpMethod[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function planTools(question: string): AllowedAiMcpMethod[] {
  const normalized = question.toLowerCase().trim();
  if (!normalized) return [];

  const sequence: AllowedAiMcpMethod[] = [];

  if (hasAny(normalized, ["traffic drop", "traffic dropped", "why traffic", "decline", "dropped"])) {
    sequence.push("explain_traffic_change");
  }

  if (hasAny(normalized, ["content idea", "content ideas", "topic ideas", "what should i write", "new content"])) {
    sequence.push("get_query_opportunities", "get_keyword_clusters", "suggest_content");
  }

  if (hasAny(normalized, ["site overview", "overview", "summary", "topline"])) {
    sequence.push("get_site_overview");
  }

  if (hasAny(normalized, ["page performance", "pages performance", "url performance", "top pages"])) {
    sequence.push("get_page_performance");
  }

  if (hasAny(normalized, ["recent changes", "movement", "movements", "ranking changes"])) {
    sequence.push("get_recent_changes");
  }

  if (hasAny(normalized, ["keyword cluster", "clusters", "themes", "query themes"])) {
    sequence.push("get_keyword_clusters");
  }

  return dedupePreserveOrder(sequence);
}
