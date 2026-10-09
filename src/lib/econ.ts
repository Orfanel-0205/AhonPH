import type { ExpenseCategory } from "./types";

/**
 * Philippine economic figures bundled with the app so they work offline.
 * Every figure carries its source; the AI may quote these but never invent others.
 * Update by editing this file — nothing is fetched at runtime.
 */
export interface EconFact {
  id: string;
  label: string;
  value: number;
  unit: "pct" | "php_per_day";
  period: string;
  source: string;
  url: string;
  released: string;
}

const PSA_SEP_2026 = {
  period: "September 2026",
  source: "Philippine Statistics Authority (PSA), CPI 2018=100",
  url: "https://psa.gov.ph/content/summary-inflation-report-consumer-price-index-2018100-september-2026",
  released: "2026-10-06",
};

const NCR_28 = {
  period: "Effective September 26, 2026",
  source: "DOLE NWPC / RTWPB-NCR, Wage Order No. NCR-28",
  url: "https://nwpc.dole.gov.ph/",
  released: "2026-09-12",
};

export const ECON_FACTS = {
  headlineInflation: { id: "headlineInflation", label: "Headline inflation (year-on-year)", value: 7.2, unit: "pct", ...PSA_SEP_2026 },
  ytdInflation: { id: "ytdInflation", label: "Average inflation, Jan–Sep 2026", value: 5.4, unit: "pct", ...PSA_SEP_2026 },
  foodInflation: { id: "foodInflation", label: "Food inflation", value: 6.8, unit: "pct", ...PSA_SEP_2026 },
  riceInflation: { id: "riceInflation", label: "Rice inflation", value: 20.3, unit: "pct", ...PSA_SEP_2026 },
  transportInflation: { id: "transportInflation", label: "Transport inflation", value: 14.6, unit: "pct", ...PSA_SEP_2026 },
  utilitiesInflation: { id: "utilitiesInflation", label: "Housing, water, electricity, gas & other fuels inflation", value: 8.4, unit: "pct", ...PSA_SEP_2026 },
  ncrMinWage: { id: "ncrMinWage", label: "NCR minimum wage, non-agriculture", value: 755, unit: "php_per_day", ...NCR_28 },
  ncrMinWageSmall: { id: "ncrMinWageSmall", label: "NCR minimum wage, agriculture & small retail/service (≤15 workers)", value: 718, unit: "php_per_day", ...NCR_28 },
} satisfies Record<string, EconFact>;

export const ECON_DATA_AS_OF = "2026-10-06";

/** Which official inflation figure applies to which spending category. */
export const CATEGORY_INFLATION: Partial<Record<ExpenseCategory, EconFact>> = {
  food: ECON_FACTS.foodInflation,
  transport: ECON_FACTS.transportInflation,
  utilities: ECON_FACTS.utilitiesInflation,
};

export function formatFact(f: EconFact): string {
  const v = f.unit === "pct" ? `${f.value}%` : `₱${f.value}/day`;
  return `${f.label}: ${v} (${f.period}; ${f.source})`;
}
