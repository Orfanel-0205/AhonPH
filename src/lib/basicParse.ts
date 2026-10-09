/**
 * No-AI fallback for the Taglish quick-log: splits the message into parts, takes the typed amount,
 * and picks a category by keyword. Used only when neither on-device AI nor the hub is available,
 * and labeled "basic mode" in the app.
 */
import type { ParsedRecord } from "./ai";
import { EXPENSE_INFO, INCOME_INFO } from "./categories";
import { addDays } from "./dates";
import { extractTypedAmounts } from "./numbers";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type CategoryId } from "./types";

const INCOME_WORDS = /\b(sweldo|sahod|kinsenas|natanggap|pinadalhan ako|binigyan ako|nakabenta|naibenta|bayad sa akin|raket|sideline|bonus|ayuda)\b/i;
const SENT_WORDS = /\b(nagpadala|pinadala ko|ipinadala|binigyan ko)\b/i;

function keywords(hint: string): string[] {
  return hint
    .toLowerCase()
    .split(/,\s*/)
    .flatMap((h) => h.split("/"))
    .map((h) => h.trim())
    .filter((h) => h.length >= 3);
}

const EXPENSE_KEYWORDS = EXPENSE_CATEGORIES.filter((c) => c !== "other").map((c) => [c, keywords(EXPENSE_INFO[c].hint)] as const);
const INCOME_KEYWORDS = INCOME_CATEGORIES.filter((c) => c !== "other_income").map((c) => [c, keywords(INCOME_INFO[c].hint)] as const);

function pickCategory(segment: string, income: boolean): CategoryId {
  const s = segment.toLowerCase();
  const table = income ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  for (const [cat, kws] of table) if (kws.some((k) => s.includes(k))) return cat;
  return income ? "other_income" : "other";
}

export function splitSegments(text: string): string[] {
  return (
    text
      // Commas separate items, except inside amounts like "3,000".
      .split(/,(?!\d{3}\b)|[;\n]|\s+(?:at|tapos|and|saka|pati)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Hybrid step applied after the language model: the model finds the amounts and splits the message,
 * then the local keyword knowledge (the category hints in categories.ts, written before any test set
 * existed) corrects the category when it recognizes a term near that amount. If a known expense term
 * is present and no income word is, a record the model called income becomes an expense.
 */
export function refineWithLocalKnowledge(records: ParsedRecord[], text: string): ParsedRecord[] {
  const segments = splitSegments(text);
  return records.map((r) => {
    const seg = segments.find((s) => extractTypedAmounts(s).includes(r.amountCentavos));
    if (!seg) return r;
    if (SENT_WORDS.test(seg)) return { ...r, type: "expense", category: "family" };
    const expenseCat = pickCategory(seg, false);
    if (r.type === "income") {
      if (!INCOME_WORDS.test(seg) && expenseCat !== "other") return { ...r, type: "expense", category: expenseCat };
      const incomeCat = pickCategory(seg, true);
      return incomeCat !== "other_income" ? { ...r, category: incomeCat } : r;
    }
    return expenseCat !== "other" ? { ...r, category: expenseCat } : r;
  });
}

export function basicQuickLog(text: string, today: string): ParsedRecord[] {
  const segments = splitSegments(text);
  const out: ParsedRecord[] = [];
  for (const seg of segments) {
    const amounts = extractTypedAmounts(seg).filter((a) => a > 0);
    // "5kg" style quantities are numbers too; the last number in a part is usually the price.
    const amount = amounts[amounts.length - 1];
    if (!amount) continue;
    const sent = SENT_WORDS.test(seg);
    const income = !sent && INCOME_WORDS.test(seg);
    const category: CategoryId = sent ? "family" : pickCategory(seg, income);
    const description =
      seg
        .replace(/(?:₱|php|p)?\s?\d[\d,]*(?:\.\d{1,2})?\s?k?\b/gi, "")
        .replace(/\b(pesos?|php)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 40) || (income ? "Kita" : "Gastos");
    out.push({
      type: income ? "income" : "expense",
      category,
      description,
      amountCentavos: amount,
      date: /\b(kahapon|yesterday)\b/i.test(seg) ? addDays(today, -1) : today,
      amountVerified: true,
    });
  }
  return out;
}
