export interface MomentumInput {
  clicksChangePercent?: number;
  positionChangePercent?: number;
  queryCountChangePercent?: number;
  /** Optional: % change in queries in top 10 (current vs prior). If not available, omitted from score. */
  top10ChangePercent?: number;
}

export interface MomentumResult {
  score: number;
  label: "Strong" | "Moderate" | "Neutral" | "Declining";
  subline: string;
}

const W_CLICKS = 0.4;
const W_POSITION = 0.3;
const W_QUERIES = 0.2;
const W_TOP10 = 0.1;

/** Composite momentum score from -100 to 100. Positive = improving. */
export function computeMomentumScore(input: MomentumInput): MomentumResult {
  const clicks = input.clicksChangePercent ?? 0;
  const positionImprove = input.positionChangePercent != null ? -input.positionChangePercent : 0;
  const queries = input.queryCountChangePercent ?? 0;
  const top10 = input.top10ChangePercent ?? 0;

  const hasTop10 = input.top10ChangePercent != null;
  const denom = hasTop10 ? 1 : 1 - W_TOP10;
  const raw =
    (W_CLICKS * clicks + W_POSITION * positionImprove + W_QUERIES * queries + (hasTop10 ? W_TOP10 * top10 : 0)) /
    denom;
  const score = Math.max(-100, Math.min(100, Math.round(raw)));

  let label: MomentumResult["label"] = "Neutral";
  if (score > 30) label = "Strong";
  else if (score > 10) label = "Moderate";
  else if (score < -10) label = "Declining";

  const parts: string[] = [];
  if (input.clicksChangePercent != null) parts.push(`Clicks ${input.clicksChangePercent >= 0 ? "+" : ""}${input.clicksChangePercent}%`);
  if (input.positionChangePercent != null) {
    parts.push(input.positionChangePercent <= 0 ? "position improving" : "position down");
  }
  if (input.queryCountChangePercent != null) {
    parts.push(`Queries ${input.queryCountChangePercent >= 0 ? "+" : ""}${input.queryCountChangePercent}%`);
  }
  const subline = parts.length > 0 ? parts.join(" · ") : "No change data";

  return { score, label, subline };
}
