/**
 * Scores the bill-split readers: rules alone, the laptop hub's model alone, and both combined (rules
 * kept on disagreement, which is flagged for the user). Usage:
 *   npx tsx scripts/eval-split.mts http://localhost:3000 <dev|holdout>
 */
import { SPLIT_ALIASES, SPLIT_CASES, SPLIT_HOLDOUT, SPLIT_ITEMS, SPLIT_PEOPLE, scoreSplit } from "../src/lib/evalSplit.ts";
import { combineSplit, parseSplit, ruleSplit, splitPrompt } from "../src/lib/split.ts";

const hub = process.argv[2] ?? "http://localhost:3000";
const which = process.argv[3] === "holdout" ? SPLIT_HOLDOUT : SPLIT_CASES;
const tally = { rules: 0, ai: 0, combined: 0, flaggedWrong: 0, silentWrong: 0, wrongChecked: 0, items: { rules: 0, ai: 0, combined: 0 } };
for (const [i, c] of which.entries()) {
  const rule = ruleSplit(c.said, SPLIT_ALIASES, SPLIT_PEOPLE);
  const res = await fetch(`${hub}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: splitPrompt(SPLIT_ITEMS, SPLIT_PEOPLE, c.said), temperature: 0, maxTokens: 160 }),
  });
  const data = (await res.json()) as { text: string; meta?: { model: string } };
  const ai = parseSplit(data.text, SPLIT_ITEMS.length, SPLIT_PEOPLE).shares;
  const both = combineSplit(rule, ai);
  const r = scoreSplit(rule.shares, c.expected), a = scoreSplit(ai, c.expected), b = scoreSplit(both.shares, c.expected);
  tally.rules += +r.all; tally.ai += +a.all; tally.combined += +b.all;
  tally.items.rules += r.items; tally.items.ai += a.items; tally.items.combined += b.items;
  // A wrong combined answer is "flagged" if at least one wrong item is marked as a disagreement for the user.
  const wrongItems = c.expected.map((e, k) => JSON.stringify([...both.shares[k]].sort()) !== JSON.stringify(e));
  // The dangerous case: a wrong item shown as checked because both readers agreed on it.
  tally.wrongChecked += wrongItems.filter((w, k) => w && both.source[k] === "agree").length;
  if (!b.all) (wrongItems.some((w, k) => w && both.source[k] === "conflict") ? tally.flaggedWrong++ : tally.silentWrong++);
  console.log(`${i + 1}. rules ${r.items}/5 · ${data.meta?.model ?? "ai"} ${a.items}/5 · combined ${b.items}/5 ${b.all ? "OK" : wrongItems.some((w, k) => w && both.source[k] === "conflict") ? "(wrong, flagged)" : "(wrong, not flagged)"}`);
}
const n = which.length;
console.log(`\n${process.argv[3] ?? "dev"} (${n} sentences): rules ${tally.rules}/${n} · AI ${tally.ai}/${n} · combined ${tally.combined}/${n}; wrong but flagged ${tally.flaggedWrong}, wrong and not flagged ${tally.silentWrong}`);
console.log(`items (${n * 5}): rules ${tally.items.rules} · AI ${tally.items.ai} · combined ${tally.items.combined}; wrong items shown as ✓ checked: ${tally.wrongChecked}`);
