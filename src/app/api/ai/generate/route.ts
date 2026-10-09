import { chat, MODELS } from "@/lib/server/ollama";
import { badRequest, errorResponse, meta, readJson } from "@/lib/server/respond";

/**
 * Runs one of the phone app's prompts on this laptop's model, for phones without Gemini Nano.
 * The phone sends the same prompt it would give Gemini Nano and applies the same code checks to
 * the answer, so a teammate's phone gets the same features over the laptop's hotspot, with no internet.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) return badRequest("Send a prompt.");
  if (prompt.length > 8000) return badRequest("The prompt is too long.");
  const temperature = typeof body?.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1) : 0;
  const maxTokens = typeof body?.maxTokens === "number" ? Math.min(Math.max(Math.round(body.maxTokens), 16), 512) : 256;
  try {
    const { content, durationMs } = await chat({
      model: MODELS.text,
      messages: [{ role: "user", content: prompt }],
      temperature,
      numPredict: maxTokens,
      timeoutMs: 90_000,
    });
    return Response.json({ text: content.trim(), meta: await meta(MODELS.text, durationMs) });
  } catch (e) {
    return errorResponse(e);
  }
}
