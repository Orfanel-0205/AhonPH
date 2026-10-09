import { describe, expect, it } from "vitest";
import { linesToRows, parseOcrReceipt, type OcrLine } from "./ocrReceipt";

const today = "2026-10-09";

/** Builds OCR lines the way ML Kit returns them: separate boxes for left and right columns on the same row. */
function layout(rows: (string | [string, string] | [string, string, string])[]): OcrLine[] {
  const out: OcrLine[] = [];
  rows.forEach((r, i) => {
    const top = 20 + i * 30 + (i % 3); // slight wobble, like a hand-held photo
    const parts = typeof r === "string" ? [r] : r;
    const lefts = parts.length === 1 ? [24] : parts.length === 2 ? [24, 400] : [24, 300, 430];
    parts.forEach((text, j) => {
      if (text) out.push({ text, frame: { top: top + j, left: lefts[j], width: 10 * text.length, height: 22 } });
    });
  });
  return out;
}

describe("linesToRows", () => {
  it("joins left and right columns into one row, in reading order", () => {
    const lines = layout([["TOTAL", "575.75"], "THANK YOU"]).reverse();
    expect(linesToRows(lines)).toEqual(["TOTAL  575.75", "THANK YOU"]);
  });
  it("falls back to plain lines when boxes are missing", () => {
    expect(linesToRows([{ text: "A" }, { text: " " }, { text: "B" }])).toEqual(["A", "B"]);
  });
});

describe("parseOcrReceipt", () => {
  it("reads the Puregold test receipt (qty @ unit price, line total on next row)", () => {
    const r = parseOcrReceipt(
      layout([
        "PUREGOLD PRICE CLUB",
        "Brgy. San Antonio, Makati City",
        "VAT REG TIN 000-123-456-000",
        ["SI No: 0045812", "10/09/2026 12:41"],
        "--------------------------------------",
        ["NFA RICE 5KG", "1 @ 245.00"],
        ["", "", "245.00"],
        ["LUCKY ME PANCIT CANTON", "6 @  16.50"],
        ["", "", "99.00"],
        ["ALASKA EVAP 370ML", "2 @  38.75"],
        ["", "", "77.50"],
        ["SAN MARINO CORNED TUNA", "3 @  34.00"],
        ["", "", "102.00"],
        ["SAFEGUARD WHITE 130G", "1 @  52.25"],
        ["", "", "52.25"],
        "--------------------------------------",
        ["TOTAL", "575.75"],
        ["CASH", "1000.00"],
        ["CHANGE", "424.25"],
        ["VATable Sales", "514.06"],
        ["VAT 12%", "61.69"],
        "THANK YOU! COME AGAIN",
      ]),
      today,
    )!;
    expect(r.merchant).toBe("PUREGOLD PRICE CLUB");
    expect(r.date).toBe("2026-10-09");
    expect(r.dateFromReceipt).toBe(true);
    expect(r.items).toEqual([
      { name: "NFA RICE 5KG", quantity: 1, lineTotalCentavos: 24500 },
      { name: "LUCKY ME PANCIT CANTON", quantity: 6, lineTotalCentavos: 9900 },
      { name: "ALASKA EVAP 370ML", quantity: 2, lineTotalCentavos: 7750 },
      { name: "SAN MARINO CORNED TUNA", quantity: 3, lineTotalCentavos: 10200 },
      { name: "SAFEGUARD WHITE 130G", quantity: 1, lineTotalCentavos: 5225 },
    ]);
    expect(r.totalCentavos).toBe(57575);
    expect(r.totalFound).toBe(true);
    expect(r.vatCentavos).toBe(6169);
    expect(r.check.status).toBe("ok");
  });

  it("reads 'name  amount' rows with a quantity row underneath, and a TOTAL split across rows", () => {
    const r = parseOcrReceipt(
      layout([
        "ALFAMART",
        ["MEGA SARDINES 155G", "77.25 V"],
        "3 X 25.75",
        ["COOKING OIL 1L", "99.00 V"],
        "TOTAL AMOUNT DUE",
        ["", "176.25"],
      ]),
      today,
    )!;
    expect(r.items).toEqual([
      { name: "MEGA SARDINES 155G", quantity: 3, lineTotalCentavos: 7725 },
      { name: "COOKING OIL 1L", quantity: 1, lineTotalCentavos: 9900 },
    ]);
    expect(r.totalCentavos).toBe(17625);
    expect(r.check.status).toBe("ok");
    expect(r.dateFromReceipt).toBe(false);
  });

  it("reads a name-only row followed by 'qty @ price  amount'", () => {
    const r = parseOcrReceipt(
      layout(["SARI-SARI STORE", "KOPIKO BLANCA TWIN", ["4 @ 12.00", "48.00"], ["TOTAL", "48.00"]]),
      today,
    )!;
    expect(r.items).toEqual([{ name: "KOPIKO BLANCA TWIN", quantity: 4, lineTotalCentavos: 4800 }]);
    expect(r.check.status).toBe("ok");
  });

  it("handles a restaurant bill with service charge and senior discount", () => {
    const r = parseOcrReceipt(
      layout([
        "KUSINA NI LOLA",
        ["SINIGANG NA BABOY", "320.00"],
        ["KARE-KARE", "380.00"],
        ["RICE", "2 @ 30.00"],
        ["", "", "60.00"],
        ["SERVICE CHARGE 10%", "76.00"],
        ["SENIOR DISC 20%", "-152.00"],
        ["SUBTOTAL", "760.00"],
        ["TOTAL", "684.00"],
      ]),
      today,
    )!;
    expect(r.items.map((i) => [i.name, i.lineTotalCentavos])).toEqual([
      ["SINIGANG NA BABOY", 32000],
      ["KARE-KARE", 38000],
      ["RICE", 6000],
      ["Service charge", 7600],
      ["SENIOR DISC 20%", -15200],
    ]);
    expect(r.check.status).toBe("ok");
  });

  it("uses the items' sum when no TOTAL line is visible, and says so", () => {
    const r = parseOcrReceipt(layout(["STORE", ["BREAD", "45.00"], ["MILK", "88.50"]]), today)!;
    expect(r.totalFound).toBe(false);
    expect(r.totalCentavos).toBe(13350);
  });

  it("reports a mismatch when a line was missed", () => {
    const r = parseOcrReceipt(layout(["STORE", ["BREAD", "45.00"], ["TOTAL", "133.50"]]), today)!;
    expect(r.check).toMatchObject({ status: "mismatch", diffCentavos: 8850 });
  });

  it("returns null for an empty photo", () => {
    expect(parseOcrReceipt([], today)).toBeNull();
  });
});
