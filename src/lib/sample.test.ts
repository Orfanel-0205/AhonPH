import { describe, expect, it } from "vitest";
import { buildAdvisorContext } from "./advisorContext";
import { budgetStatuses, makePeriod, summarize } from "./finance";
import { personalInflation, yearOnYearWindows } from "./inflation";
import { buildInsights } from "./insights";
import { findUngroundedNumbers } from "./numbers";
import { checkReceipt } from "./receipt";
import { buildSampleData } from "./sample";

const today = "2026-10-09";
const data = buildSampleData(today);

describe("sample persona", () => {
  it("is deterministic", () => {
    expect(buildSampleData(today)).toEqual(data);
  });
  it("tells the intended story: a thin buffer on minimum wage", () => {
    const s = summarize(data.transactions, makePeriod("last30", today));
    // Sep 15 (13 × ₱695) + Sep 30 (13 × ₱695 + 5 days × ₱60 from Sep 26)
    expect(s.incomeCentavos).toBe((9035 + 9335) * 100);
    expect(s.spentShareOfIncome!).toBeGreaterThan(0.9);
    expect(s.spentShareOfIncome!).toBeLessThan(1);
    expect(buildInsights(s, budgetStatuses(s, data.budgets)).map((i) => i.id)).toContain("thin-buffer");
  });
  it("has internally consistent receipts", () => {
    for (const r of data.receipts) {
      expect(checkReceipt(r.items, r.totalCentavos).check.status).toBe("ok");
      const tx = data.transactions.find((t) => t.receiptId === r.id)!;
      expect(tx.amountCentavos).toBe(r.totalCentavos);
    }
  });
  it("yields a personal inflation figure above headline because rice dominates", () => {
    const { base, current } = yearOnYearWindows(today);
    const pi = personalInflation(data.receipts, base, current)!;
    expect(pi).not.toBeNull();
    expect(pi.rate).toBeGreaterThan(0.072);
    expect(pi.items[0].name).toBe("RED ONION 250G");
  });
});

describe("advisor context", () => {
  it("contains the numbers a grounded answer would quote", () => {
    const s = summarize(data.transactions, makePeriod("last30", today));
    const b = budgetStatuses(s, data.budgets);
    const { base, current } = yearOnYearWindows(today);
    const ctx = buildAdvisorContext({ today, summary: s, insights: buildInsights(s, b), budgets: b, inflation: personalInflation(data.receipts, base, current) });
    expect(ctx).toContain("₱18,370");
    expect(ctx).toContain("7.2%");
    expect(ctx).toContain("₱755/day");
    expect(ctx.length).toBeLessThan(5000);
    expect(findUngroundedNumbers("Ang kita mo ay ₱18,370 at ang headline inflation ay 7.2%.", ctx)).toEqual([]);
  });
});
