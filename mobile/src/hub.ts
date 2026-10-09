/**
 * Client for the optional LakbayMate Hub: the user's own laptop running Ollama, reached over local Wi-Fi.
 * No internet is involved; the phone talks to an address like http://192.168.1.20:3000.
 */
import { hubErrorMessage, retryAfterSeconds, type ParsedRecord } from "./shared";

let hubKey = "";
/** The team access key, sent as "Authorization: Bearer <key>" when the hub requires one. */
export function setHubKey(key: string) {
  hubKey = key.trim();
}
export function authHeaders(): Record<string, string> {
  return hubKey ? { Authorization: `Bearer ${hubKey}` } : {};
}

export interface HubStatus {
  reachable: boolean;
  endpoint: string;
  text: { name: string; loaded: boolean; processor: string };
  vision: { name: string; loaded: boolean; processor: string };
  /** "required" when AI requests need the team access key; `authorized` says if ours is right. */
  auth?: "open" | "required";
  authorized?: boolean;
}

async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export function normalizeHubUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `http://${u}`;
  if (u && !/:\d+$/.test(u.replace(/^https?:\/\//i, ""))) u = `${u}:3000`;
  return u;
}

export async function hubStatus(base: string): Promise<HubStatus | null> {
  try {
    const res = await withTimeout(`${base}/api/ai/status`, { headers: authHeaders() }, 4000);
    return res.ok ? ((await res.json()) as HubStatus) : null;
  } catch {
    return null;
  }
}

async function postJson<T>(url: string, body: unknown, ms: number): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await withTimeout(url, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) }, ms);
    const text = await res.text();
    if (!res.ok) {
      let server: string | undefined;
      try {
        server = (JSON.parse(text) as { error?: string }).error;
      } catch {
        server = undefined;
      }
      return { ok: false, error: hubErrorMessage(res.status, server, retryAfterSeconds(res.headers.get("retry-after"))) };
    }
    return { ok: true, data: (url.endsWith("/advise") ? text : JSON.parse(text)) as T };
  } catch {
    return { ok: false, error: "Can't reach the LakbayMate Hub. Check that the phone and laptop are on the same Wi-Fi." };
  }
}

export function hubQuickLog(base: string, text: string, today: string) {
  return postJson<{ records: ParsedRecord[]; meta: { model: string; durationMs: number; processor: string } }>(`${base}/api/ai/quicklog`, { text, today }, 60_000);
}

export interface HubReceipt {
  merchant: string;
  date: string;
  items: { name: string; quantity: number; lineTotalCentavos: number }[];
  totalCentavos: number;
  check: { status: "ok" | "repaired" | "mismatch" | "no-items"; itemsSumCentavos: number; totalCentavos: number };
}

export function hubReceipt(base: string, image: string, today: string) {
  return postJson<{ receipt: HubReceipt; meta: { model: string; durationMs: number; processor: string } }>(`${base}/api/ai/receipt`, { image, today }, 150_000);
}

export function hubAdvise(base: string, body: { question: string; context: string; history: { role: "user" | "assistant"; content: string }[] }) {
  return postJson<string>(`${base}/api/ai/advise`, body, 120_000);
}
