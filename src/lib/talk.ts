/**
 * Usap (Talk): suggested replies for a Filipino traveler in a conversation abroad.
 * Gemini Nano writes suggestions on the phone; when it can't, the phrase bank below fills the bubbles.
 */

export type MeLang = "tl" | "en";
export type Scenario = "hotel" | "taxi" | "restaurant" | "shopping" | "directions" | "emergency";

interface Phrase {
  tl: string;
  en: string;
}

export const SCENARIOS: { id: Scenario; label: string; emoji: string }[] = [
  { id: "hotel", label: "Hotel", emoji: "🏨" },
  { id: "taxi", label: "Taxi", emoji: "🚕" },
  { id: "restaurant", label: "Kainan", emoji: "🍜" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "directions", label: "Direksyon", emoji: "🧭" },
  { id: "emergency", label: "Emergency", emoji: "🆘" },
];

export const PHRASEBOOK: Record<Scenario, Phrase[]> = {
  hotel: [
    { tl: "May reservation po ako sa pangalan na ito.", en: "I have a reservation under this name." },
    { tl: "Anong oras po ang check-out?", en: "What time is check-out?" },
    { tl: "Ano po ang Wi-Fi password?", en: "What is the Wi-Fi password?" },
    { tl: "Puwede po bang iwan muna ang bagahe ko dito?", en: "Can I leave my luggage here for now?" },
    { tl: "Puwede po bang late check-out?", en: "Can I have a late check-out?" },
    { tl: "Kasama na po ba ang almusal?", en: "Is breakfast included?" },
  ],
  taxi: [
    { tl: "Pakihatid po ako sa address na ito.", en: "Please take me to this address." },
    { tl: "Magkano po hanggang doon?", en: "How much is it to get there?" },
    { tl: "Pakigamit po ang metro.", en: "Please use the meter." },
    { tl: "Dito na lang po.", en: "Please stop here." },
    { tl: "Puwede po bang magbayad gamit ang card?", en: "Can I pay by card?" },
  ],
  restaurant: [
    { tl: "Mesa po para sa dalawa.", en: "A table for two, please." },
    { tl: "Ano po ang mairerekomenda ninyo?", en: "What do you recommend?" },
    { tl: "Huwag po masyadong maanghang.", en: "Not too spicy, please." },
    { tl: "May allergy po ako sa hipon.", en: "I am allergic to shrimp." },
    { tl: "Pahingi po ng bill.", en: "The bill, please." },
  ],
  shopping: [
    { tl: "Magkano po ito?", en: "How much is this?" },
    { tl: "May mas mura po ba?", en: "Do you have something cheaper?" },
    { tl: "Puwede po bang tax-free?", en: "Can I get tax-free shopping?" },
    { tl: "Titingin-tingin lang po ako.", en: "I'm just looking, thank you." },
    { tl: "Puwede ko po bang sukatin?", en: "Can I try this on?" },
  ],
  directions: [
    { tl: "Saan po ang pinakamalapit na istasyon ng tren?", en: "Where is the nearest train station?" },
    { tl: "Paano po pumunta sa lugar na ito?", en: "How do I get to this place?" },
    { tl: "Malayo pa po ba?", en: "Is it far from here?" },
    { tl: "Saan po ang banyo?", en: "Where is the restroom?" },
  ],
  emergency: [
    { tl: "Tulong po!", en: "Help, please!" },
    { tl: "Pakitawag po ng ambulansya.", en: "Please call an ambulance." },
    { tl: "Nawala po ang pasaporte ko.", en: "I lost my passport." },
    { tl: "Saan po ang Philippine Embassy?", en: "Where is the Philippine Embassy?" },
    { tl: "Hindi ko po maintindihan.", en: "I don't understand." },
  ],
};

