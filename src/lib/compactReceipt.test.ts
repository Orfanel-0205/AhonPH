import { describe, expect, it } from "vitest";
import { parseCompactReceipt } from "./compactReceipt";

describe("parseCompactReceipt", () => {
  it("reads the compact format", () => {
    const r = parseCompactReceipt("STORE;PUREGOLD PRICE CLUB\nNFA RICE 5KG;1;245.00\nLUCKY ME PANCIT CANTON;6;99.00\nTOTAL;344.00");
    expect(r).toEqual({
      merchant: "PUREGOLD PRICE CLUB",
      items: [
        { name: "NFA RICE 5KG", quantity: 1, lineTotalCentavos: 24500 },
        { name: "LUCKY ME PANCIT CANTON", quantity: 6, lineTotalCentavos: 9900 },
      ],
      totalCentavos: 34400,
    });
  });
  it("tolerates bullets, pipes, peso signs and commas", () => {
    const r = parseCompactReceipt("- KARE-KARE | 1 | ₱1,380.00\n* TOTAL | 1,380.00");
    expect(r.items).toEqual([{ name: "KARE-KARE", quantity: 1, lineTotalCentavos: 138000 }]);
    expect(r.totalCentavos).toBe(138000);
  });
  it("ignores chatter and bad lines", () => {
    const r = parseCompactReceipt("Here is the receipt:\nBREAD;x;abc\nTOTAL;n/a");
    expect(r).toEqual({ merchant: null, items: [], totalCentavos: null });
  });
});
