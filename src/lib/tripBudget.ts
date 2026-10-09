import { EXPENSE_INFO } from "./categories";
import { addDays, daysBetweenInclusive } from "./dates";
import type { Insight } from "./insights";
import { formatPct, formatPeso as formatPesoExact } from "./money";
import { convertFromPhp, convertToPhp, formatCurrency, type CurrencyCode } from "./rates";
import type { Centavos, ExpenseCategory, Transaction } from "./types";

/** A trip with a budget in pesos. Every expense dated inside the trip counts against it. */
export interface TripPlan {
  name: string;
  currency: CurrencyCode;
  budgetCentavos: Centavos;
  /** YYYY-MM-DD, inclusive. */
  start: string;
  end: string;
}

export type TripState = "ok" | "near" | "over";

export interface TripStatus {
  phase: "before" | "during" | "after";
  days: number;
  /** Day of the trip today, 1-based (clamped to the trip). */
  day: number;
  /** Days left, counting today. */
  daysLeft: number;
  spentCentavos: Centavos;
  spentTodayCentavos: Centavos;
  leftCentavos: Centavos;
  usedShare: number;
  plannedPerDayCentavos: Centavos;
  /** Today's fair share: what was left this morning, split evenly over the days left. */
  todayAllowanceCentavos: Centavos;
  /** What can still be spent today without eating into later days (negative when over). */
  todayLeftCentavos: Centavos;
  averagePerDayCentavos: Centavos;
  /** Total by the end of the trip if every day costs the average so far. */
  projectedCentavos: Centavos;
  state: TripState;
  topCategories: { category: ExpenseCategory; centavos: Centavos; share: number }[];
}

/** Whole pesos: amounts here come from exchange-rate conversions, so centavos would be false precision. */
export const formatPeso = (c: Centavos) => formatPesoExact(Math.round(c / 100) * 100);

const sum = (txs: Transaction[]) => txs.reduce((a, t) => a + t.amountCentavos, 0);

export function tripStatus(plan: TripPlan, transactions: Transaction[], today: string): TripStatus {
  const days = Math.max(1, daysBetweenInclusive(plan.start, plan.end));
  const phase = today < plan.start ? "before" : today > plan.end ? "after" : "during";
  const day = phase === "before" ? 1 : phase === "after" ? days : daysBetweenInclusive(plan.start, today);
  const daysLeft = phase === "after" ? 0 : days - day + 1;
  const inTrip = transactions.filter((t) => t.type === "expense" && t.date >= plan.start && t.date <= plan.end);
  const spent = sum(inTrip);
  const spentToday = phase === "during" ? sum(inTrip.filter((t) => t.date === today)) : 0;
  const left = plan.budgetCentavos - spent;
  const todayAllowance = daysLeft > 0 ? Math.max(0, Math.floor((left + spentToday) / daysLeft)) : 0;
  const elapsed = phase === "during" ? day : phase === "after" ? days : 0;
  const average = elapsed > 0 ? Math.round(spent / elapsed) : 0;
  const projected = elapsed > 0 ? average * days : spent;
  const usedShare = plan.budgetCentavos > 0 ? spent / plan.budgetCentavos : 0;
  const state: TripState = left < 0 ? "over" : usedShare >= 0.8 || projected > plan.budgetCentavos ? "near" : "ok";

  const byCat = new Map<ExpenseCategory, number>();
  for (const t of inTrip) byCat.set(t.category as ExpenseCategory, (byCat.get(t.category as ExpenseCategory) ?? 0) + t.amountCentavos);
  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, centavos]) => ({ category, centavos, share: spent > 0 ? centavos / spent : 0 }));

  return {
    phase,
    days,
    day,
    daysLeft,
    spentCentavos: spent,
    spentTodayCentavos: spentToday,
    leftCentavos: left,
    usedShare,
    plannedPerDayCentavos: Math.floor(plan.budgetCentavos / days),
    todayAllowanceCentavos: todayAllowance,
    todayLeftCentavos: todayAllowance - spentToday,
    averagePerDayCentavos: average,
    projectedCentavos: projected,
    state,
    topCategories,
  };
}

/** "₱3,000 (≈ ¥7,500)": pesos first, then the trip's own currency so it matches the prices around you. */
export function inBoth(c: Centavos, currency: CurrencyCode): string {
  const local = convertFromPhp(Math.abs(c), currency);
  return `${formatPeso(c)} (≈ ${formatCurrency(local, currency)})`;
}

