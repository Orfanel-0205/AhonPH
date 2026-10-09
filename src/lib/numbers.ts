import { toCentavos } from "./money";
import type { Centavos } from "./types";

/**
 * Finds peso amounts a person typed, e.g. "26", "1,850", "16.50", "2k", "₱1.5k".
 * "5kg" is read as 5 (the k belongs to a unit), not 5,000.
 */
export function extractTypedAmounts(text: string): Centavos[] {
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(\s?k(?![a-z]))?/gi;
  const out: Centavos[] = [];
  for (const m of text.matchAll(re)) {
    let value = Number(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : ""));
    if (m[3]) value *= 1000;
    out.push(toCentavos(value));
  }
  return out;
}

/** True if the amount the AI extracted literally appears in what the person typed. */
export function isAmountInText(amountCentavos: Centavos, text: string): boolean {
  return extractTypedAmounts(text).includes(amountCentavos);
}

function numericValues(text: string): Set<number> {
  const set = new Set<number>();
  for (const m of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    set.add(Number(m[0].replace(/,/g, "")));
  }
  return set;
}

/**
 * Lists peso amounts and percentages in the AI's reply that do not appear anywhere in the data it was given.
 * An empty list means every number in the answer is traceable to the user's records or the bundled facts.
 */
export function findUngroundedNumbers(reply: string, context: string): string[] {
  const allowed = numericValues(context);
  const flagged: string[] = [];
  const check = (token: string, raw: string) => {
    const v = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(v) && !allowed.has(v) && !flagged.includes(token)) flagged.push(token);
  };
  for (const m of reply.matchAll(/(?:₱|PHP\s?|Php\s?)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g)) {
    check(m[0].trim(), m[1]);
  }
  for (const m of reply.matchAll(/(\d+(?:\.\d+)?)\s?%/g)) {
    check(m[0].trim(), m[1]);
  }
  return flagged;
}
