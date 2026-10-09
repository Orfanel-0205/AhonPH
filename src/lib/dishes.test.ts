import { describe, expect, it } from "vitest";
import { containsNote, DISHES, lookupDish } from "./dishes";

describe("hand-checked dishes", () => {
  it("knows the dishes Gemini Nano got wrong", () => {
    expect(lookupDish("親子丼")?.en).toBe("Oyakodon");
    expect(lookupDish("親子丼")?.contains).toEqual(["chicken", "egg"]);
    expect(lookupDish("枝豆")?.en).toBe("Edamame");
  });
  it("prefers the most specific name", () => {
    expect(lookupDish("醤油ラーメン")?.en).toBe("Shoyu ramen");
    expect(lookupDish("焼きそば")?.en).toBe("Yakisoba");
    expect(lookupDish("ノンアルコールビール")?.contains).toEqual([]);
    expect(lookupDish("焼き鳥盛り合わせ")?.en).toBe("Assorted yakitori");
  });
  it("matches inside receipt lines with marks", () => {
    expect(lookupDish("※唐揚げ")?.en).toBe("Karaage");
    expect(lookupDish("ランチセットA")?.en).toBe("Lunch set");
    expect(lookupDish("小籠包")?.en).toBe("Xiaolongbao");
    expect(lookupDish("김치찌개")?.contains).toEqual(["pork"]);
  });
  it("returns nothing for unknown lines", () => {
    expect(lookupDish("お会計")).toBeNull();
    expect(lookupDish("")).toBeNull();
  });
  it("states only sure facts", () => {
    expect(containsNote(lookupDish("カツ丼")!)).toBe("Contains: pork, egg.");
    expect(containsNote(lookupDish("ランチセット")!)).toBe("");
  });
  it("has a name, note and words for every dish", () => {
    for (const d of DISHES) expect(d.names.length && d.en && d.note && d.say.length).toBeTruthy();
  });
});
