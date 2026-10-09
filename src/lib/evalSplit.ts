/**
 * Who-had-what sentences for measuring the bill-split readers. Written by us on Oct 10, 2026 (about
 * 4 AM), after the rule reader existed: a development set, not a held-out test. Several are hard on
 * purpose ("lahat ng beer", "except", "libre ko na lahat", "inumin").
 *
 * Items are the AI Lab's sample receipt; people are Ako (the speaker), Maria, Jun. An empty list
 * means everyone shares the item.
 */
export const SPLIT_ITEMS = ["生ビール (Draft beer)", "枝豆 (Edamame)", "焼き鳥盛り合わせ (Assorted yakitori)", "唐揚げ (Karaage)", "親子丼 (Oyakodon)"];
export const SPLIT_ALIASES = [
  ["生ビール", "Draft beer", "beer"],
  ["枝豆", "Edamame", "edamame", "soybeans"],
  ["焼き鳥盛り合わせ", "Assorted yakitori", "yakitori", "skewers"],
  ["唐揚げ", "Karaage", "karaage", "fried chicken"],
  ["親子丼", "Oyakodon", "oyakodon", "chicken and egg"],
];
export const SPLIT_PEOPLE = ["Ako", "Maria", "Jun"];

export interface SplitCase {
  said: string;
  expected: number[][];
}

export const SPLIT_CASES: SplitCase[] = [
  { said: "Kay Maria ang karaage, kay Jun ang yakitori, hati kaming lahat sa beer at edamame, akin ang oyakodon.", expected: [[], [], [2], [1], [0]] },
  { said: "Kay Maria ang karaage at isang beer, kay Jun ang yakitori at isang beer, hati kaming lahat sa edamame, akin ang oyakodon.", expected: [[1, 2], [], [2], [1], [0]] },
  { said: "Maria had the fried chicken, Jun had the yakitori, we all shared the beer and edamame, the oyakodon is mine", expected: [[], [], [2], [1], [0]] },
  { said: "Akin ang beer at oyakodon, kay Maria ang edamame, kay Jun ang karaage at yakitori.", expected: [[0], [1], [2], [2], [0]] },
  { said: "Hati kami ni Maria sa karaage, kay Jun ang beer, akin ang oyakodon, lahat sa yakitori at edamame.", expected: [[2], [], [], [0, 1], [0]] },
  { said: "Jun: beer and yakitori. Maria: edamame. Me: karaage and oyakodon.", expected: [[2], [1], [2], [0], [0]] },
  { said: "Everyone shared everything except the oyakodon, which is Maria's.", expected: [[], [], [], [], [1]] },
  { said: "Libre ko na lahat.", expected: [[0], [0], [0], [0], [0]] },
  { said: "Kay Jun lahat ng inumin, kay Maria ang edamame, ako sa oyakodon, hati kami ni Jun sa yakitori at karaage.", expected: [[2], [1], [0, 2], [0, 2], [0]] },
  { said: "Maria and Jun split the beer, I had the oyakodon and edamame, Jun also had the yakitori, Maria had the karaage.", expected: [[1, 2], [0], [2], [1], [0]] },
  { said: "Sa akin ang edamame at beer, kina Maria at Jun ang yakitori, karaage at oyakodon.", expected: [[0], [0], [1, 2], [1, 2], [1, 2]] },
  { said: "Treat ni Maria ang lahat ng beer, the rest we split evenly.", expected: [[1], [], [], [], []] },
];

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Items right, and whether the whole sentence is right. */
export function scoreSplit(got: number[][], expected: number[][]): { items: number; all: boolean } {
  const items = expected.filter((e, i) => same([...(got[i] ?? [])].sort((a, b) => a - b), e)).length;
  return { items, all: items === expected.length };
}

/**
 * Held-out: written and committed before the rule reader was improved on SPLIT_CASES, and scored
 * once afterwards. Same items and people.
 */
export const SPLIT_HOLDOUT: SplitCase[] = [
  { said: "Si Maria ang nag-order ng edamame, kay Jun ang dalawang beer, akin ang karaage, hati kaming tatlo sa yakitori at oyakodon.", expected: [[2], [1], [], [0], []] },
  { said: "The beer was for Maria and me, Jun ate the oyakodon, and everybody had some edamame, yakitori and karaage.", expected: [[0, 1], [], [], [], [2]] },
  { said: "Ako na sa yakitori at karaage, kay Maria ang oyakodon at kay Jun ang beer, edamame para sa lahat.", expected: [[2], [], [0], [0], [1]] },
  { said: "Sagot ni Jun ang beer, the rest split natin.", expected: [[2], [], [], [], []] },
  { said: "Maria: oyakodon, karaage. Jun: yakitori. Edamame and beer, all of us.", expected: [[], [], [2], [1], [1]] },
  { said: "Jun and Maria had the karaage, I had the oyakodon, the rest is shared.", expected: [[], [], [], [1, 2], [0]] },
  { said: "Akin lahat ng beer, kay Maria ang edamame at yakitori, kay Jun ang oyakodon at karaage.", expected: [[0], [1], [1], [2], [2]] },
  { said: "Hati kami ni Jun sa oyakodon; Maria had beer; everyone shared edamame, yakitori, karaage.", expected: [[1], [], [], [], [0, 2]] },
];
