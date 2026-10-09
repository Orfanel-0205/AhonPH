/**
 * Money abroad: amounts said or typed in a foreign currency are kept in pesos, with the original
 * amount shown next to them. Uses the bundled BSP rates, so it works offline.
 */
import type { ParsedRecord } from "./ai";
import { splitSegments } from "./basicParse";
import { extractTypedAmounts } from "./numbers";
import { convertToPhp, detectCurrency, formatCurrency, type CurrencyCode } from "./rates";

export interface ForeignRecord extends ParsedRecord {
  foreign?: { amount: number; currency: CurrencyCode };
}

/**
 * For each record, looks for a currency next to its amount ("taxi 2,300 yen", "¥2300", "50 baht").
 * With no currency word, `tripCurrency` (if set) is assumed; pesos when neither applies.
 */
export function applyCurrency(records: ParsedRecord[], text: string, tripCurrency: CurrencyCode | null): ForeignRecord[] {
  const segments = splitSegments(text);
  return records.map((r) => {
    const seg = segments.find((s) => extractTypedAmounts(s).includes(r.amountCentavos)) ?? text;
    const explicitPeso = /₱|\bPHP\b|\bpesos?\b/i.test(seg);
    const currency = explicitPeso ? null : (detectCurrency(seg) ?? tripCurrency);
    if (!currency) return r;
    const amount = r.amountCentavos / 100;
    return {
      ...r,
      amountCentavos: convertToPhp(amount, currency),
      description: `${r.description} (${formatCurrency(amount, currency)})`.slice(0, 80),
      foreign: { amount, currency },
    };
  });
}
