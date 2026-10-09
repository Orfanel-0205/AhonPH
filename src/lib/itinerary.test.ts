import { describe, expect, it } from "vitest";
import { CITIES, parseDayTips, planFacts, planTrip } from "./itinerary";

const tokyo = CITIES.find((c) => c.id === "tokyo")!;

describe("trip planner", () => {
  it("plans 3 places a day, keeping each area together", () => {
    const p = planTrip(tokyo, 3, 2, ["culture", "views"]);
    expect(p.days).toHaveLength(3);
    expect(p.days.every((d) => d.places.length <= 3)).toBe(true);
    const asakusa = p.days.flatMap((d, i) => d.places.filter((x) => x.area === "Asakusa").map(() => i));
    expect(new Set(asakusa).size).toBe(1);
  });

  it("keeps splurges for Bongga and cheap picks for Tipid", () => {
    expect(planTrip(tokyo, 4, 1, ["theme"]).days.flatMap((d) => d.places).map((p) => p.name)).not.toContain("Tokyo DisneySea");
    expect(planTrip(tokyo, 4, 3, ["theme"]).days[0].places.map((p) => p.name)).toContain("Tokyo DisneySea");
    expect(planTrip(tokyo, 2, 1, []).days.flatMap((d) => d.places).every((p) => p.level === 1)).toBe(true);
  });

  it("adds up the costs per person", () => {
    const p = planTrip(tokyo, 3, 1, ["food"]);
    expect(p.totals.food).toBe(9000);
    expect(p.totals.transport).toBe(3000);
    expect(p.totals.pocket).toBe(p.totals.activities + 12000);
    // 2 nights of ¥8,000 for one traveler.
    expect(p.totals.hotel).toBe(16000);
    // Two travelers share a room.
    expect(planTrip(tokyo, 3, 1, ["food"], 2).totals.hotel).toBe(8000);
  });

  it("plans a one-day trip (layover or day trip) with no hotel", () => {
    const p = planTrip(CITIES.find((c) => c.id === "singapore")!, 1, 1, ["food", "culture"]);
    expect(p.days).toHaveLength(1);
    expect(p.days[0].places.length).toBeGreaterThan(0);
    expect(p.totals.hotel).toBe(0);
    expect(p.totals.all).toBe(p.totals.pocket);
  });

  it("costs more as the tier goes up", () => {
    const [a, b, c] = ([1, 2, 3] as const).map((t) => planTrip(tokyo, 4, t, ["food", "culture"]).totals.all);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("leaves a free day when there aren't enough matching places", () => {
    const p = planTrip(tokyo, 5, 1, ["theme"]);
    expect(p.days.at(-1)!.area).toBe("Free day");
  });

  it("every city has places for every tier and costs that rise by tier", () => {
    for (const c of CITIES) {
      expect(c.places.length).toBeGreaterThanOrEqual(7);
      for (const k of ["food", "transport", "hotel"] as const) expect(c[k][0] < c[k][1] && c[k][1] < c[k][2]).toBe(true);
    }
  });

  it("keeps the AI's day tips only when they are for a planned day and carry no prices", () => {
    const facts = planFacts(planTrip(tokyo, 2, 1, ["culture"]));
    expect(facts).toContain("Day 1");
    const tips = parseDayTips(
      ["Day 1: Go to Senso-ji early before the crowds.", "Day 2: Bring ¥3,000 for snacks.", "Day 5: Extra day."].join("\n"),
      [["Senso-ji and Nakamise"], ["Tsukiji Outer Market"]],
    );
    expect([...tips.keys()]).toEqual([1]);
  });

  it("drops a tip that sends people somewhere off the plan", () => {
    const tips = parseDayTips(["Day 1: Explore Ueno Park at your own pace.", "Day 2: Go to Tsukiji early."].join("\n"), [["Senso-ji and Nakamise"], ["Tsukiji Outer Market"]]);
    expect([...tips.keys()]).toEqual([2]);
  });

  it("spreads places evenly instead of leaving an empty last day", () => {
    const p = planTrip(tokyo, 4, 2, ["food", "culture", "views"]);
    expect(p.days.every((d) => d.places.length > 0)).toBe(true);
  });
});
