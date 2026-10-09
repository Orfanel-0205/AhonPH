import { ADVISOR_SYSTEM_PROMPT, advisorUserMessage } from "@/lib/ai";
import { chatStream, MODELS, type ChatMessage } from "@/lib/server/ollama";
import { badRequest, errorResponse, meta, readJson } from "@/lib/server/respond";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const context = typeof body?.context === "string" ? body.context : "";
  if (!question) return badRequest("Ask a question first.");
  if (question.length > 500) return badRequest("Please keep your question under 500 characters.");
  if (!context || context.length > 8000) return badRequest("Missing financial summary.");
  // Last two exchanges only, so follow-ups work without overflowing the small model's context.
  const history = (Array.isArray(body?.history) ? (body.history as Turn[]) : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-4)
    .map((t): ChatMessage => ({ role: t.role, content: t.content.slice(0, 1500) }));
  try {
    const stream = await chatStream({
      model: MODELS.text,
      temperature: 0.3,
      numPredict: 400,
      messages: [
        { role: "system", content: ADVISOR_SYSTEM_PROMPT },
        ...history,
        { role: "user", content: advisorUserMessage(context, question) },
      ],
      timeoutMs: 90_000,
    });
    const m = await meta(MODELS.text, 0);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Kita-Model": m.model,
        "X-Kita-Endpoint": m.endpoint,
        "X-Kita-Processor": m.processor,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
