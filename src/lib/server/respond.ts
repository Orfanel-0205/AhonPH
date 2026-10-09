import { isValidISODate, todayISO } from "../dates";
import { OllamaError, OLLAMA_ENDPOINT_LABEL, processorFor } from "./ollama";

export interface AiMeta {
  model: string;
  endpoint: string;
  durationMs: number;
  processor: string;
}

export async function meta(model: string, durationMs: number): Promise<AiMeta> {
  return { model, endpoint: OLLAMA_ENDPOINT_LABEL, durationMs, processor: await processorFor(model) };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof OllamaError) {
    const status = e.kind === "timeout" ? 504 : e.kind === "bad-response" ? 502 : 503;
    return Response.json({ error: e.message, kind: e.kind }, { status });
  }
  console.error(e);
  return Response.json({ error: "Something went wrong while running the local model.", kind: "internal" }, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message, kind: "bad-request" }, { status: 400 });
}

/** The browser sends its local date so "today" matches the user's calendar. */
export function clientToday(value: unknown): string {
  return typeof value === "string" && isValidISODate(value) ? value : todayISO();
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
