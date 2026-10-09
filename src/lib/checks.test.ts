import { describe, expect, it } from "vitest";
import { personalInflation, yearOnYearWindows } from "./inflation";
import { extractTypedAmounts, findUngroundedNumbers, isAmountInText } from "./numbers";
import { checkReceipt } from "./receipt";
import type { Receipt } from "./types";

describe("receipt check", () => {
  // The exact items from the Puregold test receipt; total ₱575.75.
  const correct = [
    { name: "NFA RICE 5KG", quantity: 1, lineTotalCentavos: 24500 },
    { name: "LUCKY ME PANCIT CANTON", quantity: 6, lineTotalCentavos: 9900 },
    { name: "ALASKA EVAP 370ML", quantity: 2, lineTotalCentavos: 7750 },
    { name: "SAN MARINO CORNED TUNA", quantity: 3, lineTotalCentavos: 10200 },
    { name: "SAFEGUARD WHITE 130G", quantity: 1, lineTotalCentavos: 5225 },
  ];

  it("accepts a reading that adds up", () => {
    expect(checkReceipt(correct, 57575).check.status).toBe("ok");
  });

  it("repairs unit-price-as-line-total (the mistake Gemma 3 made in testing)", () => {
    const gemmaReading = [
      { name: "NFA RICE 5KG", quantity: 1, lineTotalCentavos: 24500 },
      { name: "LUCKY ME PANCIT CANTON", quantity: 6, lineTotalCentavos: 1650 },
      { name: "ALASKA EVAP 370ML", quantity: 2, lineTotalCentavos: 3875 },
      { name: "SAN MARINO CORNED TUNA", quantity: 3, lineTotalCentavos: 3400 },
      { name: "SAFEGUARD WHITE 130G", quantity: 1, lineTotalCentavos: 5225 },
    ];
    const r = checkReceipt(gemmaReading, 57575);
    expect(r.check.status).toBe("repaired");
    expect(r.items).toEqual(correct);
  });

  it("reports a mismatch it cannot explain", () => {
    const r = checkReceipt(correct.slice(0, 4), 57575);
    expect(r.check).toMatchObject({ status: "mismatch", diffCentavos: 5225 });
  });

  it("reports no items", () => {
    expect(checkReceipt([], 1000).check.status).toBe("no-items");
  });
});

describe("typed amounts (quick-log hallucination guard)", () => {
  const text = "Nag-jeep ako 26 pesos, lunch 95, load 50 sa Globe, Meralco 1,850, bigas 5kg 245.50, padala 2k, grab ₱1.5k";
  it("extracts amounts people actually type", () => {
    expect(extractTypedAmounts(text)).toEqual([2600, 9500, 5000, 185000, 500, 24550, 200000, 150000]);
  });
  it("confirms amounts that are in the text and rejects invented ones", () => {
    expect(isAmountInText(185000, text)).toBe(true);
    expect(isAmountInText(24550, text)).toBe(true);
    expect(isAmountInText(200000, text)).toBe(true);
    expect(isAmountInText(120000, text)).toBe(false);
  });
});

describe("advisor number check", () => {
  const context = "Income: ₱20,000. Expenses: ₱18,500. Remaining: ₱1,500 (92.5% spent). Food inflation 6.8%. Cut 20% saves ₱410.";
  it("passes numbers taken from the data", () => {
    expect(findUngroundedNumbers("Natitira sa iyo ang ₱1,500 at 92.5% ang nagastos. Bawasan ng 20% para makatipid ng ₱410.", context)).toEqual([]);
  });
  it("flags numbers the model made up", () => {
    expect(findUngroundedNumbers("Makakatipid ka ng ₱3,000 kada buwan, mga 15% ng kita.", context)).toEqual(["₱3,000", "15%"]);
  });
});

describe("personal inflation", () => {
  const r = (id: string, date: string, items: [string, number, number][]): Receipt => ({
    id,
    merchant: "Store",
    date,
    totalCentavos: items.reduce((s, i) => s + i[2], 0),
    items: items.map(([name, quantity, lineTotalCentavos]) => ({ name, quantity, lineTotalCentavos })),
  });
  const { base, current } = yearOnYearWindows("2026-10-09", 90);

  it("uses year-ago windows", () => {
    expect(current).toEqual({ start: "2026-07-12", end: "2026-10-09" });
    expect(base).toEqual({ start: "2025-07-12", end: "2025-10-09" });
  });

  it("computes a Laspeyres rate over items bought in both windows", () => {
    const receipts = [
      r("a", "2025-09-15", [["Rice 5kg", 1, 20000], ["Sardines", 4, 8000], ["Shampoo", 1, 9000]]),
      r("b", "2026-09-15", [["RICE  5KG", 2, 48000], ["sardines", 2, 4400]]),
    ];
    const pi = personalInflation(receipts, base, current)!;
    // Base basket: 1 rice @200 + 4 sardines @20 = ₱280. Now: 1 @240 + 4 @22 = ₱328. 328/280 − 1 = 17.142857%
    expect(pi.baseBasketCostCentavos).toBe(28000);
    expect(pi.currentBasketCostCentavos).toBe(32800);
    expect(pi.rate).toBeCloseTo(48 / 280, 10);
    expect(pi.items.map((i) => i.name)).toEqual(["RICE  5KG", "sardines"]);
    expect(pi.items[0].change).toBeCloseTo(0.2, 10);
  });

  it("returns null without overlapping items", () => {
    expect(personalInflation([r("a", "2025-09-15", [["Rice", 1, 100]])], base, current)).toBeNull();
  });
});
