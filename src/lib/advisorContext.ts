import { EXPENSE_INFO } from "./categories";
import { formatDate } from "./dates";
import { ECON_FACTS, formatFact } from "./econ";
import type { BudgetStatus, Summary } from "./finance";
import type { PersonalInflation } from "./inflation";
import type { Insight } from "./insights";
import { formatPct, formatPeso } from "./money";

/**
 * The DATA block the local advisor sees. Every number in it is computed by code,
 * and the advisor's reply is checked against this exact text afterwards.
 */
export function buildAdvisorContext(args: {
  today: string;
  summary: Summary;
  insights: Insight[];
  budgets: BudgetStatus[];
  inflation: PersonalInflation | null;
}): string {
  const { today, summary: s, insights, budgets, inflation } = args;
  const lines: string[] = [];
  lines.push(`Today: ${formatDate(today)}`);
  lines.push(`Period: ${s.period.label}`);
  lines.push(`Income: ${formatPeso(s.incomeCentavos)}`);
  lines.push(`Expenses: ${formatPeso(s.expenseCentavos)}`);
  lines.push(`Remaining (income minus expenses): ${formatPeso(s.remainingCentavos)}`);
  if (s.spentShareOfIncome !== null) lines.push(`Share of income spent: ${formatPct(s.spentShareOfIncome)}`);
  lines.push(`Essential spending: ${formatPeso(s.essentialCentavos)}; flexible spending: ${formatPeso(s.flexibleCentavos)}`);
  lines.push(`Average spending per day: ${formatPeso(s.dailyAverageExpenseCentavos)}`);
  if (s.byCategory.length) {
    lines.push(
      "Spending by category: " +
        s.byCategory
          .map((c) => `${EXPENSE_INFO[c.category].label}${c.essential ? "" : " (flexible)"} ${formatPeso(c.centavos)} (${formatPct(c.share)})`)
          .join("; "),
    );
  }
  if (budgets.length) {
    lines.push(
      "Monthly budgets: " +
        budgets.map((b) => `${EXPENSE_INFO[b.category].label} ${formatPeso(b.spentCentavos)} of ${formatPeso(b.limitCentavos)} (${b.state})`).join("; "),
    );
  }
  if (insights.length) {
    lines.push("Findings computed by the app:");
    for (const i of insights) lines.push(`- ${i.title}: ${i.body}`);
  }
  if (inflation) {
    const top = inflation.items.slice(0, 3).map((i) => `${i.name} ${i.change >= 0 ? "+" : ""}${formatPct(i.change)}`);
    lines.push(
      `Personal inflation from the user's receipts (same items, ${formatDate(inflation.current.start)}–${formatDate(inflation.current.end)} vs one year earlier): ${inflation.rate >= 0 ? "+" : ""}${formatPct(inflation.rate)}. Biggest increases: ${top.join(", ")}.`,
    );
  }
  lines.push("Philippine economic data (bundled, verified):");
  for (const f of [ECON_FACTS.headlineInflation, ECON_FACTS.foodInflation, ECON_FACTS.riceInflation, ECON_FACTS.transportInflation, ECON_FACTS.utilitiesInflation, ECON_FACTS.ncrMinWage]) {
    lines.push(`- ${formatFact(f)}`);
  }
  return lines.join("\n");
}
