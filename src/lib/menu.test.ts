import { describe, expect, it } from "vitest";
import { menuPrompt, parseMenuReading } from "./menu";

describe("menu reading", () => {
  it("asks about the original text and its language", () => {
    const p = menuPrompt(["醤油ラーメン", "とんかつ定食"], "ja");
    expect(p).toContain("in Japanese");
    expect(p).toContain("2. とんかつ定食");
  });

  it("parses names and notes by line number", () => {
    const r = parseMenuReading(
      "1. Soy sauce ramen | noodle soup, usually with pork\n2. **Tonkatsu set meal** | breaded pork cutlet with rice\n3. Oyakodon - chicken and egg rice bowl",
      3,
    );
    expect(r.get(0)).toEqual({ name: "Soy sauce ramen", note: "noodle soup, usually with pork" });
    expect(r.get(1)?.name).toBe("Tonkatsu set meal");
    expect(r.get(2)).toEqual({ name: "Oyakodon", note: "chicken and egg rice bowl" });
  });

  it("drops echoes, unknowns and out-of-range lines", () => {
    const r = parseMenuReading("1. 醤油ラーメン (Shoyu ramen) | soy sauce ramen\n2. 枝豆\n3. not sure\n9. Extra | x", 3);
    expect(r.get(0)?.name).toBe("Shoyu ramen");
    expect(r.has(1)).toBe(false);
    expect(r.has(2)).toBe(false);
    expect(r.has(8)).toBe(false);
  });

  it("drops hedged guesses and a repeated original in the note", () => {
    const r = parseMenuReading(["1. Karyo- | Not sure. This might be a typo", "2. Saba no Miso-ni | 鯖の味噌煮 - mackerel simmered in miso"].join("\n"), 2);
    expect(r.has(0)).toBe(false);
    expect(r.get(1)?.note).toBe("mackerel simmered in miso");
  });
});
