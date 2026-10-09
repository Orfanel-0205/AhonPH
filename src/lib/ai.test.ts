import { describe, expect, it } from "vitest";
import { normalizeQuickLog, normalizeReceipt, parseReceiptDate } from "./ai";

const today = "2026-10-09";

describe("normalizeQuickLog", () => {
  const text = "Nag-jeep ako 26, lunch 95 kahapon, sweldo 9,815";
  it("converts, dates, and verifies records", () => {
    const out = normalizeQuickLog(
      {
        records: [
          { type: "expense", category: "transport", description: "Jeep", amount: 26, when: "today" },
          { type: "expense", category: "food", description: "Lunch", amount: 95, when: "yesterday" },
          { type: "income", category: "salary", description: "Sweldo", amount: 9815, when: "today" },
        ],
      },
      text,
      today,
    );
    expect(out).toEqual([
      { type: "expense", category: "transport", description: "Jeep", amountCentavos: 2600, date: "2026-10-09", amountVerified: true },
      { type: "expense", category: "food", description: "Lunch", amountCentavos: 9500, date: "2026-10-08", amountVerified: true },
      { type: "income", category: "salary", description: "Sweldo", amountCentavos: 981500, date: "2026-10-09", amountVerified: true },
    ]);
  });
  it("flags amounts that are not in the text and drops impossible ones", () => {
    const out = normalizeQuickLog(
      {
        records: [
          { type: "expense", category: "food", description: "Snack", amount: 120, when: "today" },
          { type: "expense", category: "food", description: "Bad", amount: -5, when: "today" },
          { type: "expense", category: "food", description: "Bad", amount: "95", when: "today" },
        ],
      },
      text,
      today,
    );
    expect(out).toHaveLength(1);
    expect(out[0].amountVerified).toBe(false);
  });
  it("keeps type and category consistent", () => {
    const out = normalizeQuickLog(
      {
        records: [
          { type: "income", category: "food", description: "x", amount: 26, when: "today" },
          { type: "expense", category: "salary", description: "y", amount: 95, when: "today" },
        ],
      },
      text,
      today,
    );
    expect(out.map((r) => r.category)).toEqual(["other_income", "other"]);
  });
  it("corrects 'pinadala ko' read as income, but not 'pinadalhan ako'", () => {
    const sent = normalizeQuickLog({ records: [{ type: "income", category: "allowance", description: "Padala kay mama", amount: 3000, when: "today" }] }, "Pinadala ko kay mama 3,000 ngayong kinsenas", today);
    expect(sent[0]).toMatchObject({ type: "expense", category: "family" });
    const got = normalizeQuickLog({ records: [{ type: "income", category: "allowance", description: "Padala ni kuya", amount: 1500, when: "today" }] }, "pinadalhan ako ni kuya 1,500", today);
    expect(got[0]).toMatchObject({ type: "income", category: "allowance" });
    // Model's description doesn't mention family, but it is the only record (seen live with gemma3:4b).
    const solo = normalizeQuickLog({ records: [{ type: "income", category: "allowance", description: "kinsenas", amount: 3000, when: "today" }] }, "Pinadala ko kay mama 3,000 ngayong kinsenas", today);
    expect(solo[0]).toMatchObject({ type: "expense", category: "family" });
    // Mixed message: only the family record flips; the salary stays income.
    const mixed = normalizeQuickLog(
      {
        records: [
          { type: "income", category: "allowance", description: "Padala kay mama", amount: 3000, when: "today" },
          { type: "income", category: "salary", description: "Sweldo", amount: 9815, when: "today" },
        ],
      },
      "Pinadala ko kay mama 3,000, sweldo 9,815",
      today,
    );
    expect(mixed.map((r) => [r.type, r.category])).toEqual([["expense", "family"], ["income", "salary"]]);
  });
  it("survives garbage", () => {
    expect(normalizeQuickLog(null, text, today)).toEqual([]);
    expect(normalizeQuickLog({ records: "no" }, text, today)).toEqual([]);
  });
});

describe("parseReceiptDate", () => {
  it("reads common receipt formats", () => {
    expect(parseReceiptDate("2026-10-09")).toBe("2026-10-09");
    expect(parseReceiptDate("10/09/2026 12:41")).toBe("2026-10-09");
    expect(parseReceiptDate("10-09-26")).toBe("2026-10-09");
    expect(parseReceiptDate("13/40/2026")).toBeNull();
    expect(parseReceiptDate("Oct 9")).toBeNull();
  });
});

describe("normalizeReceipt", () => {
  it("normalizes the Qwen3-VL reading of the test receipt", () => {
    const r = normalizeReceipt(
      {
        merchant: "PUREGOLD PRICE CLUB",
        date: "10/09/2026",
        items: [
          { name: "NFA RICE 5KG", quantity: 1, line_total: 245.0 },
          { name: "LUCKY ME PANCIT CANTON", quantity: 6, line_total: 99.0 },
          { name: "ALASKA EVAP 370ML", quantity: 2, line_total: 77.5 },
          { name: "SAN MARINO CORNED TUNA", quantity: 3, line_total: 102.0 },
          { name: "SAFEGUARD WHITE 130G", quantity: 1, line_total: 52.25 },
        ],
        total: 575.75,
        category: "food",
      },
      today,
    )!;
    expect(r.check.status).toBe("ok");
    expect(r.totalCentavos).toBe(57575);
    expect(r.date).toBe("2026-10-09");
    expect(r.dateFromReceipt).toBe(true);
    expect(r.category).toBe("food");
  });
  it("falls back to today for implausible dates and handles screenshots without items", () => {
    const r = normalizeReceipt({ merchant: "GCash - Meralco", date: "12/25/2031", items: [], total: 1850, category: "utilities" }, today)!;
    expect(r.date).toBe(today);
    expect(r.dateFromReceipt).toBe(false);
    expect(r.check.status).toBe("no-items");
  });
  it("rejects readings without a usable total", () => {
    expect(normalizeReceipt({ merchant: "x", items: [], total: 0 }, today)).toBeNull();
    expect(normalizeReceipt(null, today)).toBeNull();
  });
});
