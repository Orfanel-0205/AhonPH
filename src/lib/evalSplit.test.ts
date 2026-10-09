import { describe, expect, it } from "vitest";
import { SPLIT_ALIASES, SPLIT_CASES, SPLIT_HOLDOUT, SPLIT_PEOPLE, scoreSplit } from "./evalSplit";
import { ruleSplit } from "./split";

const sentencesRight = (cases: typeof SPLIT_CASES) => cases.filter((c) => scoreSplit(ruleSplit(c.said, SPLIT_ALIASES, SPLIT_PEOPLE).shares, c.expected).all).length;

// Pins the rule reader's measured accuracy so a change can't silently make it worse.
describe("bill-split rule reader, measured", () => {
  it("development set: 11 of 12 sentences", () => {
    expect(sentencesRight(SPLIT_CASES)).toBeGreaterThanOrEqual(11);
  });
  it("held-out set: 5 of 8 sentences", () => {
    expect(sentencesRight(SPLIT_HOLDOUT)).toBeGreaterThanOrEqual(5);
  });
});
