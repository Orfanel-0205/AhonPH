/**
 * Sample persona for demos: "Joy", service crew in Makati on the NCR minimum wage.
 * Prices are illustrative, not survey data. Generated deterministically so every demo looks the same.
 */
import { addDays, addYears, daysBetweenInclusive } from "./dates";
import { toCentavos } from "./money";
import type { AppData, ExpenseCategory, Receipt, ReceiptItem, Transaction } from "./types";

export const SAMPLE_PERSONA = {
  name: "Joy",
  description: "Service crew sa Makati · NCR minimum wage (₱695/day, ₱755/day from Sep 26, 2026 under Wage Order NCR-28)",
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [name, 2025 price, 2026 price, typical quantity] */
const GROCERY: [string, number, number, number][] = [
  ["DINORADO RICE 5KG", 290, 345, 1],
  ["LUCKY ME PANCIT CANTON 60G", 15.5, 16.5, 4],
  ["MEGA SARDINES 155G", 24, 25.75, 3],
  ["ALASKA EVAP 370ML", 36.5, 38.75, 2],
  ["EGGS MEDIUM 6PCS", 54, 57, 1],
  ["NESCAFE CLASSIC 50G", 62, 65, 1],
  ["SAFEGUARD WHITE 130G", 50, 52.25, 1],
  ["RED ONION 250G", 40, 48, 1],
  ["COOKING OIL 1L", 95, 99, 1],
];

function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function buildSampleData(today: string): AppData {
  const rand = mulberry32(20261009);
  const transactions: Transaction[] = [];
  const receipts: Receipt[] = [];
  let n = 0;
  const id = () => `sample-${n++}`;
  const add = (type: "income" | "expense", category: Transaction["category"], description: string, pesos: number, date: string, receiptId?: string) =>
    transactions.push({ id: id(), type, category, description, amountCentavos: toCentavos(pesos), date, source: "sample", ...(receiptId ? { receiptId } : {}) });

  const groceryRun = (date: string, year: 2025 | 2026, withRice: boolean) => {
    const items: ReceiptItem[] = [];
    for (const [name, p25, p26, qty] of GROCERY) {
      const isRice = name.includes("RICE");
      if (isRice ? !withRice : rand() < 0.35) continue;
      const price = year === 2025 ? p25 : p26;
      items.push({ name, quantity: qty, lineTotalCentavos: toCentavos(price * qty) });
    }
    const rid = id();
    const total = items.reduce((s, i) => s + i.lineTotalCentavos, 0);
    receipts.push({ id: rid, merchant: rand() < 0.6 ? "PUREGOLD JR" : "ALFAMART", date, items, totalCentavos: total });
    add("expense", "food", "Grocery", total / 100, date, rid);
  };

  // Year-ago grocery receipts (Jul–Oct 2025) so personal inflation can compare like-for-like.
  const lastYearEnd = addYears(today, -1);
  for (let d = addDays(lastYearEnd, -89), week = 0; d <= lastYearEnd; d = addDays(d, 1)) {
    if (dayOfWeek(d) === 0) groceryRun(d, 2025, week++ % 2 === 0);
  }

  // Last ~60 days of everyday life.
  const start = addDays(today, -59);
  const days = daysBetweenInclusive(start, today);
  for (let i = 0, week = 0; i < days; i++) {
    const d = addDays(start, i);
    const dom = Number(d.slice(8, 10));
    const dow = dayOfWeek(d);
    const workday = dow !== 0;
    const isMonthEnd = addDays(d, 1).slice(8, 10) === "01";

    if (dom === 15 || isMonthEnd) {
      // Semi-monthly pay, 13 days each. ₱60/day increase applies from Sep 26, 2026.
      const newRateDays = d >= "2026-09-26" ? Math.min(13, daysBetweenInclusive("2026-09-26", d)) : 0;
      add("income", "salary", "Sweldo (kinsenas)", 13 * 695 + newRateDays * 60, d);
    }
    if (workday) {
      add("expense", "transport", "Jeep balikan", 26, d);
      add("expense", "food", "Lunch sa karinderya", 85 + Math.round(rand() * 5) * 5, d);
      if (rand() < 0.35) add("expense", "food", "Kape at merienda", 35, d);
    } else {
      groceryRun(d, 2026, week++ % 2 === 0);
    }
    if (dom === 5) add("expense", "rent", "Upa (bedspace)", 3500, d);
    if (dom === 12) add("expense", "utilities", "Meralco share", 1150, d);
    if (dom === 18) add("expense", "utilities", "Tubig share", 280, d);
    if (dom === 1 || dom === 16) add("expense", "family", "Padala kay Nanay", 1800, d);
    if (dom === 20) add("expense", "debt", "Home Credit hulog", 1250, d);
    if (dow === 1) add("expense", "load_internet", "Load promo", 99, d);
    if (dow === 5 && rand() < 0.6) add("expense", "leisure", "Milk tea", 120, d);
    if (dom === 27) add("expense", "leisure", "Sine kasama barkada", 350, d);
    if (dom === 24) add("expense", "personal", "Shopee order", 299, d);
  }

  const budgets: Partial<Record<ExpenseCategory, number>> = {
    food: toCentavos(5500),
    transport: toCentavos(1400),
    leisure: toCentavos(600),
    load_internet: toCentavos(400),
  };

  transactions.sort((a, b) => b.date.localeCompare(a.date));
  return { version: 1, transactions, receipts, budgets, aiLog: [], isSample: true };
}
