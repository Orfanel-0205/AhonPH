import { addDays, addYears } from "./dates";
import type { Centavos, Receipt } from "./types";

export function normalizeItemName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export interface Window {
  start: string;
  end: string;
}

export interface ItemPriceChange {
  name: string;
  baseUnitPriceCentavos: Centavos;
  currentUnitPriceCentavos: Centavos;
  /** e.g. 0.2 for +20% */
  change: number;
  baseQuantity: number;
}

export interface PersonalInflation {
  /** Laspeyres rate: what last year's basket costs at today's prices, minus one. */
  rate: number;
  baseBasketCostCentavos: Centavos;
  currentBasketCostCentavos: Centavos;
  items: ItemPriceChange[];
  base: Window;
  current: Window;
}

/** Current window = last `days` days; base = the same window one year earlier (comparable to year-on-year CPI). */
export function yearOnYearWindows(today: string, days = 90): { current: Window; base: Window } {
  const current = { start: addDays(today, -(days - 1)), end: today };
  return { current, base: { start: addYears(current.start, -1), end: addYears(current.end, -1) } };
}

function unitPrices(receipts: Receipt[], w: Window) {
  const acc = new Map<string, { name: string; spent: number; qty: number }>();
  for (const r of receipts) {
    if (r.date < w.start || r.date > w.end) continue;
    for (const it of r.items) {
      if (!(it.quantity > 0) || it.lineTotalCentavos <= 0) continue;
      const key = normalizeItemName(it.name);
      if (!key) continue;
      const a = acc.get(key) ?? { name: it.name, spent: 0, qty: 0 };
      a.spent += it.lineTotalCentavos;
      a.qty += it.quantity;
      acc.set(key, a);
    }
  }
  return acc;
}

/**
 * Computes the user's own inflation rate from item prices on their receipts.
 * Only items bought in both windows count. Returns null when there is no overlap.
 */
export function personalInflation(receipts: Receipt[], base: Window, current: Window): PersonalInflation | null {
  const before = unitPrices(receipts, base);
  const now = unitPrices(receipts, current);
  const items: ItemPriceChange[] = [];
  let baseCost = 0;
  let currentCost = 0;
  for (const [key, b] of before) {
    const c = now.get(key);
    if (!c) continue;
    const p0 = b.spent / b.qty;
    const p1 = c.spent / c.qty;
    baseCost += p0 * b.qty;
    currentCost += p1 * b.qty;
    items.push({
      name: c.name,
      baseUnitPriceCentavos: Math.round(p0),
      currentUnitPriceCentavos: Math.round(p1),
      change: p1 / p0 - 1,
      baseQuantity: b.qty,
    });
  }
  if (items.length === 0 || baseCost <= 0) return null;
  items.sort((a, b) => b.change - a.change);
  return {
    rate: currentCost / baseCost - 1,
    baseBasketCostCentavos: Math.round(baseCost),
    currentBasketCostCentavos: Math.round(currentCost),
    items,
    base,
    current,
  };
}
