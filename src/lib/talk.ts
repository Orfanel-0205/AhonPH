/**
 * Usap (Talk): suggested replies for a Filipino traveler in a conversation abroad.
 * Gemini Nano writes suggestions on the phone; when it can't, the phrase bank below fills the bubbles.
 * Phrase-bank entries carry hand-written translations, so common phrases never depend on machine translation.
 */

export type MeLang = "tl" | "en";
export type Scenario = "hotel" | "taxi" | "restaurant" | "shopping" | "directions" | "emergency";

/** Languages with hand-written phrase translations. Others use on-device machine translation. */
export type CuratedLang = "ja" | "ko" | "zh";

interface Phrase {
  tl: string;
  en: string;
  t: Record<CuratedLang, string>;
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
    {
      tl: "May reservation po ako sa pangalan na ito.",
      en: "I have a reservation under this name.",
      t: {
        ja: "この名前で予約しています。",
        ko: "이 이름으로 예약했습니다.",
        zh: "我用这个名字预订了房间。",
      },
    },
    {
      tl: "Anong oras po ang check-out?",
      en: "What time is check-out?",
      t: {
        ja: "チェックアウトは何時ですか？",
        ko: "체크아웃은 몇 시예요?",
        zh: "几点退房？",
      },
    },
    {
      tl: "Ano po ang Wi-Fi password?",
      en: "What is the Wi-Fi password?",
      t: {
        ja: "Wi-Fiのパスワードは何ですか？",
        ko: "와이파이 비밀번호가 뭐예요?",
        zh: "Wi-Fi密码是多少？",
      },
    },
    {
      tl: "Puwede po bang iwan muna ang bagahe ko dito?",
      en: "Can I leave my luggage here for now?",
      t: {
        ja: "荷物をここに預けてもいいですか？",
        ko: "짐을 여기에 잠시 맡겨도 될까요?",
        zh: "我可以先把行李寄存在这里吗？",
      },
    },
    {
      tl: "Puwede po bang late check-out?",
      en: "Can I have a late check-out?",
      t: {
        ja: "レイトチェックアウトはできますか？",
        ko: "레이트 체크아웃이 가능할까요?",
        zh: "可以延迟退房吗？",
      },
    },
    {
      tl: "Kasama na po ba ang almusal?",
      en: "Is breakfast included?",
      t: {
        ja: "朝食は付いていますか？",
        ko: "조식이 포함되어 있나요?",
        zh: "含早餐吗？",
      },
    },
  ],
  taxi: [
    {
      tl: "Pakihatid po ako sa address na ito.",
      en: "Please take me to this address.",
      t: {
        ja: "この住所までお願いします。",
        ko: "이 주소로 가 주세요.",
        zh: "请带我去这个地址。",
      },
    },
    {
      tl: "Magkano po hanggang doon?",
      en: "How much is it to get there?",
      t: {
        ja: "そこまでいくらかかりますか？",
        ko: "거기까지 얼마예요?",
        zh: "到那里要多少钱？",
      },
    },
    {
      tl: "Pakigamit po ang metro.",
      en: "Please use the meter.",
      t: {
        ja: "メーターを使ってください。",
        ko: "미터기를 켜 주세요.",
        zh: "请打表。",
      },
    },
    {
      tl: "Dito na lang po.",
      en: "Please stop here.",
      t: {
        ja: "ここで止めてください。",
        ko: "여기서 세워 주세요.",
        zh: "请在这里停车。",
      },
    },
    {
      tl: "Puwede po bang magbayad gamit ang card?",
      en: "Can I pay by card?",
      t: {
        ja: "カードで払えますか？",
        ko: "카드로 결제할 수 있나요?",
        zh: "可以刷卡吗？",
      },
    },
  ],
  restaurant: [
    {
      tl: "Mesa po para sa dalawa.",
      en: "A table for two, please.",
      t: { ja: "2名でお願いします。", ko: "두 명이요.", zh: "两位，谢谢。" },
    },
    {
      tl: "Ano po ang mairerekomenda ninyo?",
      en: "What do you recommend?",
      t: {
        ja: "おすすめは何ですか？",
        ko: "추천 메뉴가 뭐예요?",
        zh: "有什么推荐的吗？",
      },
    },
    {
      tl: "Huwag po masyadong maanghang.",
      en: "Not too spicy, please.",
      t: {
        ja: "あまり辛くしないでください。",
        ko: "너무 맵지 않게 해 주세요.",
        zh: "请不要太辣。",
      },
    },
    {
      tl: "May allergy po ako sa hipon.",
      en: "I am allergic to shrimp.",
      t: {
        ja: "エビのアレルギーがあります。",
        ko: "새우 알레르기가 있어요.",
        zh: "我对虾过敏。",
      },
    },
    {
      tl: "Pahingi po ng bill.",
      en: "The bill, please.",
      t: { ja: "お会計お願いします。", ko: "계산할게요.", zh: "买单，谢谢。" },
    },
  ],
  shopping: [
    {
      tl: "Magkano po ito?",
      en: "How much is this?",
      t: {
        ja: "これはいくらですか？",
        ko: "이거 얼마예요?",
        zh: "这个多少钱？",
      },
    },
    {
      tl: "May mas mura po ba?",
      en: "Do you have something cheaper?",
      t: {
        ja: "もう少し安いものはありますか？",
        ko: "좀 더 싼 거 있어요?",
        zh: "有便宜一点的吗？",
      },
    },
    {
      tl: "Puwede po bang tax-free?",
      en: "Can I get tax-free shopping?",
      t: { ja: "免税できますか？", ko: "면세 되나요?", zh: "可以免税吗？" },
    },
    {
      tl: "Titingin-tingin lang po ako.",
      en: "I'm just looking, thank you.",
      t: {
        ja: "見ているだけです。ありがとうございます。",
        ko: "그냥 구경하는 중이에요. 감사합니다.",
        zh: "我只是看看，谢谢。",
      },
    },
    {
      tl: "Puwede ko po bang sukatin?",
      en: "Can I try this on?",
      t: {
        ja: "試着してもいいですか？",
        ko: "입어 봐도 될까요?",
        zh: "可以试穿吗？",
      },
    },
  ],
  directions: [
    {
      tl: "Saan po ang pinakamalapit na istasyon ng tren?",
      en: "Where is the nearest train station?",
      t: {
        ja: "一番近い駅はどこですか？",
        ko: "가장 가까운 역이 어디예요?",
        zh: "最近的车站在哪里？",
      },
    },
    {
      tl: "Paano po pumunta sa lugar na ito?",
      en: "How do I get to this place?",
      t: {
        ja: "ここへはどうやって行けばいいですか？",
        ko: "여기에 어떻게 가요?",
        zh: "这个地方怎么走？",
      },
    },
    {
      tl: "Malayo pa po ba?",
      en: "Is it far from here?",
      t: {
        ja: "ここから遠いですか？",
        ko: "여기서 멀어요?",
        zh: "离这里远吗？",
      },
    },
    {
      tl: "Saan po ang banyo?",
      en: "Where is the restroom?",
      t: {
        ja: "トイレはどこですか？",
        ko: "화장실이 어디예요?",
        zh: "洗手间在哪里？",
      },
    },
  ],
  emergency: [
    {
      tl: "Tulong po!",
      en: "Help, please!",
      t: { ja: "助けてください！", ko: "도와주세요!", zh: "请帮帮我！" },
    },
    {
      tl: "Pakitawag po ng ambulansya.",
      en: "Please call an ambulance.",
      t: {
        ja: "救急車を呼んでください。",
        ko: "구급차를 불러 주세요.",
        zh: "请叫救护车。",
      },
    },
    {
      tl: "Nawala po ang pasaporte ko.",
      en: "I lost my passport.",
      t: {
        ja: "パスポートをなくしました。",
        ko: "여권을 잃어버렸어요.",
        zh: "我的护照丢了。",
      },
    },
    {
      tl: "Saan po ang Philippine Embassy?",
      en: "Where is the Philippine Embassy?",
      t: {
        ja: "フィリピン大使館はどこですか？",
        ko: "필리핀 대사관이 어디예요?",
        zh: "菲律宾大使馆在哪里？",
      },
    },
    {
      tl: "Hindi ko po maintindihan.",
      en: "I don't understand.",
      t: { ja: "わかりません。", ko: "잘 모르겠어요.", zh: "我听不懂。" },
    },
  ],
};

