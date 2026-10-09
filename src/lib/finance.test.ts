import { describe, expect, it } from "vitest";
import { addDays, addYears, daysBetweenInclusive, endOfMonth, isValidISODate } from "./dates";
import { budgetStatuses, makePeriod, summarize } from "./finance";
import { buildInsights } from "./insights";
import { formatPct, formatPeso, toCentavos } from "./money";
import type { Transaction } from "./types";

let n = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, "type" | "category" | "amountCentavos" | "date">): Transaction => ({
  id: `t${n++}`,
  description: "",
  source: "manual",
  ...p,
});

describe("money", () => {
  it("converts pesos to integer centavos without float drift", () => {
    expect(toCentavos(16.5)).toBe(1650);
    expect(toCentavos(0.1 + 0.2)).toBe(30);
    expect(toCentavos(1.005)).toBe(101);
    expect(toCentavos(1850)).toBe(185000);
    expect(() => toCentavos(NaN)).toThrow();
  });
  it("formats pesos", () => {
    expect(formatPeso(185000)).toBe("₱1,850");
    expect(formatPeso(1650)).toBe("₱16.50");
    expect(formatPeso(-150000)).toBe("-₱1,500");
    expect(formatPeso(100000000)).toBe("₱1,000,000");
    expect(formatPeso(57575, { showCentavos: true })).toBe("₱575.75");
  });
  it("formats percentages", () => {
    expect(formatPct(0.925)).toBe("92.5%");
    expect(formatPct(0.5)).toBe("50%");
  });
});

describe("dates", () => {
  it("handles month and year edges", () => {
    expect(addDays("2026-10-09", -29)).toBe("2026-09-10");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(daysBetweenInclusive("2026-09-10", "2026-10-09")).toBe(30);
    expect(addYears("2028-02-29", -1)).toBe("2027-02-28");
    expect(addYears("2026-10-09", -1)).toBe("2025-10-09");
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-10-09")).toBe(true);
  });
  it("builds periods", () => {
    expect(makePeriod("last30", "2026-10-09")).toMatchObject({ start: "2026-09-10", end: "2026-10-09" });
    expect(makePeriod("thisMonth", "2026-10-09")).toMatchObject({ start: "2026-10-01", end: "2026-10-09" });
    expect(makePeriod("lastMonth", "2026-10-09")).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
    expect(makePeriod("lastMonth", "2026-01-15")).toMatchObject({ start: "2025-12-01", end: "2025-12-31" });
  });
});

