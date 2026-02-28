/**
 * Deterministic insight for dashboard card footer (Line 3).
 * No LLM; compressed console tone. Option to pipe structured insight to LLM later for wording only.
 */

const RANK_THRESHOLD = 0.8;
const TRAFFIC_THRESHOLD = 10; // % — render Line 3 if |clicksChangePercent| >= this
const CLICKS_FLAT_THRESHOLD = 5; // % below this = "flat" / "unchanged"

export interface FooterInsightInput {
  clicksChangePercent: number;
  impressionsChangePercent: number;
  avgTrackedRankDelta: number | null;
  keywords: { keyword: string; delta7d: number }[];
}

export type InsightCategory =
  | "rank_and_clicks_same_direction"
  | "rank_moved_clicks_flat"
  | "traffic_moved_rank_stable"
  | "avg_rank_moved_no_keyword"
  | "no_significant_movement";

export interface StructuredInsight {
  category: InsightCategory;
  keyword: string | null;
  keywordDelta7d: number | null;
  avgRankDelta: number | null;
  clicksChangePercent: number;
}

/**
 * Only render Line 3 when there is meaningful signal: keyword 7D >= 0.8 OR traffic >= 10%.
 */
function shouldRenderLine3(input: FooterInsightInput): boolean {
  const { clicksChangePercent, avgTrackedRankDelta, keywords } = input;
  const hasTrafficMovement = Math.abs(clicksChangePercent) >= TRAFFIC_THRESHOLD;
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
  return hasTrafficMovement || hasRankDelta || hasKeywordMovement;
}

export function getStructuredInsight(input: FooterInsightInput): StructuredInsight | null {
  if (!shouldRenderLine3(input)) return null;

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
  const trafficMoved = Math.abs(clicksChangePercent) >= TRAFFIC_THRESHOLD;
  const rankDown = (rankDelta ?? keywordDelta7d ?? 0) > 0;
  const rankUp = (rankDelta ?? keywordDelta7d ?? 0) < 0;
  const clicksDown = clicksChangePercent < -CLICKS_FLAT_THRESHOLD;
  const clicksUp = clicksChangePercent > CLICKS_FLAT_THRESHOLD;

  // 1. Rank moved + clicks moved same direction
  if ((rankDown && clicksDown) || (rankUp && clicksUp))
    return {
      category: "rank_and_clicks_same_direction",
      keyword: keyword ?? null,
      keywordDelta7d,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };

  // 2. Rank moved + clicks flat
  if ((rankDown || rankUp) && clicksFlat)
    return {
      category: "rank_moved_clicks_flat",
      keyword: keyword ?? null,
      keywordDelta7d,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };

  // 3. Traffic moved but rank stable (no significant rank/keyword)
  if (trafficMoved && !hasRankDelta && !hasKeywordMovement)
    return {
      category: "traffic_moved_rank_stable",
      keyword: null,
      keywordDelta7d: null,
      avgRankDelta: null,
      clicksChangePercent,
    };

  // 4. Avg rank moved but no major keyword shift
  if (hasRankDelta && !hasKeywordMovement)
    return {
      category: "avg_rank_moved_no_keyword",
      keyword: null,
      keywordDelta7d: null,
      avgRankDelta: rankDelta,
      clicksChangePercent,
    };

  return null;
}

const MAX_LENGTH = 110;

/**
 * Compressed console-style sentence. No sparkle, no emoji, no advice. Semicolon-separated.
 */
export function getFooterSummarySentence(insight: StructuredInsight): string | null {
  const k = insight.keyword;
  const d7 = insight.keywordDelta7d ?? insight.avgRankDelta;
  const d7Str =
    d7 != null
      ? (d7 > 0 ? "+" : "") + d7.toFixed(1)
      : null;
  const clicksPct =
    Math.abs(insight.clicksChangePercent) >= CLICKS_FLAT_THRESHOLD
      ? (insight.clicksChangePercent > 0 ? "+" : "") + insight.clicksChangePercent.toFixed(0) + "%"
      : null;

  let sentence: string;
  const shortK = k && k.length > 24 ? k.slice(0, 21) + "…" : k;

  switch (insight.category) {
    case "rank_and_clicks_same_direction":
      sentence =
        shortK && d7Str && clicksPct
          ? `'${shortK}' ${d7Str}; clicks ${clicksPct}.`
          : avgRankSentence(insight.avgRankDelta, `clicks ${clicksPct ?? "moved"}.`);
      break;
    case "rank_moved_clicks_flat":
      sentence =
        shortK && d7Str
          ? `'${shortK}' ${d7Str}; traffic stable.`
          : avgRankSentence(insight.avgRankDelta, "traffic stable.");
      break;
    case "traffic_moved_rank_stable":
      sentence = clicksPct ? `Clicks ${clicksPct}; no tracked rank shift.` : null;
      break;
    case "avg_rank_moved_no_keyword":
      sentence = avgRankSentence(insight.avgRankDelta, "traffic unchanged.");
      break;
    default:
      return null;
  }

  if (!sentence || sentence.length > MAX_LENGTH)
    sentence = sentence ? sentence.slice(0, MAX_LENGTH - 1).replace(/\.?$/, ".") : null;
  return sentence ?? null;
}

function avgRankSentence(delta: number | null, second: string): string {
  if (delta == null) return second;
  const s = (delta > 0 ? "+" : "") + delta.toFixed(1);
  return `Avg rank ${s}; ${second}`;
}

export function getAiFooterLine(input: FooterInsightInput): string | null {
  const structured = getStructuredInsight(input);
  if (!structured) return null;
  return getFooterSummarySentence(structured);
}
