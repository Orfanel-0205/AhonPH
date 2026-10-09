import type { Centavos, ReceiptItem } from "./types";

export type ReceiptCheck =
  | { status: "ok"; itemsSumCentavos: Centavos; totalCentavos: Centavos }
  /** Items didn't add up until line totals were multiplied by quantity (model read the unit price). */
  | { status: "repaired"; itemsSumCentavos: Centavos; totalCentavos: Centavos }
  | { status: "mismatch"; itemsSumCentavos: Centavos; totalCentavos: Centavos; diffCentavos: Centavos }
  | { status: "no-items"; itemsSumCentavos: 0; totalCentavos: Centavos };

const sum = (items: ReceiptItem[]) => items.reduce((s, i) => s + i.lineTotalCentavos, 0);

/**
 * Checks the AI's reading of a receipt with plain arithmetic: do the items add up to the printed total?
 * Also fixes the most common vision-model mistake (unit price read as line total for multi-quantity lines).
 */
export function checkReceipt(items: ReceiptItem[], totalCentavos: Centavos): { items: ReceiptItem[]; check: ReceiptCheck } {
  if (items.length === 0) {
    return { items, check: { status: "no-items", itemsSumCentavos: 0, totalCentavos } };
  }
  const itemsSum = sum(items);
  if (itemsSum === totalCentavos) {
    return { items, check: { status: "ok", itemsSumCentavos: itemsSum, totalCentavos } };
  }
  const hasMultiQty = items.some((i) => i.quantity > 1 && Number.isInteger(i.quantity));
  if (hasMultiQty) {
    const repaired = items.map((i) =>
      i.quantity > 1 && Number.isInteger(i.quantity) ? { ...i, lineTotalCentavos: i.lineTotalCentavos * i.quantity } : i,
    );
    const repairedSum = sum(repaired);
    if (repairedSum === totalCentavos) {
      return { items: repaired, check: { status: "repaired", itemsSumCentavos: repairedSum, totalCentavos } };
    }
  }
  return {
    items,
    check: { status: "mismatch", itemsSumCentavos: itemsSum, totalCentavos, diffCentavos: totalCentavos - itemsSum },
  };
}

/**
 * Like checkReceipt, but also accepts items that add up to the printed SUBTOTAL when the TOTAL
 * includes tax or fees added on top (common on foreign receipts).
 */
export function checkReceiptWithSubtotal(
  items: ReceiptItem[],
  totalCentavos: Centavos,
  subtotalCentavos: Centavos | null,
): { items: ReceiptItem[]; check: ReceiptCheck; basis: "total" | "subtotal" } {
  const byTotal = checkReceipt(items, totalCentavos);
  if (byTotal.check.status === "ok" || byTotal.check.status === "repaired" || subtotalCentavos === null || subtotalCentavos > totalCentavos) {
    return { ...byTotal, basis: "total" };
  }
  const bySubtotal = checkReceipt(items, subtotalCentavos);
  return bySubtotal.check.status === "ok" || bySubtotal.check.status === "repaired" ? { ...bySubtotal, basis: "subtotal" } : { ...byTotal, basis: "total" };
}

/** Coerces a model-supplied quantity into something sane. */
export function sanitizeQuantity(q: unknown): number {
  return typeof q === "number" && Number.isFinite(q) && q > 0 && q < 10_000 ? q : 1;
}
