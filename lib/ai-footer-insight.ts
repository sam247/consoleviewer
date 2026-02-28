/**
 * Operator-summary footer (Line 3): priority-driven, single dominant signal.
 * Deterministic; option to pass structured result to LLM for wording refinement only.
 */

const KEYWORD_THRESHOLD = 0.8; // |keyword 7D| >= this
const TRAFFIC_THRESHOLD = 10; // % — |clicks| or |impressions| >= this
const AVG_RANK_THRESHOLD = 0.5; // |avgTrackedRankDelta| >= this
const CLICKS_FLAT_THRESHOLD = 5; // % below this = "flat"

const MAX_LENGTH = 110;
const KEYWORD_MAX_LEN = 30;

export interface FooterInsightInput {
  clicksChangePercent: number;
  impressionsChangePercent: number;
  avgTrackedRankDelta: number | null;
  keywords: { keyword: string; delta7d: number }[];
}

export type DominantSignal =
  | "keyword_with_traffic"
  | "traffic_only"
  | "keyword_only"
  | "avg_rank_only";

export interface StructuredInsight {
  dominant: DominantSignal;
  keyword: string | null;
  keywordDelta7d: number | null;
  avgRankDelta: number | null;
  clicksChangePercent: number;
}

function shouldRenderLine3(input: FooterInsightInput): boolean {
  const { clicksChangePercent, impressionsChangePercent, avgTrackedRankDelta, keywords } = input;
  const trafficMag = Math.max(
    Math.abs(clicksChangePercent),
    Math.abs(impressionsChangePercent)
  );
  const hasTraffic = trafficMag >= TRAFFIC_THRESHOLD;
  const hasAvgRank =
    avgTrackedRankDelta != null && Math.abs(avgTrackedRankDelta) >= AVG_RANK_THRESHOLD;
  const largestKeyword =
    keywords.length > 0
      ? keywords.reduce((best, k) =>
          Math.abs(k.delta7d) > Math.abs(best.delta7d) ? k : best
        )
      : null;
  const hasKeyword =
    largestKeyword != null && Math.abs(largestKeyword.delta7d) >= KEYWORD_THRESHOLD;
  return hasTraffic || hasAvgRank || hasKeyword;
}

/**
 * Priority-driven: select the single most important signal for the operator summary.
 */
export function getStructuredInsight(input: FooterInsightInput): StructuredInsight | null {
  if (!shouldRenderLine3(input)) return null;

  const { clicksChangePercent, impressionsChangePercent, avgTrackedRankDelta, keywords } = input;
  const trafficMag = Math.max(
    Math.abs(clicksChangePercent),
    Math.abs(impressionsChangePercent)
  );
  const hasTraffic = trafficMag >= TRAFFIC_THRESHOLD;
  const hasAvgRank =
    avgTrackedRankDelta != null && Math.abs(avgTrackedRankDelta) >= AVG_RANK_THRESHOLD;
  const largestKeyword =
    keywords.length > 0
      ? keywords.reduce((best, k) =>
          Math.abs(k.delta7d) > Math.abs(best.delta7d) ? k : best
        )
      : null;
  const hasKeyword =
    largestKeyword != null && Math.abs(largestKeyword.delta7d) >= KEYWORD_THRESHOLD;

  const keyword = hasKeyword ? largestKeyword!.keyword : null;
  const keywordDelta7d = hasKeyword ? largestKeyword!.delta7d : null;
  const avgRankDelta = hasAvgRank ? avgTrackedRankDelta! : null;
  const clicksFlat = Math.abs(clicksChangePercent) < CLICKS_FLAT_THRESHOLD;

  // Same direction: rank worse (positive delta) and clicks down, or rank better (negative delta) and clicks up
  const rankWorse = (avgRankDelta ?? keywordDelta7d ?? 0) > 0;
  const rankBetter = (avgRankDelta ?? keywordDelta7d ?? 0) < 0;
  const clicksDown = clicksChangePercent < -CLICKS_FLAT_THRESHOLD;
  const clicksUp = clicksChangePercent > CLICKS_FLAT_THRESHOLD;
  const aligned = (rankWorse && clicksDown) || (rankBetter && clicksUp);

  // 1. Traffic above threshold AND (keyword or avg rank) above threshold and aligned → keyword + traffic
  if (hasTraffic && (hasKeyword || hasAvgRank) && aligned && keyword && keywordDelta7d != null)
    return {
      dominant: "keyword_with_traffic",
      keyword,
      keywordDelta7d,
      avgRankDelta,
      clicksChangePercent,
    };

  // 2. Traffic above threshold → traffic only
  if (hasTraffic)
    return {
      dominant: "traffic_only",
      keyword: null,
      keywordDelta7d: null,
      avgRankDelta: null,
      clicksChangePercent,
    };

  // 3. Keyword 7D above threshold, traffic flat → keyword only
  if (hasKeyword && clicksFlat && keyword && keywordDelta7d != null)
    return {
      dominant: "keyword_only",
      keyword,
      keywordDelta7d,
      avgRankDelta,
      clicksChangePercent,
    };

  // 4. Avg rank above threshold (no dominant keyword or traffic moved) → avg rank only
  if (hasAvgRank && avgRankDelta != null)
    return {
      dominant: "avg_rank_only",
      keyword: null,
      keywordDelta7d: null,
      avgRankDelta,
      clicksChangePercent,
    };

  return null;
}