/** Replies that fit common questions, whatever the situation. Matched on the translated text. */
const REPLY_HINTS: { match: RegExp; reply: Phrase }[] = [
  {
    match: /passport|pasaporte/i,
    reply: {
      tl: "Heto po ang pasaporte ko.",
      en: "Here is my passport.",
      t: {
        ja: "こちらがパスポートです。",
        ko: "여기 여권이요.",
        zh: "这是我的护照。",
      },
    },
  },
  {
    match: /\b(cash|card|pay|bayad)\b/i,
    reply: {
      tl: "Cash po.",
      en: "I'll pay in cash.",
      t: { ja: "現金で払います。", ko: "현금으로 낼게요.", zh: "我付现金。" },
    },
  },
  {
    match: /how many|ilan|people|tao/i,
    reply: {
      tl: "Dalawa po kami.",
      en: "There are two of us.",
      t: { ja: "二人です。", ko: "두 명이에요.", zh: "我们两个人。" },
    },
  },
  {
    match: /name|pangalan/i,
    reply: {
      tl: "Heto po ang pangalan ko.",
      en: "Here is my name.",
      t: {
        ja: "こちらが私の名前です。",
        ko: "이게 제 이름이에요.",
        zh: "这是我的名字。",
      },
    },
  },
  {
    match: /bag|receipt|resibo/i,
    reply: {
      tl: "Opo, salamat.",
      en: "Yes, please. Thank you.",
      t: {
        ja: "はい、お願いします。ありがとうございます。",
        ko: "네, 부탁드려요. 감사합니다.",
        zh: "好的，谢谢。",
      },
    },
  },
];