/** Rule-based tips. Every number is computed here; the AI never supplies one. */
export function tripTips(plan: TripPlan, s: TripStatus): Insight[] {
  const out: Insight[] = [];
  const both = (c: Centavos) => inBoth(c, plan.currency);
  if (s.phase === "before") {
    out.push({
      id: "trip-before",
      severity: "info",
      title: `${plan.name} starts ${formatDate(plan.start)}`,
      body: `Your plan is ${both(s.plannedPerDayCentavos)} a day for ${s.days} days.`,
    });
    return out;
  }
  if (s.phase === "after") {
    out.push({
      id: "trip-after",
      severity: s.leftCentavos >= 0 ? "good" : "warning",
      title: s.leftCentavos >= 0 ? `${plan.name}: done, ${formatPeso(s.leftCentavos)} under budget` : `${plan.name}: done, ${formatPeso(-s.leftCentavos)} over budget`,
      body: `You spent ${formatPeso(s.spentCentavos)} of ${formatPeso(plan.budgetCentavos)} over ${s.days} days.`,
    });
    return out;
  }
  if (s.leftCentavos < 0) {
    out.push({
      id: "trip-over",
      severity: "danger",
      title: "Lampas na sa trip budget",
      body: `You are ${both(-s.leftCentavos)} over your ${formatPeso(plan.budgetCentavos)} budget with ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} to go.`,
    });
  } else if (s.projectedCentavos > plan.budgetCentavos && s.spentCentavos > 0) {
    out.push({
      id: "trip-pace",
      severity: "warning",
      title: `At this pace: ${formatPeso(s.projectedCentavos)}`,
      body: `You average ${formatPeso(s.averagePerDayCentavos)} a day, ${formatPeso(s.projectedCentavos - plan.budgetCentavos)} over by the end. ${
        s.daysLeft > 1
          ? `Keep the next ${s.daysLeft - 1} day${s.daysLeft === 2 ? "" : "s"} to ${both(Math.floor(s.leftCentavos / (s.daysLeft - 1)))} each to finish on budget.`
          : `Spend at most ${both(Math.max(0, s.todayLeftCentavos))} today to finish on budget.`
      }`,
    });
  }
  // The pace tip already gives the per-day amount for the coming days; don't repeat it.
  if (s.todayLeftCentavos < 0 && s.leftCentavos >= 0 && s.daysLeft > 1 && !out.some((t) => t.id === "trip-pace")) {
    const tomorrow = Math.floor(s.leftCentavos / (s.daysLeft - 1));
    out.push({
      id: "trip-today-over",
      severity: "warning",
      title: "Today went past its share",
      body: `Today's share was ${formatPeso(s.todayAllowanceCentavos)}; you spent ${formatPeso(s.spentTodayCentavos)}. Tomorrow's share is now ${both(tomorrow)}.`,
    });
  }
  const top = s.topCategories[0];
  if (top && top.share >= 0.5 && s.spentCentavos >= s.plannedPerDayCentavos / 2) {
    out.push({
      id: "trip-top-category",
      severity: "info",
      title: `${EXPENSE_INFO[top.category].label} is ${formatPct(top.share)} of your trip spending`,
      body: `${formatPeso(top.centavos)} so far. This is where a small change saves the most.`,
    });
  }
  if (s.state === "ok" && s.spentCentavos > 0 && s.averagePerDayCentavos < s.plannedPerDayCentavos * 0.9) {
    out.push({
      id: "trip-under",
      severity: "good",
      title: "Under plan so far",
      body: `You average ${formatPeso(s.averagePerDayCentavos)} a day against a plan of ${formatPeso(s.plannedPerDayCentavos)}. Room for pasalubong.`,
    });
  }
  return out;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** The only facts Gemini Nano sees when it writes a tip. Its numbers are checked against this text. */
export function tripFacts(plan: TripPlan, s: TripStatus): string {
  const both = (c: Centavos) => inBoth(c, plan.currency);
  const lines = [
    `Trip: ${plan.name}, day ${s.day} of ${s.days}, ${s.daysLeft} day(s) left counting today. Local currency: ${plan.currency}.`,
    `Budget: ${formatPeso(plan.budgetCentavos)}. Spent: ${formatPeso(s.spentCentavos)} (${formatPct(s.usedShare)}). Left: ${both(s.leftCentavos)}.`,
    `Today: spent ${formatPeso(s.spentTodayCentavos)}. Today's fair share: ${both(s.todayAllowanceCentavos)}. Still OK to spend today: ${both(Math.max(0, s.todayLeftCentavos))}.`,
    `Average per day so far: ${formatPeso(s.averagePerDayCentavos)}. Planned per day: ${formatPeso(s.plannedPerDayCentavos)}. At this pace the trip costs ${formatPeso(s.projectedCentavos)}.`,
  ];
  if (s.topCategories.length) {
    lines.push(`Spending by category: ${s.topCategories.map((c) => `${EXPENSE_INFO[c.category].label} ${formatPeso(c.centavos)} (${formatPct(c.share)})`).join(", ")}.`);
  }
  return lines.join("\n");
}

export function tripTipPrompt(facts: string): string {
  return `You are KitaPH, a friendly travel money buddy for a Filipino traveler abroad.
Facts about their trip budget:
${facts}

Write exactly 2 short tips (at most 25 words each) for the rest of this trip:
- Tip 1 is about today: mention the amount they can still spend today, in the local currency, and one cheap way to enjoy the day there.
- Tip 2 is about their biggest spending category: one specific, cheaper everyday choice that locals use in that country.
Never suggest buying passes, tours, upgrades or anything that costs more. Only use amounts that appear in the facts; do not invent prices. Be warm, not preachy.
One tip per line. No numbering, no title.`;
}

const NUMBER = /(?:₱|PHP\s?|[$¥€£₩฿])?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;

function factNumbers(facts: string): Set<number> {
  const set = new Set<number>();
  for (const m of facts.matchAll(NUMBER)) set.add(Number(m[1].replace(/,/g, "")));
  return set;
}

/**
 * Keeps Gemini Nano's tips only if every amount in them comes from the facts. Small counts ("2 meals")
 * are allowed; any money amount or larger number that is not in the facts drops the tip.
 */
export function acceptTripTips(reply: string, facts: string): { tips: string[]; dropped: number } {
  const allowed = factNumbers(facts);
  const lines = reply
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/^tip\s*\d+\s*[:.)-]\s*/i, "")
        .trim(),
    )
    .filter((l) => l.length > 8 && l.length <= 240 && !/:\s*$/.test(l) && !/^here (are|is)\b/i.test(l));
  const tips: string[] = [];
  let dropped = 0;
  for (const l of lines.slice(0, 3)) {
    const ok = [...l.matchAll(NUMBER)].every((m) => {
      const v = Number(m[1].replace(/,/g, ""));
      const isMoney = /[₱$¥€£₩฿]|PHP/.test(m[0]);
      return allowed.has(v) || (!isMoney && v <= 10);
    });
    if (ok) tips.push(l);
    else dropped++;
  }
  return { tips: tips.slice(0, 2), dropped };
}

