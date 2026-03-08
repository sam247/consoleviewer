const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

type RateBucket = {
  windowStart: number;
  count: number;
};

const buckets = new Map<string, RateBucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(userId: string, now = Date.now()): RateLimitResult {
  const current = buckets.get(userId);

  if (!current || now - current.windowStart >= WINDOW_MS) {
    buckets.set(userId, { windowStart: now, count: 1 });
    return { ok: true };
  }

  if (current.count >= MAX_REQUESTS) {
    return { ok: false, retryAfterMs: Math.max(0, WINDOW_MS - (now - current.windowStart)) };
  }

  current.count += 1;
  buckets.set(userId, current);
  return { ok: true };
}

export function __resetRateLimitForTests(): void {
  buckets.clear();
}
