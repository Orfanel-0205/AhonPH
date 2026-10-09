/**
 * Thin client for the local Ollama server. Every AI call in KitaPH goes through here,
 * and this only ever talks to the machine's own Ollama (127.0.0.1 by default).
 */

export const OLLAMA_URL = (process.env.KITAPH_OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
export const OLLAMA_ENDPOINT_LABEL = new URL(OLLAMA_URL).host;

export const MODELS = {
  text: process.env.KITAPH_TEXT_MODEL ?? "gemma3:4b",
  vision: process.env.KITAPH_VISION_MODEL ?? "qwen3-vl:2b",
};

/** Keep models in GPU memory so the demo never waits for a cold load. */
const KEEP_ALIVE = "2h";

export type OllamaErrorKind = "unreachable" | "model-missing" | "timeout" | "bad-response";

export class OllamaError extends Error {
  constructor(
    message: string,
    public kind: OllamaErrorKind,
  ) {
    super(message);
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Base64 images (no data: prefix), for vision models. */
  images?: string[];
}

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  /** JSON schema: Ollama constrains the output to match it. */
  format?: object;
  temperature?: number;
  numPredict?: number;
  timeoutMs?: number;
}

function body(o: ChatOptions, stream: boolean) {
  return JSON.stringify({
    model: o.model,
    messages: o.messages,
    stream,
    think: false,
    keep_alive: KEEP_ALIVE,
    ...(o.format ? { format: o.format } : {}),
    options: { temperature: o.temperature ?? 0, ...(o.numPredict ? { num_predict: o.numPredict } : {}) },
  });
}

async function post(path: string, payload: string, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new OllamaError(`The local model took longer than ${Math.round(timeoutMs / 1000)}s.`, "timeout");
    }
    throw new OllamaError("Ollama is not running on this computer. Start the Ollama app and try again.", "unreachable");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || /not found/i.test(text)) {
      throw new OllamaError(`A required model is not installed. Run: ollama pull ${JSON.parse(payload).model}`, "model-missing");
    }
    throw new OllamaError(`Ollama returned ${res.status}: ${text.slice(0, 200)}`, "bad-response");
  }
  return res;
}

export async function chat(o: ChatOptions): Promise<{ content: string; durationMs: number }> {
  const started = Date.now();
  const res = await post("/api/chat", body(o, false), o.timeoutMs ?? 120_000);
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  if (!content.trim()) throw new OllamaError("The local model returned an empty answer. Please try again.", "bad-response");
  return { content, durationMs: Date.now() - started };
}

/** Streams the assistant's text as plain UTF-8 chunks. */
export async function chatStream(o: ChatOptions): Promise<ReadableStream<Uint8Array>> {
  const res = await post("/api/chat", body(o, true), o.timeoutMs ?? 120_000);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const nl = buffer.indexOf("\n");
        if (nl >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
          if (msg.error) return controller.error(new OllamaError(msg.error, "bad-response"));
          if (msg.message?.content) controller.enqueue(encoder.encode(msg.message.content));
          if (msg.done) return controller.close();
          return;
        }
        const { value, done } = await reader.read();
        if (done) return controller.close();
        buffer += decoder.decode(value, { stream: true });
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

interface PsModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
}

async function getJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${OLLAMA_URL}${path}`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    throw new OllamaError("Ollama is not running on this computer.", "unreachable");
  }
}

function describeProcessor(m: PsModel | undefined): string {
  if (!m) return "not loaded";
  const pct = m.size > 0 ? Math.round((m.size_vram / m.size) * 100) : 0;
  if (pct >= 100) return "GPU";
  if (pct <= 0) return "CPU";
  return `${pct}% GPU / ${100 - pct}% CPU`;
}

export async function processorFor(model: string): Promise<string> {
  try {
    const ps = await getJson<{ models: PsModel[] }>("/api/ps");
    return describeProcessor(ps.models.find((m) => m.name === model || m.model === model));
  } catch {
    return "unknown";
  }
}

export interface ModelStatus {
  name: string;
  installed: boolean;
  loaded: boolean;
  processor: string;
  vramMB: number;
}

export interface AiStatus {
  reachable: boolean;
  version: string | null;
  endpoint: string;
  text: ModelStatus;
  vision: ModelStatus;
}

export async function getStatus(): Promise<AiStatus> {
  const empty = (name: string): ModelStatus => ({ name, installed: false, loaded: false, processor: "not loaded", vramMB: 0 });
  try {
    const [version, tags, ps] = await Promise.all([
      getJson<{ version: string }>("/api/version"),
      getJson<{ models: { name: string; model: string }[] }>("/api/tags"),
      getJson<{ models: PsModel[] }>("/api/ps"),
    ]);
    const describe = (name: string): ModelStatus => {
      const loaded = ps.models.find((m) => m.name === name || m.model === name);
      return {
        name,
        installed: tags.models.some((m) => m.name === name || m.model === name),
        loaded: Boolean(loaded),
        processor: describeProcessor(loaded),
        vramMB: loaded ? Math.round(loaded.size_vram / 1024 / 1024) : 0,
      };
    };
    return { reachable: true, version: version.version, endpoint: OLLAMA_ENDPOINT_LABEL, text: describe(MODELS.text), vision: describe(MODELS.vision) };
  } catch {
    return { reachable: false, version: null, endpoint: OLLAMA_ENDPOINT_LABEL, text: empty(MODELS.text), vision: empty(MODELS.vision) };
  }
}

/** Loads a model into memory without generating anything. */
export async function warm(model: string): Promise<void> {
  await post("/api/generate", JSON.stringify({ model, keep_alive: KEEP_ALIVE }), 180_000);
}