/** Replies that fit common questions, whatever the situation. Matched on the translated text. */
const REPLY_HINTS: { match: RegExp; reply: Phrase }[] = [
  { match: /passport|pasaporte/i, reply: { tl: "Heto po ang pasaporte ko.", en: "Here is my passport." } },
  { match: /\b(cash|card|pay|bayad)\b/i, reply: { tl: "Cash po.", en: "I'll pay in cash." } },
  { match: /how many|ilan|people|tao/i, reply: { tl: "Dalawa po kami.", en: "There are two of us." } },
  { match: /name|pangalan/i, reply: { tl: "Heto po ang pangalan ko.", en: "Here is my name." } },
  { match: /bag|receipt|resibo/i, reply: { tl: "Opo, salamat.", en: "Yes, please. Thank you." } },
];

/** Catch-all for questions; used only when no specific hint matches. */
const GENERIC_QUESTION = { match: /\?|anything else|iba pa/i, reply: { tl: "Wala na po, salamat.", en: "That's all, thank you." } };
REPLY_HINTS.push(GENERIC_QUESTION);

const ALWAYS: Phrase[] = [
  { tl: "Salamat po!", en: "Thank you very much!" },
  { tl: "Pakiulit po, dahan-dahan lang.", en: "Could you say that again, slowly?" },
];

/** Phrase-bank replies that directly answer what the other person said (e.g. a passport request). */
export function hintReplies(lang: MeLang, theySaid: string): string[] {
  const matched = REPLY_HINTS.filter((h) => h.match.test(theySaid));
  // The catch-all question reply only helps when nothing more specific fits.
  const specific = matched.filter((h) => h !== GENERIC_QUESTION);
  return (specific.length ? specific : matched).slice(0, 2).map((h) => h.reply[lang]);
}

/** Merges reply ideas, keeping order and dropping near-duplicates; at most 3. */
export function mergeReplies(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of lists.flat()) {
    const key = r.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length === 3) break;
  }
  return out;
}

/** Up to 3 replies from the phrase bank, preferring ones that fit what the other person said. */
export function phrasebookReplies(scenario: Scenario, lang: MeLang, theySaid: string | null): string[] {
  const picks: Phrase[] = [];
  if (theySaid) for (const h of REPLY_HINTS) if (h.match.test(theySaid) && picks.length < 2) picks.push(h.reply);
  for (const p of [...PHRASEBOOK[scenario], ...ALWAYS]) {
    if (picks.length >= 3) break;
    if (!picks.includes(p)) picks.push(p);
  }
  return picks.slice(0, 3).map((p) => p[lang]);
}

const LANG_NAME: Record<MeLang, string> = { tl: "Filipino (Tagalog)", en: "English" };

/** Prompt for Gemini Nano: 3 short replies the traveler could say next, in their own language. */
export function suggestionPrompt(args: { scenario: Scenario; lang: MeLang; theySaid: string; history: { who: "me" | "them"; text: string }[] }): string {
  const situation = SCENARIOS.find((s) => s.id === args.scenario)?.label ?? args.scenario;
  const recent = args.history
    .slice(-4)
    .map((h) => `${h.who === "me" ? "Traveler" : "Other person"}: ${h.text}`)
    .join("\n");
  return `You help a Filipino traveler reply during a conversation abroad. Situation: ${situation}.
${recent ? `Conversation so far (translated):\n${recent}\n` : ""}The other person just said (translated): "${args.theySaid}"
Write exactly 3 short, polite replies the traveler could say next, in ${LANG_NAME[args.lang]}. Each under 12 words.
Each reply must directly answer or respond to what the other person just said. Be cooperative; a traveler wants to get things done.
One reply per line. No numbering, no quotes, no explanations.`;
}

/** Cleans Gemini Nano's answer into at most 3 reply bubbles. */
export function parseSuggestions(text: string): string[] {
  return text
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/^["'“”]+|["'“”]+$/g, "")
        .trim(),
    )
    // Drop preambles like "Here are 3 replies:" but keep real replies such as "Okay po."
    .filter((l) => l.length > 1 && l.length <= 120 && !/:\s*$/.test(l) && !/^here (are|is)\b/i.test(l))
    .slice(0, 3);
}
