import { describe, expect, it } from "vitest";
import { classifyItem } from "./itemGroups";
import { convertFromPhp, formatForeign } from "./rates";
import { breakdownReceipt, receiptTips } from "./receiptInsights";
import { explainCharges, findPricedLines } from "./traveler";
import type { Receipt, ReceiptItem } from "./types";

const items: ReceiptItem[] = [
  { name: "NFA RICE 5KG", quantity: 1, lineTotalCentavos: 24500 },
  { name: "LUCKY ME PANCIT CANTON", quantity: 6, lineTotalCentavos: 9900 },
  { name: "ALASKA EVAP 370ML", quantity: 2, lineTotalCentavos: 7750 },
  { name: "SAN MARINO CORNED TUNA", quantity: 3, lineTotalCentavos: 10200 },
  { name: "SAFEGUARD WHITE 130G", quantity: 1, lineTotalCentavos: 5225 },
];

describe("classifyItem", () => {
  it("groups common Philippine grocery items", () => {
    expect(items.map((i) => classifyItem(i.name, i.lineTotalCentavos))).toEqual(["rice", "noodles", "dairy", "canned", "personal_care"]);
    expect(classifyItem("SHAMPOO SACHET", 700)).toBe("personal_care"); // not "HAM"
    expect(classifyItem("EGGPLANT", 4000)).toBe("produce"); // not "EGG"
    expect(classifyItem("EGGS MEDIUM 6PCS", 5700)).toBe("eggs_bread");
    expect(classifyItem("SINIGANG NA BABOY", 32000)).toBe("meat_fish");
    expect(classifyItem("SENIOR DISC 20%", -15200)).toBe("discount");
    expect(classifyItem("XYZ 123", 100)).toBe("other");
  });
});

describe("breakdownReceipt", () => {
  it("sums groups and shares to 100%", () => {
    const g = breakdownReceipt(items);
    expect(g[0]).toMatchObject({ group: "rice", centavos: 24500 });
    expect(g.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
    expect(g.reduce((s, x) => s + x.centavos, 0)).toBe(57575);
  });
});

describe("receiptTips", () => {
  const history: Receipt[] = [
    {
      id: "old",
      merchant: "ALFAMART",
      date: "2026-09-20",
      totalCentavos: 0,
      items: [
        { name: "Lucky Me Pancit Canton", quantity: 6, lineTotalCentavos: 9300 },
        { name: "ALASKA EVAP 370ML", quantity: 1, lineTotalCentavos: 3650 },
      ],
    },
  ];
  const tips = receiptTips(
    { merchant: "PUREGOLD PRICE CLUB", date: "2026-10-09", items, totalCentavos: 57575, vatCentavos: 6169, totalFound: true, check: { status: "ok", itemsSumCentavos: 57575, totalCentavos: 57575 } },
    history,
  );
  const byId = Object.fromEntries(tips.map((t) => [t.id, t]));

  it("finds a cheaper store from the person's own receipts", () => {
    // Canton: ₱15.50 at Alfamart vs ₱16.50 here, × 6 = ₱6 saving
    expect(byId["cheaper-LUCKY ME PANCIT CANTON"].body).toContain("₱15.50");
    expect(byId["cheaper-LUCKY ME PANCIT CANTON"].body).toContain("₱6");
  });
  it("reports price changes since the last purchase", () => {
    // Evap ₱36.50 → ₱38.75 = +6.2%
    expect(byId["price-ALASKA EVAP 370ML"].body).toContain("+6.2%");
  });
  it("adds rice inflation context and VAT", () => {
    expect(byId.rice.body).toContain("20.3%");
    expect(byId.vat.body).toContain("₱61.69");
  });
  it("warns on mismatch", () => {
    const t = receiptTips(
      { merchant: "X", date: "2026-10-09", items: items.slice(0, 1), totalCentavos: 57575, vatCentavos: null, totalFound: true, check: { status: "mismatch", itemsSumCentavos: 24500, totalCentavos: 57575, diffCentavos: 33075 } },
      [],
    );
    expect(t[0].id).toBe("mismatch");
  });
});

describe("traveler", () => {
  it("converts with bundled BSP rates", () => {
    // ₱62.766 = US$1
    expect(convertFromPhp(6277, "USD")).toBeCloseTo(1.0001, 3);
    expect(formatForeign(convertFromPhp(57575, "USD"), "USD")).toBe("≈US$9.17");
    expect(formatForeign(convertFromPhp(57575, "KRW"), "KRW")).toBe("≈₩12,279");
    expect(formatForeign(convertFromPhp(57575, "JPY"), "JPY")).toBe("≈¥1,450");
  });
  it("finds prices on menus and receipts but skips IDs and dates", () => {
    const lines = findPricedLines(["Chicken Adobo  ₱150", "Halo-halo  P95.00", "TIN 000-123-456", "SI No 0045812", "TOTAL  575.75", "12:41"], "USD");
    expect(lines.map((l) => [l.label, l.centavos])).toEqual([
      ["Chicken Adobo", 15000],
      ["Halo-halo", 9500],
      ["TOTAL", 57575],
    ]);
  });
  it("explains VAT, service charge and discounts", () => {
    expect(explainCharges(["SERVICE CHARGE 10%  76.00", "VAT 12%  61.69"]).map((n) => n.id)).toEqual(["vat", "service"]);
    expect(explainCharges(["MENU", "Sisig 220"]).map((n) => n.id)).toEqual(["tip"]);
    expect(explainCharges(["SENIOR DISC 20%  -152.00"]).map((n) => n.id)).toEqual(["discount"]);
  });
});
