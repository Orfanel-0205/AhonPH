/**
 * Parses the compact receipt format the on-device model is asked for (its answers are capped at
 * 256 tokens, too short for JSON on long receipts):
 *   STORE;Puregold
 *   LUCKY ME PANCIT CANTON;6;99.00
 *   TOTAL;575.75
 */
import { toCentavos } from "./money";
import { sanitizeQuantity } from "./receipt";
import type { Centavos, ReceiptItem } from "./types";

export const COMPACT_RECEIPT_PROMPT = `Read this receipt photo. Reply in exactly this format and nothing else:
STORE;store name
item name;quantity;line total
item name;quantity;line total
TOTAL;total amount paid
Use one line per purchased item. The line total is the amount for the whole line, not the unit price. Copy numbers exactly as printed. Do not list VAT, subtotal, cash or change as items.`;

const num = (s: string | undefined) => {
  const v = Number((s ?? "").replace(/[₱,\s]|PHP/gi, ""));
  return Number.isFinite(v) ? v : NaN;
};

export function parseCompactReceipt(text: string): { merchant: string | null; items: ReceiptItem[]; totalCentavos: Centavos | null } {
  let merchant: string | null = null;
  let total: number | null = null;
  const items: ReceiptItem[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^[\s*•\-\d.)]+(?=[A-Za-z])/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s*[;|]\s*/);
    const head = parts[0].toUpperCase();
    if (head === "STORE" && parts[1]) {
      merchant = parts[1].trim().slice(0, 80);
    } else if (head === "TOTAL" && parts.length >= 2) {
      const t = num(parts[parts.length - 1]);
      if (t > 0) total = t;
    } else if (parts.length >= 3) {
      const amount = num(parts[parts.length - 1]);
      if (!(amount > 0) || amount > 1_000_000) continue;
      items.push({ name: parts[0].slice(0, 80), quantity: sanitizeQuantity(num(parts[1])), lineTotalCentavos: toCentavos(amount) });
    }
  }
  return { merchant, items, totalCentavos: total !== null ? toCentavos(total) : null };
}
