/**
 * Gemini Nano reading a foreign menu or sign. It sees the original text (not a machine translation,
 * which mangles dish names), and code keeps only answers that look like real English readings.
 */

const LANGUAGE_NAME: Record<string, string> = {
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  th: "Thai",
  vi: "Vietnamese",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  id: "Indonesian",
  ms: "Malay",
};

export const languageName = (code: string) => LANGUAGE_NAME[code] ?? "a foreign language";

/** At most 8 lines fit Gemini Nano's 256-token answer with a short note each. */
export const MENU_MAX_LINES = 8;

export function menuPrompt(lines: string[], lang: string): string {
  return `A phone camera read these lines from a menu or sign in ${languageName(lang)} (small reading mistakes are possible):
${lines
  .slice(0, MENU_MAX_LINES)
  .map((l, i) => `${i + 1}. ${l}`)
  .join("\n")}
For a Filipino traveler, give each line its common English name. For food and drink, add at most 10 words on what it is and say if it usually has pork, beef, seafood or alcohol. For anything else, write only the English name.
The camera can confuse similar characters (like 井 and 丼), so guess the intended word. If you really don't know, write: number. not sure
Format each line exactly as: number. English name | what it is (or just: number. English name)`;
}

export interface MenuReading {
  name: string;
  note: string;
}

// Includes the long-vowel mark ー and CJK punctuation, which Unicode files under "Common".
const CJK_CHARS = String.raw`\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\u30fc\uff00-\uffef`;
const CJK = new RegExp(`[${CJK_CHARS}]`, "gu");

const LEADING_ORIGINAL = new RegExp(String.raw`^[${CJK_CHARS}\s]+[-–—:]\s*`, "u");

/** Parses "2. Tonkatsu set meal | breaded pork cutlet with rice; pork" into per-line readings (0-based). */
export function parseMenuReading(text: string, count: number): Map<number, MenuReading> {
  const out = new Map<number, MenuReading>();
  for (const raw of text.split("\n")) {
    const m = raw.replace(/\*\*/g, "").match(/^\s*(\d+)[.)]\s*(.+)$/);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= Math.min(count, MENU_MAX_LINES) || out.has(i)) continue;
    const [namePart, ...rest] = m[2].split(/\s*\|\s*|\s+[—–-]\s+/);
    // Drop an echoed original ("醤油ラーメン (Shoyu ramen)") and keep the English.
    const name = namePart
      .replace(CJK, "")
      .trim()
      .replace(/^\((.*)\)$/, "$1")
      .replace(/\(\s*\)/g, "")
      .replace(/[\s:;,(]+$/, "")
      .trim();
    // Notes sometimes repeat the original first ("鯖の味噌煮 - Japanese fish dish...").
    const note = rest
      .join(" - ")
      .replace(LEADING_ORIGINAL, "")
      .trim();
    if (!/[A-Za-z]{2}/.test(name) || /^not sure/i.test(name) || /^not sure/i.test(note)) continue;
    out.set(i, { name, note });
  }
  return out;
}