/** Catch-all for questions; used only when no specific hint matches. */
const GENERIC_QUESTION: { match: RegExp; reply: Phrase } = {
  match: /\?|anything else|iba pa/i,
  reply: {
    tl: "Wala na po, salamat.",
    en: "That's all, thank you.",
    t: {
      ja: "以上です。ありがとうございます。",
      ko: "이게 다예요. 감사합니다.",
      zh: "就这些，谢谢。",
    },
  },
};
REPLY_HINTS.push(GENERIC_QUESTION);

const ALWAYS: Phrase[] = [
  {
    tl: "Salamat po!",
    en: "Thank you very much!",
    t: { ja: "ありがとうございます！", ko: "감사합니다!", zh: "非常感谢！" },
  },
  {
    tl: "Pakiulit po, dahan-dahan lang.",
    en: "Could you say that again, slowly?",
    t: {
      ja: "もう一度ゆっくり言っていただけますか？",
      ko: "다시 한번 천천히 말씀해 주시겠어요?",
      zh: "可以再慢慢说一遍吗？",
    },
  },
];

/** Shown on the "My stay" card for drivers. */
export const TAKE_ME_TO_HOTEL: Phrase = {
  tl: "Pakihatid po ako sa hotel na ito.",
  en: "Please take me to this hotel.",
  t: {
    ja: "このホテルまでお願いします。",
    ko: "이 호텔로 가 주세요.",
    zh: "请带我去这家酒店。",
  },
};

const ALL_PHRASES: Phrase[] = [...Object.values(PHRASEBOOK).flat(), ...REPLY_HINTS.map((h) => h.reply), ...ALWAYS, TAKE_ME_TO_HOTEL];

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The hand-written translation of a phrase-bank sentence (in Filipino or English), or null when the
 * text is not a phrase-bank sentence or the target language has no hand-written version.
 */
export function curatedTranslation(text: string, target: string): string | null {
  const k = key(text);
  const p = ALL_PHRASES.find((x) => key(x.tl) === k || key(x.en) === k);
  if (!p) return null;
  if (target === "en") return p.en;
  if (target === "tl") return p.tl;
  return (p.t as Record<string, string>)[target] ?? null;
}

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
    const k = key(r);
    if (!k || seen.has(k)) continue;
    seen.add(k);
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

const LANG_NAME: Record<MeLang, string> = {
  tl: "Filipino (Tagalog)",
  en: "English",
};

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

/**
 * Prompt for Gemini Nano to tidy what the traveler wants to say before it is machine-translated:
 * the small offline translator does far better with short, grammatical, standard English.
 */
export function polishPrompt(english: string, scenario: Scenario): string {
  const situation = SCENARIOS.find((s) => s.id === scenario)?.label ?? scenario;
  return `A Filipino traveler wants to say this to someone (situation: ${situation}), and it will be machine-translated:
"${english}"
Rewrite it as one short, clear, polite, grammatical English sentence with the same meaning. Keep names of places, people and things exactly as written. Do not add information.
Reply with the sentence only.`;
}

/** Accepts Gemini Nano's polished sentence only if it looks like a faithful one-line rewrite. */
export function acceptPolish(original: string, polished: string): string | null {
  const p =
    polished
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0)
      ?.replace(/^["'“”]+|["'“”]+$/g, "") ?? "";
  if (!p || p.length > Math.max(160, original.length * 2.5)) return null;
  if (/^(sure|here|okay|rewrite|sentence)\b/i.test(p) || /:\s*$/.test(p)) return null;
  // Names must survive: every capitalized word in the original (except the first) must still appear.
  const names = original
    .split(/\s+/)
    .slice(1)
    .filter((w) => /^\p{Lu}/u.test(w))
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length > 1);
  const pl = p.toLowerCase();
  if (names.some((n) => !pl.includes(n.replace(/s$/, "")))) return null;
  return p;
}

/**
 * Languages where Gemini Nano writes the translation itself. ML Kit's small offline models give stiff,
 * word-for-word Japanese, Korean and Chinese; Nano writes what a local would say. Code checks every answer.
 */
