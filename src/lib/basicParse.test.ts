import { describe, expect, it } from "vitest";
import { basicQuickLog } from "./basicParse";
import { QUICKLOG_CASES, scoreQuickLog } from "./evalQuicklog";

describe("basicQuickLog (no-AI fallback)", () => {
  it("handles a typical message", () => {
    const r = basicQuickLog("Nag-jeep ako 26 papuntang trabaho, lunch sa karinderya 95, load 50 sa Globe", "2026-10-09");
    expect(r.map((x) => [x.type, x.category, x.amountCentavos])).toEqual([
      ["expense", "transport", 2600],
      ["expense", "food", 9500],
      ["expense", "load_internet", 5000],
    ]);
  });
  it("treats sent money as a family expense and salary as income", () => {
    expect(basicQuickLog("Pinadala ko kay mama 3,000", "2026-10-09")[0]).toMatchObject({ type: "expense", category: "family", amountCentavos: 300000 });
    expect(basicQuickLog("Sweldo ko kanina 9,815", "2026-10-09")[0]).toMatchObject({ type: "income", category: "salary", amountCentavos: 981500 });
  });
  it("ignores text without amounts", () => {
    expect(basicQuickLog("Ang ganda ng araw ngayon!", "2026-10-09")).toEqual([]);
  });
  it("reports its score on the shared 15-sentence set (printed, not tuned to it)", () => {
    let passed = 0;
    for (const c of QUICKLOG_CASES) if (scoreQuickLog(c, basicQuickLog(c.text, "2026-10-09")).pass) passed++;
    console.log(`basic mode: ${passed}/${QUICKLOG_CASES.length} sentences`);
    expect(passed).toBeGreaterThan(0);
  });
});
