import { describe, expect, it } from "vitest";
import {
  acceptReading,
  acceptTranslation,
  isNanoLang,
  parseSuggestions,
  PHRASEBOOK,
  phrasebookReplies,
  SCENARIOS,
  suggestionPrompt,
  translatePrompt,
} from "./talk";

describe("phrase bank", () => {
  it("has phrases in Filipino and English for every situation", () => {
    for (const s of SCENARIOS) {
      expect(PHRASEBOOK[s.id].length).toBeGreaterThanOrEqual(4);
      for (const p of PHRASEBOOK[s.id]) expect(p.tl && p.en).toBeTruthy();
    }
  });
  it("prefers replies that fit what the other person said", () => {
    expect(phrasebookReplies("hotel", "en", "May I see your passport?")[0]).toBe("Here is my passport.");
    expect(phrasebookReplies("hotel", "tl", null)).toEqual(PHRASEBOOK.hotel.slice(0, 3).map((p) => p.tl));
    expect(phrasebookReplies("taxi", "en", "Cash or card?")[0]).toBe("I'll pay in cash.");
  });
  it("always returns 3 replies", () => {
    for (const s of SCENARIOS) expect(phrasebookReplies(s.id, "tl", "kumusta")).toHaveLength(3);
  });
});

describe("Gemini Nano suggestions", () => {
  it("builds a prompt with the situation and what they said", () => {
    const p = suggestionPrompt({
      scenario: "hotel",
      lang: "tl",
      theySaid: "Check-out is at 11.",
      history: [],
    });
    expect(p).toContain("Situation: Hotel");
    expect(p).toContain("Check-out is at 11.");
    expect(p).toContain("Filipino (Tagalog)");
  });
  it("cleans numbering, bullets, quotes and chatter", () => {
    expect(parseSuggestions('Here are 3 replies:\n1. "Salamat po!"\n- Puwede po bang 12?\n• Okay po.\n4) Extra')).toEqual([
      "Salamat po!",
      "Puwede po bang 12?",
      "Okay po.",
    ]);
  });
});

describe("hint replies and merging", async () => {
  const { hintReplies, mergeReplies } = await import("./talk");
  it("answers a passport request first", () => {
    expect(hintReplies("tl", "Maaari ko bang makita ang iyong pasaporte?")[0]).toBe("Heto po ang pasaporte ko.");
    expect(hintReplies("en", "Good evening")).toEqual([]);
  });
  it("merges without duplicates, keeping order, max 3", () => {
    expect(mergeReplies(["Heto po ang pasaporte ko."], ["Heto po ang pasaporte ko!", "Salamat po.", "Opo.", "Sige po."])).toEqual([
      "Heto po ang pasaporte ko.",
      "Salamat po.",
      "Opo.",
    ]);
  });
});

describe("generic question reply", async () => {
  const { hintReplies } = await import("./talk");
  it("is used only when nothing specific matches", () => {
    expect(hintReplies("tl", "Maaari ko bang makita ang iyong pasaporte?")).toEqual(["Heto po ang pasaporte ko."]);
    expect(hintReplies("en", "Anything else?")).toEqual(["That's all, thank you."]);
  });
});

describe("hand-written translations and polishing", async () => {
  const { curatedTranslation, acceptPolish, polishPrompt, PHRASEBOOK, SCENARIOS } = await import("./talk");
  it("every phrase has Japanese, Korean and Chinese", () => {
    for (const s of SCENARIOS) for (const p of PHRASEBOOK[s.id]) expect(p.t.ja && p.t.ko && p.t.zh).toBeTruthy();
  });
  it("finds the hand-written translation from Filipino or English, ignoring punctuation", () => {
    expect(curatedTranslation("Anong oras po ang check-out?", "ja")).toBe("チェックアウトは何時ですか？");
    expect(curatedTranslation("what time is check-out", "ko")).toBe("체크아웃은 몇 시예요?");
    expect(curatedTranslation("Heto po ang pasaporte ko.", "en")).toBe("Here is my passport.");
    expect(curatedTranslation("Where I can find Beijing Towers.", "ja")).toBeNull();
    expect(curatedTranslation("Anong oras po ang check-out?", "th")).toBeNull();
  });
  it("accepts a faithful rewrite that keeps names", () => {
    expect(acceptPolish("Where I can find Beijing Towers.", "Where can I find Beijing Tower?")).toBe("Where can I find Beijing Tower?");
    expect(polishPrompt("x", "hotel")).toContain("Keep names");
  });
  it("rejects chatter, dropped names and runaway answers", () => {
    expect(acceptPolish("Where I can find Beijing Towers.", "Sure! Here is the sentence:")).toBeNull();
    expect(acceptPolish("Where I can find Beijing Towers.", "Where can I find the tower?")).toBeNull();
    expect(acceptPolish("hi", "x".repeat(400))).toBeNull();
  });
});

describe("Gemini Nano translation checks", () => {
  it("accepts natural Japanese and strips labels and quotes", () => {
    expect(acceptTranslation("Where can I find Beijing Tower?", "Japanese: 「北京タワーはどこですか？」", "ja")).toBe("北京タワーはどこですか？");
  });
  it("rejects English, chatter and the wrong script", () => {
    expect(acceptTranslation("Where is the station?", "Sure! Here is the translation.", "ja")).toBeNull();
    expect(acceptTranslation("Where is the station?", "역은 어디예요?", "ja")).toBeNull();
    expect(acceptTranslation("Where is the station?", "駅はどこですか？", "zh")).toBeNull();
    expect(acceptTranslation("Where is the station?", "驿站在哪里？", "zh")).toBe("驿站在哪里？");
  });
  it("rejects a translation that drops or changes a number", () => {
    expect(acceptTranslation("We are 2 people.", "二人です。", "ja")).toBeNull();
    expect(acceptTranslation("We are 2 people.", "2人です。", "ja")).toBe("2人です。");
    expect(acceptTranslation("Room 305, please.", "３０５号室をお願いします。", "ja")).toBe("３０５号室をお願いします。");
  });
  it("reads their words into plain English, keeping numbers", () => {
    expect(acceptReading("チェックアウトは11時です。", "Check-out is at 11.")).toBe("Check-out is at 11.");
    expect(acceptReading("チェックアウトは11時です。", "Check-out is at noon.")).toBeNull();
    expect(acceptReading("ありがとう", "ありがとう means thank you")).toBeNull();
  });
  it("only offers Nano for Japanese, Korean and Chinese", () => {
    expect(isNanoLang("ja")).toBe(true);
    expect(isNanoLang("th")).toBe(false);
    expect(translatePrompt("Hi", "ko", "taxi")).toContain("a taxi driver");
  });
});
