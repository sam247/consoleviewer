import { displaySiteUrl } from "@/lib/site-url";

export type AiLedSegment = "questions" | "comparisons" | "long_tail" | "informational";

export type AiLedUiSegment = "all" | "questions" | "comparisons" | "long_tail";

export type AiLedQueryResult = {
  query: string;
  segments: AiLedSegment[];
  score: number;
  reasons: string[];
  clicks: number;
  impressions: number;
  clicksChangePercent?: number;
  impressionsChangePercent?: number;
};

export function getAiLedSegmentLabel(segment: AiLedUiSegment): string {
  switch (segment) {
    case "all":
      return "All";
    case "questions":
      return "Questions";
    case "comparisons":
      return "Comparisons";
    case "long_tail":
      return "Long-tail";
  }
}


const QUESTION_START = /^(why|how|what|when|where|who|which)\b/i;
const QUESTION_AUX = /\b(can|should|is|are|does|do|did|will|would|could)\b/i;
const HOW_TO = /\bhow to\b/i;
const WHY_IS = /\bwhy is\b/i;
const WHAT_IS = /\bwhat is\b/i;

const COMPARISON = /\b(best|top|vs|versus|compare|comparison)\b/i;
const WORTH_IT = /\bis\s+.*\s+worth\s+it\b/i;
const SHOULD_I = /\bshould\s+i\b/i;

const INFO_MOD = /\b(guide|tips|ideas|examples|meaning|definition)\b/i;
const DISCOVERY_PHRASES = /\b(things to do in|places to visit|how much does)\b/i;

const NAV_HINTS = /\b(login|sign in|contact|address|phone|opening times|hours|near me|map)\b/i;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function getBrandTokens(siteUrl?: string): Set<string> {
  if (!siteUrl) return new Set();
  const label = displaySiteUrl(siteUrl);
  const host = label.split("/")[0] ?? label;
  const parts = host
    .replace(/^www\./, "")
    .split(".")
    .filter(Boolean);
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const tokens = new Set<string>();
  tokenize(base ?? "").forEach((t) => tokens.add(t));
  tokenize(host).forEach((t) => tokens.add(t));
  return tokens;
}

function isBrandOnly(tokens: string[], brandTokens: Set<string>): boolean {
  if (tokens.length === 0) return true;
  if (tokens.length > 3) return false;
  const meaningful = tokens.filter((t) => t.length >= 3);
  if (meaningful.length === 0) return true;
  return meaningful.every((t) => brandTokens.has(t));
}

function isNavigational(query: string, tokens: string[]): boolean {
  if (/\bhttps?:\/\//i.test(query)) return true;
  if (/\bwww\./i.test(query)) return true;
  if (NAV_HINTS.test(query)) return true;
  if (tokens.length <= 2 && !QUESTION_START.test(query) && !HOW_TO.test(query) && !COMPARISON.test(query)) return true;
  return false;
}

export function scoreAiLedQuery({
  query,
  siteUrl,
}: {
  query: string;
  siteUrl?: string;
}): { score: number; segments: AiLedSegment[]; reasons: string[]; excluded: boolean } {
  const q = query.trim();
  const lc = q.toLowerCase();
  const tokens = tokenize(lc);
  const brandTokens = getBrandTokens(siteUrl);

  if (!q) return { score: 0, segments: [], reasons: ["empty"], excluded: true };
  if (isBrandOnly(tokens, brandTokens)) return { score: 0, segments: [], reasons: ["brand-only"], excluded: true };
  if (isNavigational(q, tokens)) return { score: 0, segments: [], reasons: ["navigational"], excluded: true };

  let score = 0;
  const segments = new Set<AiLedSegment>();
  const reasons: string[] = [];

  const hasQuestionStart = QUESTION_START.test(lc);
  const hasAux = QUESTION_AUX.test(lc) && /\?\s*$/.test(lc);
  const hasHowTo = HOW_TO.test(lc);
  const hasWhyIs = WHY_IS.test(lc);
  const hasWhatIs = WHAT_IS.test(lc);

  if (hasQuestionStart) {
    score += 6;
    segments.add("questions");
    reasons.push("question-start");
  }
  if (hasHowTo || hasWhyIs || hasWhatIs) {
    score += 5;
    segments.add("questions");
    reasons.push("question-phrase");
  }
  if (hasAux) {
    score += 4;
    segments.add("questions");
    reasons.push("question-aux");
  }

  const hasComparison = COMPARISON.test(lc) || WORTH_IT.test(lc) || SHOULD_I.test(lc);
  if (hasComparison) {
    score += 4;
    segments.add("comparisons");
    reasons.push("comparison");
  }

  if (INFO_MOD.test(lc)) {
    score += 2;
    segments.add("informational");
    reasons.push("informational");
  }
  if (DISCOVERY_PHRASES.test(lc)) {
    score += 3;
    segments.add("long_tail");
    reasons.push("discovery-phrase");
  }

  if (tokens.length >= 4) {
    score += 2;
    segments.add("long_tail");
    reasons.push("4+ words");
  } else if (tokens.length === 3) {
    score += 1;
    reasons.push("3 words");
  }

  const hasFirstPerson = /\b(i|my|me)\b/i.test(lc);
  if (hasFirstPerson) {
    score += 1;
    segments.add("long_tail");
    reasons.push("first-person");
  }

  const excluded = score < 6;
  return { score, segments: Array.from(segments), reasons, excluded };
}
