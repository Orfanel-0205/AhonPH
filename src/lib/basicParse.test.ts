import { describe, expect, it } from "vitest";
import { basicQuickLog } from "./basicParse";
import { QUICKLOG_CASES, QUICKLOG_HOLDOUT, scoreQuickLog } from "./evalQuicklog";

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
    let held = 0;
    for (const c of QUICKLOG_HOLDOUT) if (scoreQuickLog(c, basicQuickLog(c.text, "2026-10-09")).pass) held++;
    console.log(`basic mode: dev ${passed}/${QUICKLOG_CASES.length}, held-out ${held}/${QUICKLOG_HOLDOUT.length} sentences`);
    expect(passed).toBeGreaterThan(0);
  });
});

describe("refineWithLocalKnowledge (hybrid step after the model)", async () => {
  const { refineWithLocalKnowledge } = await import("./basicParse");
  const rec = (type: "income" | "expense", category: string, pesos: number) => ({
    type,
    category: category as never,
    description: "x",
    amountCentavos: pesos * 100,
    date: "2026-10-09",
    amountVerified: true,
  });
  it("corrects categories it recognizes and leaves the rest to the model", () => {
    const out = refineWithLocalKnowledge(
      [rec("expense", "food", 245.5), rec("expense", "other", 799), rec("expense", "leisure", 350)],
      "gamot sa Mercury 245.50, Shopee checkout 799, sine 350",
    );
    expect(out.map((r) => r.category)).toEqual(["health", "personal", "leisure"]);
  });
  it("turns a model 'income' into an expense when only an expense term is present", () => {
    expect(refineWithLocalKnowledge([rec("income", "other_income", 3500)], "upa sa boarding house 3,500")[0]).toMatchObject({ type: "expense", category: "rent" });
  });
  it("keeps real income as income", () => {
    expect(refineWithLocalKnowledge([rec("income", "salary", 9815)], "Sweldo ko kanina 9,815")[0]).toMatchObject({ type: "income", category: "salary" });
  });
});
