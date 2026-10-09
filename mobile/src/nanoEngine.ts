/**
 * KitaPH's language AI on the phone itself: Gemini Nano (built into Android).
 * Same prompts and the same code checks as the laptop hub; only the model differs.
 */
import { nanoGenerate } from "./onDevice";
import {
  ADVISOR_SYSTEM_PROMPT,
  advisorUserMessage,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  normalizeQuickLog,
  quickLogSystemPrompt,
  type ParsedRecord,
} from "./shared";

export const NANO_LABEL = "Gemini Nano (on-device)";

// The Prompt API version that fits this toolchain has no constrained JSON output, so the shape is
// spelled out in the prompt and the reply is validated by normalizeQuickLog like any other answer.
const JSON_SHAPE = `Reply with JSON only, no other text, in exactly this shape:
{"records":[{"type":"expense" or "income","category":one of ${JSON.stringify([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])},"description":"short text","amount":number,"when":"today" or "yesterday"}]}`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

export async function phoneQuickLog(text: string, today: string): Promise<{ records: ParsedRecord[]; ms: number }> {
  const r = await nanoGenerate(`${quickLogSystemPrompt()}\n\n${JSON_SHAPE}\n\nMessage: ${text}`, { temperature: 0, maxOutputTokens: 512 });
  let raw: unknown;
  try {
    raw = extractJson(r.text);
  } catch {
    throw new Error("The phone's AI gave an unreadable answer. Please try again.");
  }
  return { records: normalizeQuickLog(raw, text, today), ms: r.ms };
}

export async function phoneAdvise(
  question: string,
  context: string,
  history: { role: "user" | "assistant"; content: string }[],
  onText?: (soFar: string) => void,
): Promise<{ text: string; ms: number }> {
  const transcript = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "User" : "Kita"}: ${t.content.slice(0, 600)}`)
    .join("\n");
  const prompt = `${ADVISOR_SYSTEM_PROMPT}\n\n${transcript ? `Earlier conversation:\n${transcript}\n\n` : ""}${advisorUserMessage(context, question)}`;
  const r = await nanoGenerate(prompt, { temperature: 0.3, maxOutputTokens: 400, onText });
  if (!r.text.trim()) throw new Error("The phone's AI returned an empty answer. Please ask again.");
  return { text: r.text.trim(), ms: r.ms };
}
