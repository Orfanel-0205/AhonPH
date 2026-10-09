import { describe, expect, it } from "vitest";
import { parseSuggestions, PHRASEBOOK, phrasebookReplies, SCENARIOS, suggestionPrompt } from "./talk";

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
    const p = suggestionPrompt({ scenario: "hotel", lang: "tl", theySaid: "Check-out is at 11.", history: [] });
    expect(p).toContain("Situation: Hotel");
    expect(p).toContain("Check-out is at 11.");
    expect(p).toContain("Filipino (Tagalog)");
  });
  it("cleans numbering, bullets, quotes and chatter", () => {
    expect(parseSuggestions('Here are 3 replies:\n1. "Salamat po!"\n- Puwede po bang 12?\n• Okay po.\n4) Extra')).toEqual(["Salamat po!", "Puwede po bang 12?", "Okay po."]);
  });
});
