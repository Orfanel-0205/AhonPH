import { normalizeReceipt, RECEIPT_PROMPT, RECEIPT_SCHEMA } from "@/lib/ai";
import { chat, MODELS } from "@/lib/server/ollama";
import { badRequest, clientToday, errorResponse, meta, readJson } from "@/lib/server/respond";

const MAX_BASE64_CHARS = 8_000_000;

export async function POST(req: Request) {
  const body = await readJson(req);
  const image = typeof body?.image === "string" ? body.image.replace(/^data:image\/[a-z+]+;base64,/, "") : "";
  if (!image) return badRequest("Choose a photo of a receipt first.");
  if (image.length > MAX_BASE64_CHARS) return badRequest("That photo is too large. Please use a smaller image.");
  const today = clientToday(body?.today);
  try {
    const { content, durationMs } = await chat({
      model: MODELS.vision,
      format: RECEIPT_SCHEMA,
      messages: [{ role: "user", content: RECEIPT_PROMPT, images: [image] }],
      timeoutMs: 120_000,
    });
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      return Response.json({ error: "The local model could not read this image. Try a clearer, well-lit photo.", kind: "bad-response" }, { status: 502 });
    }
    const receipt = normalizeReceipt(raw, today);
    if (!receipt) {
      return Response.json({ error: "No total amount was found. Make sure the TOTAL line is visible in the photo.", kind: "bad-response" }, { status: 422 });
    }
    return Response.json({ receipt, meta: await meta(MODELS.vision, durationMs) });
  } catch (e) {
    return errorResponse(e);
  }
}
