/**
 * KitaPH's AI on the phone itself: Gemini Nano (built into Android) through the KitaNano bridge.
 * Same prompts and the same code checks as the laptop hub; only the model differs.
 */
import KitaNano from "../modules/kita-nano/src/KitaNanoModule";
import {
  ADVISOR_SYSTEM_PROMPT,
  advisorUserMessage,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  normalizeQuickLog,
  quickLogSystemPrompt,
  type ParsedRecord,
} from "./shared";

export interface PhoneMeta {
  model: string;
  durationMs: number;
}

// The Prompt API version that fits this toolchain has no constrained JSON output, so the shape is
// spelled out in the prompt and the reply is validated by normalizeQuickLog like any other answer.
const JSON_SHAPE = `Reply with JSON only, no other text, in exactly this shape:
{"records":[{"type":"expense" or "income","category":one of ${JSON.stringify([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])},"description":"short text","amount":number,"when":"today" or "yesterday"}]}`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The phone's AI did not return JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

export async function phoneQuickLog(text: string, today: string): Promise<{ records: ParsedRecord[]; meta: PhoneMeta }> {
  if (!KitaNano) throw new Error("On-device AI is not available in this build.");
  const r = await KitaNano.generate(`${quickLogSystemPrompt()}\n\n${JSON_SHAPE}`, `Message: ${text}`, 0, 512);
  let raw: unknown;
  try {
    raw = extractJson(r.text);
  } catch {
    throw new Error("The phone's AI gave an unreadable answer. Please try again.");
  }
  return { records: normalizeQuickLog(raw, text, today), meta: { model: "Gemini Nano (on-device)", durationMs: r.ms } };
}

export async function phoneAdvise(question: string, context: string, history: { role: "user" | "assistant"; content: string }[]): Promise<{ text: string; meta: PhoneMeta }> {
  if (!KitaNano) throw new Error("On-device AI is not available in this build.");
  const transcript = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "User" : "Kita"}: ${t.content.slice(0, 600)}`)
    .join("\n");
  const prompt = `${transcript ? `Earlier conversation:\n${transcript}\n\n` : ""}${advisorUserMessage(context, question)}`;
  const r = await KitaNano.generate(ADVISOR_SYSTEM_PROMPT, prompt, 0.3, 400);
  if (!r.text.trim()) throw new Error("The phone's AI returned an empty answer. Please ask again.");
  return { text: r.text.trim(), meta: { model: "Gemini Nano (on-device)", durationMs: r.ms } };
}
