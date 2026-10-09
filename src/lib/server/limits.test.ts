import { describe, expect, it } from "vitest";
import { hubErrorMessage, retryAfterSeconds } from "../apiErrors";
import { checkAccess, TokenBucket } from "./limits";

describe("token bucket rate limit", () => {
  it("allows a burst up to the capacity, then rejects with Retry-After", () => {
    let t = 0;
    const b = new TokenBucket(3, 0.5, () => t);
    expect([b.take("a"), b.take("a"), b.take("a")].map((r) => r.ok)).toEqual([true, true, true]);
    const blocked = b.take("a");
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(2);
  });

  it("refills over time and keeps clients apart", () => {
    let t = 0;
    const b = new TokenBucket(2, 0.5, () => t);
    b.take("a");
    b.take("a");
    expect(b.take("a").ok).toBe(false);
    expect(b.take("b").ok).toBe(true);
    t = 2000;
    expect(b.take("a").ok).toBe(true);
  });

  it("reports how long until the bucket is full", () => {
    const b = new TokenBucket(20, 0.5, () => 0);
    const r = b.take("a");
    expect(r.limit).toBe(20);
    expect(r.remaining).toBe(19);
    expect(r.resetSeconds).toBe(2);
  });
});

describe("team access key", () => {
  it("is open when the hub has no key", () => {
    expect(checkAccess(null, undefined)).toBe("open");
  });
  it("needs a Bearer token matching the key", () => {
    expect(checkAccess(null, "barkada")).toBe("missing");
    expect(checkAccess("Basic abc", "barkada")).toBe("missing");
    expect(checkAccess("Bearer nope", "barkada")).toBe("wrong");
    expect(checkAccess("Bearer barkada", "barkada")).toBe("ok");
    expect(checkAccess("bearer  barkada ", "barkada")).toBe("ok");
  });
});

describe("troubleshooting by status code", () => {
  it("tells the user what to do", () => {
    expect(hubErrorMessage(401)).toContain("team access key");
    expect(hubErrorMessage(429, undefined, 4)).toContain("4 seconds");
    expect(hubErrorMessage(503)).toContain("Ollama");
    expect(hubErrorMessage(400, "Send a prompt.")).toBe("Send a prompt.");
    expect(hubErrorMessage(418)).toContain("418");
  });
  it("reads Retry-After as seconds or a date", () => {
    expect(retryAfterSeconds("5")).toBe(5);
    expect(retryAfterSeconds("Sat, 10 Oct 2026 05:00:10 GMT", Date.parse("Sat, 10 Oct 2026 05:00:00 GMT"))).toBe(10);
    expect(retryAfterSeconds(null)).toBeUndefined();
  });
});
