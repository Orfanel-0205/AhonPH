/**
 * Scoring for the Taglish quick-log test set (quicklogCases.json). Shared by the laptop script and the
 * in-app on-phone test, so both report the same metric on the same 15 sentences.
 */
import CASES from "./quicklogCases.json";
import type { CategoryId, TxType } from "./types";

export interface QuickLogCase {
  text: string;
  expected: { type: TxType; categories: CategoryId[]; pesos: number }[];
}

export const QUICKLOG_CASES = CASES as QuickLogCase[];

export function scoreQuickLog(c: QuickLogCase, got: { type: TxType; category: CategoryId; amountCentavos: number }[]) {
  const remaining = [...got];
  let correct = 0;
  for (const e of c.expected) {
    const i = remaining.findIndex((r) => r.type === e.type && e.categories.includes(r.category) && r.amountCentavos === Math.round(e.pesos * 100));
    if (i >= 0) {
      correct++;
      remaining.splice(i, 1);
    }
  }
  return { pass: correct === c.expected.length && remaining.length === 0, correct, expected: c.expected.length };
}
