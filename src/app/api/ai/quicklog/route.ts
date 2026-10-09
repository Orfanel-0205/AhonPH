import { normalizeQuickLog, QUICKLOG_SCHEMA, quickLogSystemPrompt } from "@/lib/ai";
import { refineWithLocalKnowledge } from "@/lib/basicParse";
import { chat, MODELS } from "@/lib/server/ollama";
import { badRequest, clientToday, errorResponse, meta, readJson } from "@/lib/server/respond";

export async function POST(req: Request) {
  const body = await readJson(req);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("Type what you spent or received first.");
  if (text.length > 1000) return badRequest("Please keep it under 1,000 characters.");
  const today = clientToday(body?.today);
  try {
    const { content, durationMs } = await chat({
      model: MODELS.text,
      format: QUICKLOG_SCHEMA,
      messages: [
        { role: "system", content: quickLogSystemPrompt() },
        { role: "user", content: text },
      ],
      timeoutMs: 60_000,
    });
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      return Response.json({ error: "The local model gave an unreadable answer. Please try again.", kind: "bad-response" }, { status: 502 });
    }
    const records = normalizeQuickLog(raw, text, today);
    // `raw: true` skips the local-knowledge step so evaluations can report the model on its own.
    const refined = body?.raw === true ? records : refineWithLocalKnowledge(records, text);
    return Response.json({ records: refined, meta: await meta(MODELS.text, durationMs) });
  } catch (e) {
    return errorResponse(e);
  }
}
