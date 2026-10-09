/**
 * KitaPH's language AI on the phone itself: Gemini Nano (built into Android).
 * Same prompts and the same code checks as the laptop hub; only the model differs.
 */
import { nanoGenerate, OnDevice } from "./onDevice";
import { acceptPolish, acceptReading, acceptTranslation, acceptTripTips, ADVISOR_SYSTEM_PROMPT, advisorUserMessage, COMPACT_RECEIPT_PROMPT, EXPENSE_CATEGORIES, INCOME_CATEGORIES, menuPrompt, normalizeQuickLog, parseCompactReceipt, parseMenuReading, parseSuggestions, polishPrompt, quickLogSystemPrompt, readPrompt, refineWithLocalKnowledge, translatePrompt, tripTipPrompt, type MenuReading, type NanoLang, type ParsedRecord, type Scenario } from "./shared";

export const NANO_LABEL = "Gemini Nano (on-device)";

/** The Prompt API version used here allows at most 256 output tokens per answer. */
const MAX_OUTPUT_TOKENS = 256;

/** AICore can briefly throttle an app; one short pause and retry covers normal use. */
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 2_500));
    return fn();
  }
}

/** Turns native errors into something a user can act on. */
function friendly(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/quota|busy|PER_APP/i.test(msg)) return new Error("The phone's AI is busy. Wait a few seconds and try again.");
  if (/not.*(available|downloaded)|UNAVAILABLE/i.test(msg)) return new Error("On-device AI isn't ready. Open Privacy, then Offline AI setup.");
  if (/background|foreground/i.test(msg)) return new Error("Keep KitaPH open while the phone's AI is working.");
  const firstLine = msg.split("\n")[0].slice(0, 120);
  return new Error(`The phone's AI couldn't answer (${firstLine}).`);
}

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

/** `records` include the local-knowledge refinement; `raw` is the model's answer after validation only. */
export async function phoneQuickLog(text: string, today: string): Promise<{ records: ParsedRecord[]; raw: ParsedRecord[]; ms: number }> {
  let r: Awaited<ReturnType<typeof nanoGenerate>>;
  try {
    r = await withOneRetry(() =>
      nanoGenerate(`${quickLogSystemPrompt()}\n\n${JSON_SHAPE}\n\nMessage: ${text}`, { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS }),
    );
  } catch (e) {
    throw friendly(e);
  }
  let raw: unknown;
  try {
    raw = extractJson(r.text);
  } catch {
    throw new Error("The phone's AI gave an unreadable answer. Please try again.");
  }
  const validated = normalizeQuickLog(raw, text, today);
  return {
    records: refineWithLocalKnowledge(validated, text),
    raw: validated,
    ms: r.ms,
  };
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
  let r: Awaited<ReturnType<typeof nanoGenerate>>;
  try {
    r = await withOneRetry(() =>
      nanoGenerate(prompt, {
        temperature: 0.3,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        onText,
      }),
    );
  } catch (e) {
    throw friendly(e);
  }
  if (!r.text.trim()) throw new Error("The phone's AI returned an empty answer. Please ask again.");
  return { text: r.text.trim(), ms: r.ms };
}

/** Gemini Nano reads the receipt photo itself, on the phone. The caller re-checks that items add up. */
export async function phoneReadReceipt(uri: string): Promise<ReturnType<typeof parseCompactReceipt> & { ms: number }> {
  if (!OnDevice) throw new Error("On-device AI is not in this build.");
  let r: { text: string; ms: number };
  try {
    r = await withOneRetry(() => OnDevice!.nanoReadImage(uri, COMPACT_RECEIPT_PROMPT, MAX_OUTPUT_TOKENS));
  } catch (e) {
    throw friendly(e);
  }
  return { ...parseCompactReceipt(r.text), ms: r.ms };
}

/** Three reply ideas from Gemini Nano on the phone; an empty list means "use the phrase bank". */
export async function phoneSuggestReplies(prompt: string): Promise<string[]> {
  try {
    const r = await withOneRetry(() => nanoGenerate(prompt, { temperature: 0.4, maxOutputTokens: 120 }));
    return parseSuggestions(r.text);
  } catch {
    return [];
  }
}

/** Gemini Nano rewrites what the traveler typed into clear English before translation; null if it can't. */
export async function phonePolish(english: string, scenario: Scenario): Promise<string | null> {
  try {
    const r = await withOneRetry(() =>
      nanoGenerate(polishPrompt(english, scenario), {
        temperature: 0,
        maxOutputTokens: 80,
      }),
    );
    return acceptPolish(english, r.text);
  } catch {
    return null;
  }
}

/**
 * Gemini Nano words two trip-budget tips from facts computed by code. A tip that uses any amount not in
 * those facts is dropped, so the AI can phrase advice but cannot make up numbers.
 */
export async function phoneTripTips(facts: string): Promise<{ tips: string[]; dropped: number; ms: number }> {
  let r: Awaited<ReturnType<typeof nanoGenerate>>;
  try {
    r = await withOneRetry(() => nanoGenerate(tripTipPrompt(facts), { temperature: 0.4, maxOutputTokens: 160 }));
  } catch (e) {
    throw friendly(e);
  }
  return { ...acceptTripTips(r.text, facts), ms: r.ms };
}

/** Gemini Nano says the traveler's English in natural Japanese, Korean or Chinese. Null if it fails the checks. */
export async function phoneTranslate(english: string, target: NanoLang, scenario: Scenario): Promise<string | null> {
  try {
    const r = await withOneRetry(() =>
      nanoGenerate(translatePrompt(english, target, scenario), {
        temperature: 0,
        maxOutputTokens: 120,
      }),
    );
    return acceptTranslation(english, r.text, target);
  } catch {
    return null;
  }
}

/** Gemini Nano reads what the other person said into plain English. Null if it fails the checks. */
export async function phoneRead(text: string, from: NanoLang, scenario: Scenario): Promise<string | null> {
  try {
    const r = await withOneRetry(() =>
      nanoGenerate(readPrompt(text, from, scenario), {
        temperature: 0,
        maxOutputTokens: 160,
      }),
    );
    return acceptReading(text, r.text);
  } catch {
    return null;
  }
}

/**
 * Gemini Nano reads a foreign menu or sign from the original text (ML Kit's word-for-word translation
 * mangles dish names): an English name and a short note per line. Lines it can't read are left out.
 */
export async function phoneReadMenu(
  lines: string[],
  lang: string,
  onPartial?: (readings: Map<number, MenuReading>) => void,
): Promise<{ readings: Map<number, MenuReading>; ms: number }> {
  if (!lines.length) return { readings: new Map(), ms: 0 };
  let r: Awaited<ReturnType<typeof nanoGenerate>>;
  // Streams: each dish shows up as soon as Gemini Nano has written its line.
  const onText = onPartial && ((soFar: string) => onPartial(parseMenuReading(soFar.slice(0, soFar.lastIndexOf("\n") + 1), lines.length)));
  try {
    r = await withOneRetry(() => nanoGenerate(menuPrompt(lines, lang), { temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS, onText }));
  } catch (e) {
    throw friendly(e);
  }
  return { readings: parseMenuReading(r.text, lines.length), ms: r.ms };
}
