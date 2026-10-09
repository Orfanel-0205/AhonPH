import { describe, expect, it } from "vitest";
import { basicQuickLog } from "./basicParse";
import { convertToPhp, detectCurrency } from "./rates";
import { applyCurrency } from "./tripMoney";

const today = "2026-10-09";

describe("detectCurrency", () => {
  it("recognizes words and symbols travelers use", () => {
    expect(detectCurrency("taxi 2,300 yen")).toBe("JPY");
    expect(detectCurrency("¥2300 ramen")).toBe("JPY");
    expect(detectCurrency("50 baht tuk-tuk")).toBe("THB");
    expect(detectCurrency("₩15,000 dinner")).toBe("KRW");
    expect(detectCurrency("HK$45 MTR")).toBe("HKD");
    expect(detectCurrency("S$12 lunch")).toBe("SGD");
    expect(detectCurrency("200 riyals groceries")).toBe("SAR");
  });
  it("leaves pesos and Tagalog words alone", () => {
    expect(detectCurrency("lunch 120")).toBeNull();
    expect(detectCurrency("masarap na lunch 120")).toBeNull();
    expect(detectCurrency("₱120 pamasahe")).toBeNull();
  });
});

describe("applyCurrency", () => {
  it("converts a foreign amount to pesos with BSP rates and keeps the original", () => {
    expect(convertToPhp(2300, "JPY")).toBe(91356); // 2,300 × ₱0.3972
    const [r] = applyCurrency(basicQuickLog("taxi 2,300 yen", today), "taxi 2,300 yen", null);
    expect(r).toMatchObject({ amountCentavos: 91356, foreign: { amount: 2300, currency: "JPY" } });
    expect(r.description).toContain("¥2,300");
  });
  it("uses the trip currency when none is said, but respects explicit pesos", () => {
    const text = "ramen 1200, pasalubong ₱500";
    const out = applyCurrency(basicQuickLog(text, today), text, "JPY");
    expect(out.map((r) => [r.amountCentavos, r.foreign?.currency ?? "PHP"])).toEqual([
      [47664, "JPY"],
      [50000, "PHP"],
    ]);
  });
  it("does nothing at home", () => {
    const out = applyCurrency(basicQuickLog("lunch 95", today), "lunch 95", null);
    expect(out[0].amountCentavos).toBe(9500);
    expect(out[0].foreign).toBeUndefined();
  });
});
