import { describe, expect, it } from "vitest";
import { acceptTripTips, sampleTrip, tripFacts, tripStatus, tripTips, type TripPlan } from "./tripBudget";
import type { Transaction } from "./types";

const plan: TripPlan = { name: "Tokyo", currency: "JPY", budgetCentavos: 5_000_000, start: "2026-10-10", end: "2026-10-14" };
const tx = (date: string, pesos: number, category: Transaction["category"] = "food"): Transaction => ({
  id: `${date}-${pesos}`,
  type: "expense",
  category,
  description: "x",
  amountCentavos: pesos * 100,
  date,
  source: "quicklog",
});

describe("trip budget", () => {
  it("splits what is left over the days left, counting today", () => {
    const s = tripStatus(plan, [tx("2026-10-10", 12_000), tx("2026-10-11", 2_000)], "2026-10-11");
    expect(s.day).toBe(2);
    expect(s.daysLeft).toBe(4);
    expect(s.spentCentavos).toBe(1_400_000);
    expect(s.leftCentavos).toBe(3_600_000);
    // This morning ₱38,000 was left for 4 days: ₱9,500 today, ₱2,000 already spent.
    expect(s.todayAllowanceCentavos).toBe(950_000);
    expect(s.todayLeftCentavos).toBe(750_000);
    expect(s.averagePerDayCentavos).toBe(700_000);
    expect(s.state).toBe("ok");
  });

  it("ignores income and spending outside the trip", () => {
    const income: Transaction = { ...tx("2026-10-11", 9_000), type: "income", category: "salary" };
    const s = tripStatus(plan, [tx("2026-10-09", 5_000), income, tx("2026-10-11", 1_000)], "2026-10-11");
    expect(s.spentCentavos).toBe(100_000);
  });

  it("warns about pace before the money runs out", () => {
    const s = tripStatus(plan, [tx("2026-10-10", 15_000), tx("2026-10-11", 15_000)], "2026-10-11");
    expect(s.projectedCentavos).toBe(7_500_000);
    expect(s.state).toBe("near");
    const ids = tripTips(plan, s).map((t) => t.id);
    expect(ids).toContain("trip-pace");
    expect(ids).toContain("trip-today-over");
    // ₱20,000 left for the 3 days after today.
    expect(tripTips(plan, s).find((t) => t.id === "trip-pace")!.body).toContain("Keep the next 3 days to ₱6,667");
  });

  it("says when the budget is gone", () => {
    const s = tripStatus(plan, [tx("2026-10-10", 52_000)], "2026-10-10");
    expect(s.state).toBe("over");
    expect(tripTips(plan, s)[0].id).toBe("trip-over");
    expect(tripTips(plan, s)[0].body).toContain("₱2,000");
  });

  it("handles before and after the trip", () => {
    expect(tripStatus(plan, [], "2026-10-08").phase).toBe("before");
    expect(tripTips(plan, tripStatus(plan, [], "2026-10-08"))[0].body).toContain("₱10,000");
    const after = tripStatus(plan, [tx("2026-10-12", 40_000)], "2026-10-20");
    expect(after.daysLeft).toBe(0);
    expect(tripTips(plan, after)[0].title).toContain("₱10,000 under budget");
  });

  it("shows amounts in the trip currency too", () => {
    const facts = tripFacts(plan, tripStatus(plan, [tx("2026-10-10", 3_972)], "2026-10-10"));
    expect(facts).toContain("Left: ₱46,028");
    expect(facts).toMatch(/¥/);
  });
});

describe("Gemini Nano trip tips", () => {
  const facts = "Budget: ₱50,000. Left: ₱36,000 (≈ ¥90,634). Today's fair share: ₱9,500 (≈ ¥23,917).";
  it("keeps tips whose amounts come from the facts", () => {
    const r = acceptTripTips("- Keep today under ₱9,500 (≈ ¥23,917).\n- Try 2 konbini meals instead of a restaurant.", facts);
    expect(r.tips).toHaveLength(2);
    expect(r.dropped).toBe(0);
  });
  it("drops a tip with an invented price", () => {
    const r = acceptTripTips("A Suica card costs ¥500 deposit.\nKeep today under ₱9,500.", facts);
    expect(r.tips).toEqual(["Keep today under ₱9,500."]);
    expect(r.dropped).toBe(1);
  });
  it("strips 'Tip 1:' labels", () => {
    expect(acceptTripTips("Tip 1: Keep today under ₱9,500.", facts).tips).toEqual(["Keep today under ₱9,500."]);
  });
  it("drops preambles", () => {
    expect(acceptTripTips("Here are 2 tips:\nTips:\nSpend wisely today.", facts).tips).toEqual(["Spend wisely today."]);
  });
});

describe("sample trip", () => {
  it("is mid-trip and in yen", () => {
    const { plan: p, transactions } = sampleTrip("2026-10-10");
    const s = tripStatus(p, transactions, "2026-10-10");
    expect(s.day).toBe(3);
    expect(p.currency).toBe("JPY");
    expect(transactions.every((t) => t.source === "sample")).toBe(true);
  });
});