export const NANO_TRANSLATE_LANGS = ["ja", "ko", "zh"] as const;
export type NanoLang = (typeof NANO_TRANSLATE_LANGS)[number];
export const isNanoLang = (code: string): code is NanoLang => (NANO_TRANSLATE_LANGS as readonly string[]).includes(code);

const NANO_LANG: Record<NanoLang, { name: string; style: string; script: RegExp; foreign?: RegExp }> = {
  ja: {
    name: "Japanese",
    style: "Use polite です/ます form, the way a guest talks to staff.",
    script: /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
  },
  ko: {
    name: "Korean",
    style: "Use polite 요 form (해요체).",
    script: /\p{Script=Hangul}/u,
  },
  zh: {
    name: "Mandarin Chinese",
    style: "Use Simplified Chinese characters.",
    script: /\p{Script=Han}/u,
    foreign: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u,
  },
};

const STAFF: Record<Scenario, string> = {
  hotel: "hotel front desk staff",
  taxi: "a taxi driver",
  restaurant: "restaurant staff",
  shopping: "a shop clerk",
  directions: "a local person on the street",
  emergency: "someone who can help in an emergency",
};

const digitsOf = (s: string): string[] => s.match(/\d+/g) ?? [];

/** First non-empty line, without wrapping quotes or a "Japanese:" style label. */
function firstLine(text: string): string {
  const line =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  return line
    .replace(/^(?:japanese|korean|chinese|mandarin|english|translation)\s*[:：]\s*/i, "")
    .replace(/^["'“”「『]+|["'“”」』]+$/g, "")
    .trim();
}

/** Prompt for Gemini Nano to say the traveler's English the way a native speaker would. */
export function translatePrompt(english: string, target: NanoLang, scenario: Scenario): string {
  const l = NANO_LANG[target];
  return `A Filipino traveler is talking to ${STAFF[scenario]} in ${l.name}.
Say the traveler's sentence in natural, everyday ${l.name}, the way a native speaker would actually say it. Keep it short. ${l.style}
Keep the same meaning. Write names of places and people the way locals write them. Keep every number.
Reply with the ${l.name} sentence only.
Traveler: ${english}`;
}

/**
 * Accepts Nano's translation only if it is one line in the right script, keeps every number from the
 * English, and is not chatter or an echo of the English. Otherwise the app falls back to ML Kit.
 */
export function acceptTranslation(english: string, output: string, target: NanoLang): string | null {
  // Larger models often add a romanization: "カードで支払えますか？ (Kādo de shiharaiemasu ka?)".
  const t = firstLine(output)
    .replace(/\s*[(（][^()（）]*\p{Script=Latin}[^()（）]*[)）]\s*$/u, "")
    .trim();
  const l = NANO_LANG[target];
  if (!t || t.length > english.length * 2 + 20) return null;
  if (!l.script.test(t) || (l.foreign && l.foreign.test(t))) return null;
  // Mostly Latin letters means it answered in English (or mixed in an explanation).
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  if (latin > t.length * 0.4) return null;
  const nums = digitsOf(t.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)));
  if (digitsOf(english).some((d) => !nums.includes(d))) return null;
  return t;
}

/** Prompt for Gemini Nano to read what the other person said into plain English. */
export function readPrompt(text: string, from: NanoLang, scenario: Scenario): string {
  return `A Filipino traveler is talking to ${STAFF[scenario]}. This is what they said in ${NANO_LANG[from].name} (it may come from speech recognition, so small mistakes are possible):
${text}
Translate it into simple, natural English. Keep every number and name. Reply with the English only.`;
}

/** Accepts Nano's English reading only if it is plain English that keeps the numbers. */
export function acceptReading(original: string, output: string): string | null {
  const t = firstLine(output);
  if (!t || t.length > Math.max(200, original.length * 6)) return null;
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Han}]/u.test(t)) return null;
  if (/^(sure|here|okay|the (speaker|person|staff) (said|says))\b/i.test(t)) return null;
  const src = original.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  if (digitsOf(src).some((d) => !digitsOf(t).includes(d))) return null;
  return t;
}

/** Cleans Gemini Nano's answer into at most 3 reply bubbles. */
export function parseSuggestions(text: string): string[] {
  return (
    text
      .split("\n")
      .map((l) =>
        l
          .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
          .replace(/^["'“”]+|["'“”]+$/g, "")
          .trim(),
      )
      // Drop preambles like "Here are 3 replies:" but keep real replies such as "Okay po."
      .filter((l) => l.length > 1 && l.length <= 120 && !/:\s*$/.test(l) && !/^here (are|is)\b/i.test(l))
      .slice(0, 3)
  );
}
