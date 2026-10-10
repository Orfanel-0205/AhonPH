import { describe, expect, it } from "vitest";
import { rememberPhrase, savedTranslation, toggleFavorite, topPhrases, type PhraseMemory } from "./phraseMemory";

const ja = (text: string) => ({ text, back: "x", via: "nano" });

describe("your phrases (favorites and most used)", () => {
  it("counts uses and keeps the translation per language", () => {
    let m: PhraseMemory = {};
    m = rememberPhrase(m, "Where is the station?", "ja", ja("駅はどこですか？"), 1);
    m = rememberPhrase(m, "where is the station", "ko", { text: "역이 어디예요?", back: "x", via: "translator" }, 2);
    const e = Object.values(m)[0];
    expect(e.count).toBe(2);
    expect(savedTranslation(m, "Where is the station?", "ja")?.text).toBe("駅はどこですか？");
    expect(savedTranslation(m, "WHERE IS THE STATION", "ko")?.text).toBe("역이 어디예요?");
  });

  it("shows favorites first, then phrases said twice, most used first", () => {
    let m: PhraseMemory = {};
    m = rememberPhrase(m, "Thank you.", "ja", ja("ありがとうございます。"), 1);
    m = rememberPhrase(m, "Thank you.", "ja", ja("ありがとうございます。"), 2);
    m = rememberPhrase(m, "Thank you.", "ja", ja("ありがとうございます。"), 3);
    m = rememberPhrase(m, "Once only.", "ja", ja("一度だけ。"), 4);
    m = rememberPhrase(m, "Can I pay by card?", "ja", ja("カードで払えますか？"), 5);
    m = rememberPhrase(m, "Can I pay by card?", "ja", ja("カードで払えますか？"), 6);
    m = toggleFavorite(m, "Where is the toilet?");
    expect(topPhrases(m).map((p) => p.text)).toEqual(["Where is the toilet?", "Thank you.", "Can I pay by card?"]);
    expect(topPhrases(toggleFavorite(m, "Where is the toilet?")).map((p) => p.text)).toEqual(["Thank you.", "Can I pay by card?"]);
  });

  it("keeps at most 60 phrases, favorites kept first", () => {
    let m: PhraseMemory = toggleFavorite({}, "Keep me");
    for (let i = 0; i < 70; i++) m = rememberPhrase(m, `phrase ${i}`, "ja", ja("x"), i);
    expect(Object.keys(m)).toHaveLength(60);
    expect(Object.values(m).some((p) => p.text === "Keep me")).toBe(true);
  });
});