/** A clearly labelled sample trip for trying the app: Tokyo pocket money, 5 days, on day 3 and close to today's share. */
export function sampleTrip(today: string): { plan: TripPlan; transactions: Transaction[] } {
  const start = addDays(today, -2);
  const plan: TripPlan = { name: "Tokyo", currency: "JPY", budgetCentavos: 1_800_000, start, end: addDays(start, 4) };
  const yen = (n: number) => convertToPhp(n, "JPY");
  const rows: [number, ExpenseCategory, string, number][] = [
    [0, "transport", "Narita Express (¥3,070)", 3070],
    [0, "food", "Ramen dinner (¥1,200)", 1200],
    [0, "food", "Konbini breakfast (¥650)", 650],
    [1, "transport", "Suica top-up (¥3,000)", 3000],
    [1, "leisure", "teamLab ticket (¥3,800)", 3800],
    [1, "food", "Sushi lunch (¥2,800)", 2800],
    [1, "personal", "Pasalubong, Tokyo Banana (¥2,160)", 2160],
    [2, "food", "Coffee and onigiri (¥780)", 780],
    [2, "food", "Yakiniku dinner (¥6,500)", 6500],
  ];
  const transactions: Transaction[] = rows.map(([d, category, description, n], i) => ({
    id: `sample-trip-${i}`,
    type: "expense",
    category,
    description,
    amountCentavos: yen(n),
    date: addDays(start, d),
    source: "sample",
  }));
  return { plan, transactions };
}
