/**
 * Hatian: splitting a receipt among travel companions. Code does every number: each item is shared
 * equally by the people who had it, tax/service is spread in proportion to what each person ordered,
 * and the shares are rounded so they add up to the printed total exactly.
 */

export interface SplitResult {
  /** Amount per person, in the receipt's currency, same order as `people`. */
  amounts: number[];
  /** Tax, service or discount spread across people (total minus items). */
  extra: number;
}

/**
 * `shares[i]` lists the people (by index) who shared item i; an empty list means everyone.
 * `decimals` is 0 for yen/won, 2 for currencies with cents.
 */
export function splitBill(itemTotals: number[], shares: number[][], peopleCount: number, grandTotal: number, decimals = 0): SplitResult {
  const n = Math.max(1, peopleCount);
  const base = new Array<number>(n).fill(0);
  itemTotals.forEach((total, i) => {
    const who = (shares[i] ?? []).filter((p) => p >= 0 && p < n);
    const sharers = who.length ? who : [...Array(n).keys()];
    for (const p of sharers) base[p] += total / sharers.length;
  });
  const itemsSum = itemTotals.reduce((a, b) => a + b, 0);
  const extra = grandTotal - itemsSum;
  const raw = base.map((b) => b + (itemsSum > 0 ? (extra * b) / itemsSum : extra / n));

  // Largest remainder: round down, then give the leftover units to the biggest fractions.
  const unit = 10 ** decimals;
  const scaled = raw.map((r) => r * unit);
  const floors = scaled.map((v) => Math.floor(v + 1e-9));
  let left = Math.round(grandTotal * unit) - floors.reduce((a, b) => a + b, 0);
  const order = scaled.map((v, i) => ({ i, frac: v - Math.floor(v + 1e-9) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  return { amounts: floors.map((f) => f / unit), extra };
}

/** Words that mean the speaker in Filipino or English; they map to the first person ("Ako"). */
const SELF = /^(ako|akin|ko|me|i|myself|mine)$/i;

export function splitPrompt(items: string[], people: string[], said: string): string {
  // Asking for each item's plain-English meaning first links "beer" in the sentence to 生ビール on the receipt.
  return `Items on a shared restaurant receipt:
${items.map((it, i) => `${i + 1}. ${it}`).join("\n")}
People at the table: ${people.join(", ")}. "${people[0]}" is the person speaking; "ako", "akin", "ko" and "me" mean ${people[0]}.
What ${people[0]} said about who had what (Filipino, English or Taglish):
"${said}"
For each item, write what it is in plain English, then an arrow, then who had it, using only the names above. Write "everyone" if they all shared it or it was not mentioned. If two people each had one, list both.
Answer one line per item, like:
1. coffee -> ${people[1] ?? people[0]}
2. bread -> everyone`;
}

/** Reads the AI's assignment; unknown names are ignored and unmentioned items go to everyone. */
export function parseSplit(text: string, itemCount: number, people: string[]): { shares: number[][]; assigned: number } {
  const shares: number[][] = Array.from({ length: itemCount }, () => []);
  let assigned = 0;
  const lower = people.map((p) => p.toLowerCase());
  for (const line of text.split("\n")) {
    const m = line.replace(/\*\*/g, "").match(/^\s*(\d+)[.):]\s*(.+)$/);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= itemCount) continue;
    // "1. beer -> Maria, Jun": the names are after the arrow (the meaning before it is only for the model).
    const names = /->|→|=>/.test(m[2]) ? m[2].split(/->|→|=>/).pop()! : m[2];
    if (/\b(everyone|all|lahat)\b/i.test(names)) {
      shares[i] = [];
      continue;
    }
    const who = new Set<number>();
    for (const token of names.split(/,|\band\b|\bat\b|&|\//i).map((t) => t.trim().replace(/[.()]/g, ""))) {
      if (!token) continue;
      if (SELF.test(token)) who.add(0);
      const k = lower.indexOf(token.toLowerCase());
      if (k >= 0) who.add(k);
    }
    if (who.size) {
      shares[i] = [...who].sort((a, b) => a - b);
      assigned++;
    }
  }
  return { shares, assigned };
}

const EVERYONE = /\b(lahat|everyone|everybody|all of us|we all|shared by all)\b/i;
const ME = /\b(akin|ako|me|mine|my)\b/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A second, rule-based reader of who had what, for common Taglish and English patterns: "kay Maria ang
 * karaage at beer", "akin ang oyakodon", "hati kaming lahat sa edamame", "Jun had the yakitori".
 * `aliases[i]` are the words that can name item i (original, English name, romaji). It needs no AI,
 * and it lets the app check the AI: items both readers agree on are shown as checked.
 */
export function ruleSplit(said: string, aliases: string[][], people: string[]): { shares: number[][]; matched: boolean[] } {
  const sets = aliases.map(() => new Set<number>());
  const everyone = aliases.map(() => false);
  const matched = aliases.map(() => false);
  for (const clause of said.toLowerCase().split(/[,;.!?]|\btapos\b|\bthen\b/)) {
    const who = new Set<number>();
    people.forEach((p, k) => {
      if (k > 0 && new RegExp(String.raw`(^|[^\p{L}])${escapeRe(p.toLowerCase())}($|[^\p{L}])`, "u").test(clause)) who.add(k);
    });
    if (ME.test(clause)) who.add(0);
    const all = EVERYONE.test(clause);
    if (!who.size && !all) continue;
    aliases.forEach((words, i) => {
      if (!words.some((w) => w.trim().length >= 2 && clause.includes(w.trim().toLowerCase()))) return;
      matched[i] = true;
      if (all) everyone[i] = true;
      else who.forEach((k) => sets[i].add(k));
    });
  }
  return { shares: sets.map((s, i) => (everyone[i] ? [] : [...s].sort((a, b) => a - b))), matched };
}

export type SplitSource = "agree" | "rules" | "ai" | "conflict" | "unmentioned";

/**
 * Combines the two readers. Where both read an item, agreement is "checked"; disagreement keeps the
 * rule reading (it only fires on explicit words) and is flagged for the user to look at.
 */
export function combineSplit(
  rule: { shares: number[][]; matched: boolean[] },
  ai: number[][] | null,
): { shares: number[][]; source: SplitSource[] } {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const source: SplitSource[] = [];
  const shares = rule.shares.map((r, i) => {
    const a = ai?.[i] ?? null;
    if (rule.matched[i] && a !== null) {
      source.push(same(r, a) ? "agree" : "conflict");
      return r;
    }
    if (rule.matched[i]) {
      source.push("rules");
      return r;
    }
    if (a && a.length) {
      source.push("ai");
      return a;
    }
    source.push("unmentioned");
    return [];
  });
  return { shares, source };
}
