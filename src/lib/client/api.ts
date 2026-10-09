import type { ParsedReceipt, ParsedRecord } from "../ai";
import type { AiStatus } from "../server/ollama";

export interface AiMeta {
  model: string;
  endpoint: string;
  durationMs: number;
  processor: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function postJson<T>(url: string, body: unknown, timeoutMs = 150_000): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, error: "Can't reach the LakbayMate app server on this computer. Is it still running?" };
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) return { ok: false, error: data?.error ?? `Request failed (${res.status}).` };
  return { ok: true, data };
}

export function quickLog(text: string, today: string) {
  return postJson<{ records: ParsedRecord[]; meta: AiMeta }>("/api/ai/quicklog", { text, today });
}

export function readReceipt(image: string, today: string) {
  return postJson<{ receipt: ParsedReceipt; meta: AiMeta }>("/api/ai/receipt", { image, today });
}

export function warmup() {
  return postJson<AiStatus>("/api/ai/warmup", {}, 240_000);
}

export async function getStatus(): Promise<AiStatus | null> {
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.ok ? ((await res.json()) as AiStatus) : null;
  } catch {
    return null;
  }
}

/** Streams the advisor's answer; calls onText with the full text so far. */
export async function askAdvisor(
  args: { question: string; context: string; history: { role: "user" | "assistant"; content: string }[] },
  onText: (text: string) => void,
): Promise<Result<{ text: string; meta: AiMeta }>> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch("/api/ai/advise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(150_000),
    });
  } catch {
    return { ok: false, error: "Can't reach the LakbayMate app server on this computer. Is it still running?" };
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? `Request failed (${res.status}).` };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(text);
    }
  } catch {
    return { ok: false, error: "The answer was interrupted. Please ask again." };
  }
  if (!text.trim()) return { ok: false, error: "The local model returned an empty answer. Please ask again." };
  return {
    ok: true,
    data: {
      text,
      meta: {
        model: res.headers.get("X-Kita-Model") ?? "unknown",
        endpoint: res.headers.get("X-Kita-Endpoint") ?? "unknown",
        processor: res.headers.get("X-Kita-Processor") ?? "unknown",
        durationMs: Date.now() - started,
      },
    },
  };
}

/** Shrinks a photo before sending it to the local vision model: faster, and phone photos can be 10+ MB. */
export async function imageToJpegBase64(file: File, maxSide = 1600): Promise<{ base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const previewUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: previewUrl.slice(previewUrl.indexOf(",") + 1), previewUrl };
}
