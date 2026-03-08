import type { AllowedAiMcpMethod } from "@/lib/mcp-client";

export type AiToolRoute = {
  method: AllowedAiMcpMethod;
  paramsBuilder: (input: { propertyId: string }) => Record<string, unknown>;
};

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

export function routeAiIntent(question: string): AiToolRoute | null {
  const normalized = question.toLowerCase().trim();
  if (!normalized) return null;

  if (hasAny(normalized, ["traffic drop", "traffic dropped", "why traffic", "decline", "dropped"])) {
    return {
      method: "explain_traffic_change",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  if (hasAny(normalized, ["content idea", "content ideas", "topic ideas", "what should i write", "new content"])) {
    return {
      method: "suggest_content",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  if (hasAny(normalized, ["opportunit", "quick wins", "keyword opportunities"])) {
    return {
      method: "get_query_opportunities",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  if (hasAny(normalized, ["site overview", "overview", "summary", "topline"])) {
    return {
      method: "get_site_overview",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  if (hasAny(normalized, ["page performance", "pages performance", "url performance", "top pages"])) {
    return {
      method: "get_page_performance",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  if (hasAny(normalized, ["recent changes", "movement", "movements", "ranking changes"])) {
    return {
      method: "get_recent_changes",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  if (hasAny(normalized, ["keyword cluster", "clusters", "themes", "query themes"])) {
    return {
      method: "get_keyword_clusters",
      paramsBuilder: ({ propertyId }) => ({ site: propertyId }),
    };
  }

  return null;
}