describe("summarize — the ₱20,000 / ₱18,500 example", () => {
  const today = "2026-10-09";
  const txs = [
    tx({ type: "income", category: "salary", amountCentavos: 2_000_000, date: "2026-09-30" }),
    tx({ type: "expense", category: "food", amountCentavos: 720_000, date: "2026-09-20" }),
    tx({ type: "expense", category: "transport", amountCentavos: 240_000, date: "2026-09-21" }),
    tx({ type: "expense", category: "rent", amountCentavos: 500_000, date: "2026-10-05" }),
    tx({ type: "expense", category: "utilities", amountCentavos: 185_000, date: "2026-10-01" }),
    tx({ type: "expense", category: "load_internet", amountCentavos: 60_000, date: "2026-10-02" }),
    tx({ type: "expense", category: "leisure", amountCentavos: 145_000, date: "2026-10-03" }),
    // Outside the 30-day window — must be ignored.
    tx({ type: "expense", category: "food", amountCentavos: 999_900, date: "2026-09-09" }),
  ];
  const s = summarize(txs, makePeriod("last30", today));

  it("computes totals exactly", () => {
    expect(s.incomeCentavos).toBe(2_000_000);
    expect(s.expenseCentavos).toBe(1_850_000);
    expect(s.remainingCentavos).toBe(150_000);
    expect(s.spentShareOfIncome).toBeCloseTo(0.925, 10);
    expect(s.txCount).toBe(7);
  });
  it("splits essential and flexible", () => {
    expect(s.essentialCentavos).toBe(720_000 + 240_000 + 500_000 + 185_000);
    expect(s.flexibleCentavos).toBe(60_000 + 145_000);
  });
  it("sorts categories largest first and shares sum to 1", () => {
    expect(s.byCategory.map((c) => c.category)).toEqual(["food", "rent", "transport", "utilities", "leisure", "load_internet"]);
    expect(s.byCategory.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1, 10);
  });
  it("produces a thin-buffer warning and a savings suggestion", () => {
    const ins = buildInsights(s, []);
    const ids = ins.map((i) => i.id);
    expect(ids).toContain("thin-buffer");
    expect(ids).toContain("flexible-cut");
    const thin = ins.find((i) => i.id === "thin-buffer")!;
    expect(thin.body).toContain("₱1,500");
    expect(thin.body).toContain("92.5%");
    // 20% of ₱2,050 flexible = ₱410
    expect(ins.find((i) => i.id === "flexible-cut")!.body).toContain("₱410");
    // Food 7,200 × 6.8% = 489.6 → ₱490
    expect(ins.find((i) => i.id === "inflation-food")!.body).toContain("₱490");
    // Emergency fund: 3 × 16,450 essentials = ₱49,350; at ₱1,500/month → 33 months
    const ef = ins.find((i) => i.id === "emergency-fund")!.body;
    expect(ef).toContain("₱49,350");
    expect(ef).toContain("33 buwan");
  });
});

describe("insights edge cases", () => {
  const p = makePeriod("last30", "2026-10-09");
  it("flags overspending", () => {
    const s = summarize(
      [
        tx({ type: "income", category: "salary", amountCentavos: 1_000_000, date: "2026-10-01" }),
        tx({ type: "expense", category: "rent", amountCentavos: 1_200_000, date: "2026-10-02" }),
      ],
      p,
    );
    const top = buildInsights(s, [])[0];
    expect(top.id).toBe("overspent");
    expect(top.body).toContain("₱2,000");
  });
  it("handles no income without dividing by zero", () => {
    const s = summarize([tx({ type: "expense", category: "food", amountCentavos: 10_000, date: "2026-10-01" })], p);
    expect(s.spentShareOfIncome).toBeNull();
    expect(buildInsights(s, []).map((i) => i.id)).toContain("no-income");
  });
  it("handles an empty ledger", () => {
    expect(buildInsights(summarize([], p), [])[0].id).toBe("empty");
  });
  it("does not present partial-month figures as monthly", () => {
    const s = summarize(
      [
        tx({ type: "income", category: "salary", amountCentavos: 1_000_000, date: "2026-10-01" }),
        tx({ type: "expense", category: "food", amountCentavos: 100_000, date: "2026-10-02" }),
      ],
      makePeriod("thisMonth", "2026-10-09"),
    );
    const ids = buildInsights(s, []).map((i) => i.id);
    expect(ids).not.toContain("emergency-fund");
    expect(ids).not.toContain("inflation-food");
  });
});

describe("budgets", () => {
  it("classifies ok / near / over", () => {
    const s = summarize(
      [
        tx({ type: "expense", category: "food", amountCentavos: 900_000, date: "2026-10-01" }),
        tx({ type: "expense", category: "leisure", amountCentavos: 85_000, date: "2026-10-01" }),
        tx({ type: "expense", category: "transport", amountCentavos: 50_000, date: "2026-10-01" }),
      ],
      makePeriod("last30", "2026-10-09"),
    );
    const st = budgetStatuses(s, { food: 800_000, leisure: 100_000, transport: 300_000, health: 0 });
    expect(st.map((b) => [b.category, b.state])).toEqual([
      ["food", "over"],
      ["leisure", "near"],
      ["transport", "ok"],
    ]);
    const ins = buildInsights(s, st);
    expect(ins.find((i) => i.id === "budget-over-food")!.body).toContain("₱1,000");
  });
});