/** Format rank/keyword delta: ↑ for improved (negative delta), ↓ for worse (positive delta). */
function arrowAndMag(delta: number): string {
  const mag = Math.abs(delta).toFixed(1);
  return delta < 0 ? `↑${mag}` : `↓${mag}`;
}

function truncateKeyword(k: string): string {
  return k.length > KEYWORD_MAX_LEN ? k.slice(0, KEYWORD_MAX_LEN - 1) + "…" : k;
}

/** Format clicks % with arrow: positive = ↑, negative = ↓. */
function clicksPctWithArrow(pct: number): string {
  const val = pct.toFixed(0) + "%";
  return pct >= 0 ? `↑${val}` : `↓${Math.abs(pct).toFixed(0)}%`;
}

/**
 * Compressed operator-summary sentence. ↑/↓ for rank and clicks; "The keyword '…'"; max 110 chars.
 */
export function getFooterSummarySentence(insight: StructuredInsight): string | null {
  const hasTrafficMove = Math.abs(insight.clicksChangePercent) >= CLICKS_FLAT_THRESHOLD;
  const clicksPct =
    hasTrafficMove
      ? clicksPctWithArrow(insight.clicksChangePercent)
      : null;

  let sentence: string | null = null;

  switch (insight.dominant) {
    case "keyword_with_traffic": {
      const k = truncateKeyword(insight.keyword!);
      const arrow = arrowAndMag(insight.keywordDelta7d!);
      sentence = clicksPct
        ? `The keyword '${k}' ${arrow}; clicks ${clicksPct}.`
        : `The keyword '${k}' ${arrow}; traffic moved.`;
      break;
    }
    case "traffic_only":
      sentence = clicksPct ? `Clicks ${clicksPct}; rank stable.` : null;
      break;
    case "keyword_only": {
      const k = truncateKeyword(insight.keyword!);
      const arrow = arrowAndMag(insight.keywordDelta7d!);
      sentence = `The keyword '${k}' ${arrow}; traffic flat.`;
      break;
    }
    case "avg_rank_only": {
      const arrow = arrowAndMag(insight.avgRankDelta!);
      sentence = `Avg rank ${arrow}; traffic flat.`;
      break;
    }
    default:
      return null;
  }

  if (sentence && sentence.length > MAX_LENGTH)
    sentence = sentence.slice(0, MAX_LENGTH - 1).replace(/\.?$/, ".");
  return sentence;
}

export function getAiFooterLine(input: FooterInsightInput): string | null {
  const structured = getStructuredInsight(input);
  if (!structured) return null;
  return getFooterSummarySentence(structured);
}
