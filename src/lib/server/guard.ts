/**
 * Wraps the hub's AI routes with the API contract in docs/API.md:
 * 415 unless the body is JSON, 413 for oversized bodies, 401 without the team access key,
 * 429 past the rate limit (with Retry-After), and X-RateLimit-* headers on every answer.
 */
import { checkAccess, TokenBucket, type Access } from "./limits";

/** Set LAKBAYMATE_HUB_KEY in .env.local to require a team access key; unset, the hub is open (local use). */
export const HUB_KEY = process.env.LAKBAYMATE_HUB_KEY?.trim() || undefined;

// One laptop GPU serves the whole team: bursts of 20, then 30 requests a minute per phone.
const bucket = new TokenBucket(20, 0.5);

export function accessFor(req: Request): Access {
  return checkAccess(req.headers.get("authorization"), HUB_KEY);
}

/** The phone on the hotspot, by address; requests from this laptop share one bucket. */
function clientId(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

function fail(status: number, error: string, kind: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error, kind }, { status, headers });
}

export function withGuard(
  handler: (req: Request) => Promise<Response>,
  opts: { auth?: boolean; json?: boolean; maxBytes?: number } = {},
): (req: Request) => Promise<Response> {
  const { auth = true, json = true, maxBytes = 64_000 } = opts;
  return async (req: Request) => {
    if (json && !/application\/json/i.test(req.headers.get("content-type") ?? "")) {
      return fail(415, "Send the body as JSON with Content-Type: application/json.", "unsupported-media-type");
    }
    if (Number(req.headers.get("content-length") ?? 0) > maxBytes) {
      return fail(413, "The request body is too large.", "payload-too-large");
    }
    if (auth) {
      const access = accessFor(req);
      if (access === "missing" || access === "wrong") {
        return fail(
          401,
          access === "missing" ? "This hub needs the team access key: Authorization: Bearer <key>." : "Wrong team access key.",
          "unauthorized",
          { "WWW-Authenticate": 'Bearer realm="LakbayMate Hub"' },
        );
      }
    }
    const r = bucket.take(clientId(req));
    const limits = {
      "X-RateLimit-Limit": String(r.limit),
      "X-RateLimit-Remaining": String(r.remaining),
      "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + r.resetSeconds),
    };
    if (!r.ok) {
      return fail(429, `Too many requests. Try again in ${r.retryAfterSeconds} s.`, "rate-limited", { ...limits, "Retry-After": String(r.retryAfterSeconds) });
    }
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(limits)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
