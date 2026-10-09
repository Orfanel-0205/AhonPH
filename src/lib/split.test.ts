import { describe, expect, it } from "vitest";
import { parseSplit, splitBill, splitPrompt } from "./split";

// The AI Lab's sample receipt: beer x2 1,200, edamame 400, yakitori 1,200, karaage 700, oyakodon 950; tax 445; total 4,895.
const ITEMS = [1200, 400, 1200, 700, 950];

describe("hatian (bill split)", () => {
  it("splits shared items equally, spreads tax by what each ordered, and adds up exactly", () => {
    // Ako: oyakodon; Maria: karaage + half the beer; Jun: yakitori + half the beer; edamame for everyone.
    const shares = [[1, 2], [], [2], [1], [0]];
    const r = splitBill(ITEMS, shares, 3, 4895);
    expect(r.extra).toBe(445);
    expect(r.amounts.reduce((a, b) => a + b, 0)).toBe(4895);
    // Before tax: Ako 950 + 133.3; Maria 700 + 600 + 133.3; Jun 1200 + 600 + 133.3. Tax adds 10% to each.
    [1191.67, 1576.67, 2126.67].forEach((exact, i) => expect(Math.abs(r.amounts[i] - exact)).toBeLessThan(1));
  });

  it("splits evenly when nobody is assigned", () => {
    expect(splitBill(ITEMS, [], 3, 4895).amounts).toEqual([1632, 1632, 1631]);
  });

  it("keeps cents for currencies that have them", () => {
    const r = splitBill([28.5, 6], [[0], [1]], 2, 34.5, 2);
    expect(r.amounts).toEqual([28.5, 6]);
  });

  it("reads the AI's assignment, mapping 'ako' to the speaker and ignoring invented names", () => {
    const people = ["Ako", "Maria", "Jun"];
    const r = parseSplit("1. Maria, Jun\n2. everyone\n3. Jun\n4. Maria and Pedro\n5. ako", 5, people);
    expect(r.shares).toEqual([[1, 2], [], [2], [1], [0]]);
    expect(r.assigned).toBe(4);
  });

  it("reads names after the arrow (real laptop-model answer)", () => {
    const raw = [
      "Here’s the breakdown of the receipt items and who had them, based on Ako’s statement:",
      "1. 生ビール (Nama Biiru) -> beer -> Maria, Jun",
      "2. 枝豆 (Edamame) -> edamame -> everyone",
      "3. 焼き鳥盛り合わせ (Yakitori Moriawase) -> yakitori platter -> Jun",
      "4. 唐揚げ (Karaage) -> karaage -> Maria",
      "5. 親子丼 (Oyakodon) -> oyakodon -> Ako",
    ].join("\n");
    expect(parseSplit(raw, 5, ["Ako", "Maria", "Jun"]).shares).toEqual([[1, 2], [], [2], [1], [0]]);
  });

  it("leaves unmentioned items for everyone", () => {
    expect(parseSplit("2. Maria", 3, ["Ako", "Maria"]).shares).toEqual([[], [1], []]);
  });

  it("tells the model who is speaking", () => {
    expect(splitPrompt(["Beer"], ["Ako", "Maria"], "kay Maria ang beer")).toContain('"Ako" is the person speaking');
  });
});
