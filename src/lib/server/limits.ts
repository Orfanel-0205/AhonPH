/**
 * The hub's API rules, as plain functions so they can be unit-tested: a token-bucket rate limit and
 * a team access key checked as a Bearer token. Used by guard.ts on every AI route.
 */

export interface BucketResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the bucket is full again. */
  resetSeconds: number;
  /** Seconds to wait before the next request can succeed (0 when ok). */
  retryAfterSeconds: number;
}

/**
 * Token bucket: each client holds up to `capacity` tokens and earns `refillPerSecond` back; a request
 * spends one. Bursts are allowed up to the capacity; a steady rate above the refill is rejected.
 */
export class TokenBucket {
  private buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    readonly capacity: number,
    readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): BucketResult {
    const t = this.now();
    const prev = this.buckets.get(key) ?? { tokens: this.capacity, at: t };
    const tokens = Math.min(this.capacity, prev.tokens + ((t - prev.at) / 1000) * this.refillPerSecond);
    const ok = tokens >= 1;
    const left = ok ? tokens - 1 : tokens;
    this.buckets.set(key, { tokens: left, at: t });
    return {
      ok,
      limit: this.capacity,
      remaining: Math.floor(left),
      resetSeconds: Math.ceil((this.capacity - left) / this.refillPerSecond),
      retryAfterSeconds: ok ? 0 : Math.ceil((1 - left) / this.refillPerSecond),
    };
  }
}

export type Access = "open" | "ok" | "missing" | "wrong";

/** Constant-time comparison, so a wrong key can't be guessed one character at a time from timing. */
function sameSecret(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** "open" when the hub has no key set; otherwise the Authorization header must be "Bearer <key>". */
export function checkAccess(authorization: string | null, key: string | undefined): Access {
  if (!key) return "open";
  const m = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!m) return "missing";
  return sameSecret(m[1].trim(), key) ? "ok" : "wrong";
}
