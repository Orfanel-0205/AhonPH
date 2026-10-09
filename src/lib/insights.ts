import { EXPENSE_INFO } from "./categories";
import { CATEGORY_INFLATION } from "./econ";
import type { BudgetStatus, Summary } from "./finance";
import { formatPct, formatPeso, roundToPeso } from "./money";

export type Severity = "danger" | "warning" | "info" | "good";

/** A rule-based finding. All numbers here are computed by code, never by the AI. */
export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  body: string;
}

const FLEXIBLE_CUT = 0.2;
const EMERGENCY_FUND_MONTHS = 3;
const SEVERITY_ORDER: Severity[] = ["danger", "warning", "info", "good"];

export function buildInsights(s: Summary, budgets: BudgetStatus[]): Insight[] {
  const out: Insight[] = [];
  // A partial month can't be read as a monthly figure.
  const monthly = s.period.kind !== "thisMonth";
  const per = monthly ? "kada buwan" : "sa period na ito";

  if (s.expenseCentavos === 0 && s.incomeCentavos === 0) {
    return [{ id: "empty", severity: "info", title: "Wala pang records", body: "Mag-log ng gastos o mag-scan ng resibo para makita ang analysis mo." }];
  }

  if (s.incomeCentavos === 0) {
    out.push({
      id: "no-income",
      severity: "info",
      title: "Walang naitalang kita",
      body: `May ${formatPeso(s.expenseCentavos)} na gastos pero walang kita na naka-record sa period na ito, kaya hindi ma-compute kung ilang porsyento ng sweldo ang nagastos.`,
    });
  } else if (s.remainingCentavos < 0) {
    out.push({
      id: "overspent",
      severity: "danger",
      title: "Mas malaki ang gastos kaysa kita",
      body: `Lumampas ng ${formatPeso(-s.remainingCentavos)} ang gastos mo (${formatPeso(s.expenseCentavos)}) sa kita mo (${formatPeso(s.incomeCentavos)}).`,
    });
  } else if (s.spentShareOfIncome !== null && s.spentShareOfIncome > 0.9) {
    out.push({
      id: "thin-buffer",
      severity: "warning",
      title: "Manipis ang buffer mo",
      body: `${formatPeso(s.remainingCentavos)} lang ang natitira — ${formatPct(s.spentShareOfIncome)} ng kita mo ang nagastos. Kapag may biglaang gastos, baka kulangin ka.`,
    });
  } else if (s.spentShareOfIncome !== null && s.spentShareOfIncome <= 0.8) {
    out.push({
      id: "healthy-buffer",
      severity: "good",
      title: "Maganda ang natitira mo",
      body: `${formatPeso(s.remainingCentavos)} ang natitira (${formatPct(1 - s.spentShareOfIncome)} ng kita). Ilaan agad ito sa ipon bago magastos.`,
    });
  }

  for (const b of budgets) {
    if (b.state === "over") {
      const info = EXPENSE_INFO[b.category];
      out.push({
        id: `budget-over-${b.category}`,
        severity: "warning",
        title: `Lampas sa budget: ${info.label}`,
        body: `${formatPeso(b.spentCentavos)} na ang nagastos sa ${info.label.toLowerCase()}, lampas ng ${formatPeso(b.spentCentavos - b.limitCentavos)} sa budget na ${formatPeso(b.limitCentavos)}.`,
      });
    }
  }

  const topFlexible = s.byCategory.find((c) => !c.essential);
  if (topFlexible && s.flexibleCentavos > 0) {
    const saving = roundToPeso(s.flexibleCentavos * FLEXIBLE_CUT);
    out.push({
      id: "flexible-cut",
      severity: "info",
      title: "Dito ka pwedeng makatipid",
      body: `Ang pinakamalaking flexible na gastos mo ay ${EXPENSE_INFO[topFlexible.category].label} (${formatPeso(topFlexible.centavos)}). Kung babawasan mo ng 20% ang lahat ng flexible na gastos (${formatPeso(s.flexibleCentavos)}), makakatipid ka ng mga ${formatPeso(saving)} ${per}.`,
    });
  }

  if (monthly) {
    const impacts = s.byCategory
      .filter((c) => CATEGORY_INFLATION[c.category])
      .map((c) => {
        const fact = CATEGORY_INFLATION[c.category]!;
        return { c, fact, extra: roundToPeso((c.centavos * fact.value) / 100) };
      })
      .filter((x) => x.extra > 0)
      .sort((a, b) => b.extra - a.extra)
      .slice(0, 2);
    for (const { c, fact, extra } of impacts) {
      const label = EXPENSE_INFO[c.category].label.toLowerCase();
      out.push({
        id: `inflation-${c.category}`,
        severity: "info",
        title: `${fact.label}: ${fact.value}%`,
        body: `Kung tataas pa ng ${fact.value}% ang presyo sa susunod na taon (kapareho ng ${fact.period} rate, PSA), ang ${formatPeso(c.centavos)} mong ${label} ay mangangailangan ng mga ${formatPeso(extra)} pa kada buwan.`,
      });
    }

    if (s.remainingCentavos > 0 && s.essentialCentavos > 0) {
      const target = roundToPeso(s.essentialCentavos * EMERGENCY_FUND_MONTHS);
      const months = Math.ceil(target / s.remainingCentavos);
      out.push({
        id: "emergency-fund",
        severity: "info",
        title: "Emergency fund",
        body: `Ang ${EMERGENCY_FUND_MONTHS}-buwang emergency fund para sa essentials mo ay mga ${formatPeso(target)}. Kung maiipon mo ang ${formatPeso(s.remainingCentavos)} kada buwan, aabutin ito ng mga ${months} buwan.`,
      });
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}
