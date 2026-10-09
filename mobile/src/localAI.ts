/**
 * Which local AI answers: Gemini Nano on this phone, or the team laptop's model (Gemma via Ollama)
 * reached over the laptop's hotspot or the same Wi-Fi. Never a cloud service. Every feature sends the
 * same prompt either way and applies the same code checks to the answer.
 */
import { useSyncExternalStore } from "react";
import { authHeaders, hubStatus } from "./hub";
import { hubErrorMessage, retryAfterSeconds } from "./shared";
import { useNano } from "./nanoStore";
import { nanoGenerate, OnDevice } from "./onDevice";

interface HubAI {
  url: string | null;
  reachable: boolean;
  model: string | null;
  /** The hub needs the team access key and ours is missing or wrong. */
  needsKey: boolean;
  /** Use the laptop even when this phone has Gemini Nano (to compare, or to share one model in a team). */
  prefer: boolean;
}

let hub: HubAI = { url: null, reachable: false, model: null, needsKey: false, prefer: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<HubAI>) => {
  hub = { ...hub, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function currentHub(): HubAI {
  return hub;
}

export function useHubAI(): HubAI {
  return useSyncExternalStore(subscribe, () => hub);
}

/** Checks the laptop hub; call when the app starts and whenever the hub address changes. */
export async function refreshHubAI(url: string | null): Promise<boolean> {
  if (!url) {
    set({ url: null, reachable: false, model: null, needsKey: false });
    return false;
  }
  const s = await hubStatus(url);
  // Usable only if Ollama is up and our access key (if the hub wants one) is right.
  const needsKey = s?.authorized === false;
  set({ url, reachable: !!s?.reachable && !needsKey, model: s?.text.name ?? null, needsKey });
  return !!s?.reachable && !needsKey;
}

export function setPreferHub(prefer: boolean) {
  set({ prefer });
}

export type AIKind = "nano" | "hub";

function pick(nanoReady: boolean): AIKind | null {
  if (hub.prefer && hub.reachable) return "hub";
  if (nanoReady) return "nano";
  return hub.reachable ? "hub" : null;
}

export interface LocalAI {
  available: boolean;
  kind: AIKind | null;
  /** "Gemini Nano" or "Gemma 3 4B". */
  name: string;
  /** "on this phone" or "on your laptop". */
  where: string;
}

const describe = (kind: AIKind | null): LocalAI => ({
  available: kind !== null,
  kind,
  name: kind === "hub" ? (hub.model ?? "laptop model").replace(/^gemma3:4b$/i, "Gemma 3 4B") : "Gemini Nano",
  where: kind === "hub" ? "on your laptop" : "on this phone",
});

export function useLocalAI(): LocalAI {
  const nano = useNano();
  useHubAI();
  return describe(pick(nano.status === "available"));
}

let nanoReadyNow = false;
/** Kept in sync by the app so non-React code (the engine) can route without a hook. */
export function setNanoReady(ready: boolean) {
  nanoReadyNow = ready;
}

export function currentAI(): LocalAI {
  return describe(pick(nanoReadyNow));
}

/** Same shape as Gemini Nano's answer, from whichever local AI is in use. */
export async function generate(
  prompt: string,
  opts: { temperature: number; maxOutputTokens: number; onText?: (soFar: string) => void },
): Promise<{ text: string; ms: number; firstTokenMs: number }> {
  const kind = pick(nanoReadyNow);
  if (kind === "nano" || (kind === null && OnDevice)) {
    // A stuck model must never freeze the app: after 30 s the caller falls back (ML Kit, phrasebook, rules).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("The phone's AI took too long; using the offline fallback.")), 30_000);
    });
    try {
      return await Promise.race([nanoGenerate(prompt, opts), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  const call = () =>
    fetch(`${hub.url}/api/ai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ prompt, temperature: opts.temperature, maxTokens: opts.maxOutputTokens }),
      signal: ctrl.signal,
    });
  try {
    let res = await call();
    // 429: the laptop is shared by the team. Wait as long as it asks (up to 10 s) and try once more.
    const wait = res.status === 429 ? retryAfterSeconds(res.headers.get("retry-after")) : undefined;
    if (wait !== undefined && wait <= 10) {
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await call();
    }
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok || typeof data.text !== "string") throw new Error(hubErrorMessage(res.status, data.error, retryAfterSeconds(res.headers.get("retry-after"))));
    opts.onText?.(data.text);
    const ms = Date.now() - started;
    return { text: data.text, ms, firstTokenMs: ms };
  } catch (e) {
    throw new Error(e instanceof Error && e.name === "AbortError" ? "The laptop AI took too long." : e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}
