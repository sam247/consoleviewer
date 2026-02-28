/**
 * Deterministic insight for dashboard card AI footer summary.
 * No LLM calls; output can later be passed to an LLM for wording refinement only.
 */

const RANK_THRESHOLD = 0.8;
const CLICKS_FLAT_THRESHOLD = 5; // % change below this = "flat"

export interface FooterInsightInput {
  clicksChangePercent: number;
  impressionsChangePercent: number;
  avgTrackedRankDelta: number | null;
  /** Top keywords with 7D delta; used to find largest movement */
  keywords: { keyword: string; delta7d: number }[];
}

export type InsightCategory =
  | "rank_down_clicks_down"
  | "rank_down_clicks_flat"
  | "rank_up_clicks_up"
  | "rank_up_clicks_flat"
  | "no_significant_movement";

export interface StructuredInsight {
  category: InsightCategory;
  /** Keyword with largest |delta7d|, if any */
  keyword: string | null;
  keywordDelta7d: number | null;
  avgRankDelta: number | null;
  clicksChangePercent: number;
}

/**
 * Compute structured insight from card data. Used for deterministic sentence generation
 * and can be passed to an LLM later for wording only.
 */
export function getStructuredInsight(input: FooterInsightInput): StructuredInsight | null {
  const { clicksChangePercent, avgTrackedRankDelta, keywords } = input;
  const hasRankDelta =
    avgTrackedRankDelta != null && Math.abs(avgTrackedRankDelta) >= RANK_THRESHOLD;
  const largestKeyword =
    keywords.length > 0
      ? keywords.reduce((best, k) =>
          Math.abs(k.delta7d) > Math.abs(best.delta7d) ? k : best
        )
      : null;
  const hasKeywordMovement =
    largestKeyword != null && Math.abs(largestKeyword.delta7d) >= RANK_THRESHOLD;

  const rankDelta = hasRankDelta ? avgTrackedRankDelta! : null;
  const keyword = hasKeywordMovement ? largestKeyword!.keyword : null;
  const keywordDelta7d = hasKeywordMovement ? largestKeyword!.delta7d : null;

  const clicksFlat = Math.abs(clicksChangePercent) < CLICKS_FLAT_THRESHOLD;
  const rankDown = (rankDelta ?? keywordDelta7d ?? 0) > 0; // position up = rank got worse
  const rankUp = (rankDelta ?? keywordDelta7d ?? 0) < 0;
  const clicksDown = clicksChangePercent < -CLICKS_FLAT_THRESHOLD;
  const clicksUp = clicksChangePercent > CLICKS_FLAT_THRESHOLD;

  if (!hasRankDelta && !hasKeywordMovement) return null;

  if (rankDown && clicksDown)
    return {
      category: "rank_down_clicks_down",
      keyword: keyword ?? null,
      keywordDelta7d,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };
  if (rankDown && clicksFlat)
    return {
      category: "rank_down_clicks_flat",
      keyword: keyword ?? null,
      keywordDelta7d,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };
  if (rankUp && clicksUp)
    return {
      category: "rank_up_clicks_up",
      keyword: keyword ?? null,
      keywordDelta7d,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };
  if (rankUp && clicksFlat)
    return {
      category: "rank_up_clicks_flat",
      keyword: keyword ?? null,
      keywordDelta7d,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };

  return null;
}

const MAX_LENGTH = 120;

/**
 * Generate one short sentence from structured insight. Deterministic; no LLM.
 * Returns null if no significant movement or sentence would exceed MAX_LENGTH.
 */
export function getFooterSummarySentence(insight: StructuredInsight): string | null {
  const k = insight.keyword;
  const d7 = insight.keywordDelta7d ?? insight.avgRankDelta;
  const absD7 = d7 != null ? Math.abs(d7).toFixed(1) : null;
  const dir = d7 != null && d7 < 0 ? "improved" : "dropped";
  const clicksPct =
    Math.abs(insight.clicksChangePercent) >= CLICKS_FLAT_THRESHOLD
      ? `${Math.abs(insight.clicksChangePercent).toFixed(0)}%`
      : null;

  let sentence: string;
  const avgAbs = insight.avgRankDelta != null ? Math.abs(insight.avgRankDelta).toFixed(1) : absD7;
  switch (insight.category) {
    case "rank_down_clicks_down":
      sentence =
        k && absD7
          ? `✨ '${k}' ${dir} ${absD7} positions; clicks are also down.`
          : `✨ Avg rank slipped ${insight.avgRankDelta?.toFixed(1) ?? absD7} and clicks are down.`;
      break;
    case "rank_down_clicks_flat":
      sentence =
        k && absD7
          ? `✨ '${k}' ${dir} ${absD7} positions; traffic stable.`
          : `✨ Avg rank slipped ${insight.avgRankDelta?.toFixed(1) ?? absD7} but traffic remains stable.`;
      break;
    case "rank_up_clicks_up":
      sentence =
        k && absD7 && clicksPct
          ? `✨ '${k}' ${dir} ${absD7} positions and clicks rose ${clicksPct}.`
          : `✨ Avg rank improved ${avgAbs ?? ""} and clicks rose ${clicksPct ?? ""}.`;
      break;
    case "rank_up_clicks_flat":
      sentence =
        k && absD7
          ? `✨ '${k}' ${dir} ${absD7} positions; traffic stable.`
          : `✨ Avg rank improved ${avgAbs ?? ""} but traffic remains stable.`;
      break;
    default:
      return null;
  }

  if (sentence.length > MAX_LENGTH) {
    // Truncate keyword if needed
    if (k && sentence.includes(`'${k}'`)) {
      const maxK = 20;
      const shortK = k.length > maxK ? k.slice(0, maxK - 2) + "…" : k;
      sentence = sentence.replace(`'${k}'`, `'${shortK}'`);
    }
    if (sentence.length > MAX_LENGTH) sentence = sentence.slice(0, MAX_LENGTH - 1) + ".";
  }
  return sentence;
}

/**
 * Get AI footer line for a card, or null if nothing to show.
 */
export function getAiFooterLine(input: FooterInsightInput): string | null {
  const structured = getStructuredInsight(input);
  if (!structured) return null;
  return getFooterSummarySentence(structured);
}
