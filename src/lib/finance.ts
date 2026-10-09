import { EXPENSE_INFO } from "./categories";
import { addDays, addMonths, daysBetweenInclusive, endOfMonth, formatDate, formatMonth, startOfMonth } from "./dates";
import type { Budgets, Centavos, ExpenseCategory, Transaction } from "./types";

export type PeriodKind = "last30" | "thisMonth" | "lastMonth";

export interface Period {
  kind: PeriodKind;
  /** Inclusive YYYY-MM-DD bounds. */
  start: string;
  end: string;
  label: string;
}

export function makePeriod(kind: PeriodKind, today: string): Period {
  switch (kind) {
    case "last30": {
      const start = addDays(today, -29);
      return { kind, start, end: today, label: `Last 30 days (${formatDate(start)} – ${formatDate(today)})` };
    }
    case "thisMonth":
      return { kind, start: startOfMonth(today), end: today, label: `${formatMonth(today)} (so far)` };
    case "lastMonth": {
      const start = addMonths(today, -1);
      return { kind, start, end: endOfMonth(start), label: formatMonth(start) };
    }
  }
}

export function inPeriod(tx: Transaction, p: Period): boolean {
  return tx.date >= p.start && tx.date <= p.end;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  centavos: Centavos;
  /** Share of total expenses, 0..1 */
  share: number;
  essential: boolean;
}

export interface Summary {
  period: Period;
  incomeCentavos: Centavos;
  expenseCentavos: Centavos;
  /** income − expenses; negative means overspending. */
  remainingCentavos: Centavos;
  /** expenses ÷ income, or null when no income was recorded. */
  spentShareOfIncome: number | null;
  essentialCentavos: Centavos;
  flexibleCentavos: Centavos;
  /** Expense categories with spending, largest first. */
  byCategory: CategoryTotal[];
  dailyAverageExpenseCentavos: Centavos;
  txCount: number;
}

export function summarize(transactions: Transaction[], period: Period): Summary {
  const txs = transactions.filter((t) => inPeriod(t, period));
  let income = 0;
  let expense = 0;
  const totals = new Map<ExpenseCategory, number>();
  for (const t of txs) {
    if (t.type === "income") {
      income += t.amountCentavos;
    } else {
      expense += t.amountCentavos;
      const cat = t.category as ExpenseCategory;
      totals.set(cat, (totals.get(cat) ?? 0) + t.amountCentavos);
    }
  }
  const byCategory: CategoryTotal[] = [...totals.entries()]
    .map(([category, centavos]) => ({
      category,
      centavos,
      share: expense > 0 ? centavos / expense : 0,
      essential: EXPENSE_INFO[category]?.essential ?? false,
    }))
    .sort((a, b) => b.centavos - a.centavos || a.category.localeCompare(b.category));
  const essential = byCategory.filter((c) => c.essential).reduce((s, c) => s + c.centavos, 0);
  const days = daysBetweenInclusive(period.start, period.end);
  return {
    period,
    incomeCentavos: income,
    expenseCentavos: expense,
    remainingCentavos: income - expense,
    spentShareOfIncome: income > 0 ? expense / income : null,
    essentialCentavos: essential,
    flexibleCentavos: expense - essential,
    byCategory,
    dailyAverageExpenseCentavos: days > 0 ? Math.round(expense / days) : 0,
    txCount: txs.length,
  };
}

export type BudgetState = "ok" | "near" | "over";

export interface BudgetStatus {
  category: ExpenseCategory;
  limitCentavos: Centavos;
  spentCentavos: Centavos;
  usedShare: number;
  state: BudgetState;
}

/** Compares spending in the summary's period against monthly budgets. "near" starts at 80%. */
export function budgetStatuses(summary: Summary, budgets: Budgets): BudgetStatus[] {
  const spent = new Map(summary.byCategory.map((c) => [c.category, c.centavos]));
  return (Object.entries(budgets) as [ExpenseCategory, Centavos | undefined][])
    .filter((e): e is [ExpenseCategory, Centavos] => typeof e[1] === "number" && e[1] > 0)
    .map(([category, limit]) => {
      const s = spent.get(category) ?? 0;
      const usedShare = s / limit;
      const state: BudgetState = s > limit ? "over" : usedShare >= 0.8 ? "near" : "ok";
      return { category, limitCentavos: limit, spentCentavos: s, usedShare, state };
    })
    .sort((a, b) => b.usedShare - a.usedShare);
}
