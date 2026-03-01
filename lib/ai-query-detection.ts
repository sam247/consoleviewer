/**
 * Heuristics for AI/LLM-style queries (long-form, conversational).
 * Used for signals card and table filters.
 */

const LONG_FORM_REGEX = /^(?:\S+\s+){9,}\S+$/;
const CONVERSATIONAL_START =
  /^(how|what|why|can|should|is|are|does|do|best|which)\b/i;
const CONVERSATIONAL_PHRASES =
  /\b(how do i|what is the best|is it worth|can you|should i|difference between|cost of)\b/i;

export function isLongForm(query: string): boolean {
  return LONG_FORM_REGEX.test(query.trim());
}

export function isConversational(query: string): boolean {
  const q = query.trim();
  return CONVERSATIONAL_START.test(q) || CONVERSATIONAL_PHRASES.test(q);
}

export type QueryClass = "long" | "conversational" | "both" | "none";

const classifyCache = new Map<string, QueryClass>();

export function classifyQuery(query: string): QueryClass {
  const key = query;
  let result = classifyCache.get(key);
  if (result !== undefined) return result;
  const long = isLongForm(query);
  const conv = isConversational(query);
  result = long && conv ? "both" : long ? "long" : conv ? "conversational" : "none";
  classifyCache.set(key, result);
  return result;
}
