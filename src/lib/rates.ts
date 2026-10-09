import type { Centavos } from "./types";

/**
 * Bundled exchange rates (PHP per 1 unit of foreign currency) so traveler mode works offline.
 * Source: BSP Reference Exchange Rate Bulletin, Oct 8, 2026 (weighted average), as listed by taxcalculator.com.ph.
 * Money changers and cards use different rates; the app labels conversions as approximate.
 */
export const FX = {
  asOf: "2026-10-08",
  source: "BSP Reference Exchange Rate Bulletin (Oct 8, 2026)",
  url: "https://taxcalculator.com.ph/exchange-rates",
  phpPerUnit: {
    USD: 62.766,
    EUR: 70.2916,
    JPY: 0.3972,
    KRW: 0.04689,
    CNY: 9.361,
    GBP: 82.9704,
    AUD: 43.6851,
    SGD: 49.0627,
    HKD: 7.9985,
    CAD: 44.0247,
    TWD: 1.9711,
    THB: 1.8663,
    VND: 0.00242,
    MYR: 15.3612,
    IDR: 0.00351,
    AED: 17.0894,
    SAR: 16.7193,
    QAR: 17.2434,
    KWD: 203.6865,
  },
} as const;

export type CurrencyCode = keyof typeof FX.phpPerUnit;

const SYMBOL: Record<CurrencyCode, string> = {
  USD: "US$",
  EUR: "€",
  JPY: "¥",
  KRW: "₩",
  CNY: "CN¥",
  GBP: "£",
  AUD: "A$",
  SGD: "S$",
  HKD: "HK$",
  CAD: "C$",
  TWD: "NT$",
  THB: "฿",
  VND: "₫",
  MYR: "RM",
  IDR: "Rp",
  AED: "AED ",
  SAR: "SAR ",
  QAR: "QAR ",
  KWD: "KWD ",
};

/** Currencies whose everyday amounts are written without decimals. */
const NO_DECIMALS: CurrencyCode[] = ["JPY", "KRW", "TWD", "VND", "IDR"];

export function convertFromPhp(c: Centavos, code: CurrencyCode): number {
  return c / 100 / FX.phpPerUnit[code];
}

export function formatForeign(value: number, code: CurrencyCode): string {
  const decimals = NO_DECIMALS.includes(code) ? 0 : 2;
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}≈${SYMBOL[code]}${grouped}${frac ? "." + frac : ""}`;
}

/** Converts an amount in a foreign currency to Philippine centavos. */
export function convertToPhp(amount: number, code: CurrencyCode): Centavos {
  return Math.round(amount * FX.phpPerUnit[code] * 100);
}

export function formatCurrency(amount: number, code: CurrencyCode): string {
  return formatForeign(amount, code).replace("≈", "");
}

// Words and symbols people use when typing or saying an amount abroad. Checked in order.
const CURRENCY_PATTERNS: [CurrencyCode, RegExp][] = [
  ["HKD", /HK\$|\bHKD\b|hong\s*kong\s*dollars?/i],
  ["SGD", /S\$|\bSGD\b|singapore\s*dollars?/i],
  ["TWD", /NT\$|\bTWD\b|taiwan\s*dollars?/i],
  ["AUD", /A\$|\bAUD\b|australian\s*dollars?/i],
  ["CAD", /C\$|\bCAD\b|canadian\s*dollars?/i],
  ["JPY", /¥|円|\bJPY\b|\byen\b/i],
  ["KRW", /₩|원|\bKRW\b|\bwon\b/i],
  ["CNY", /\bCNY\b|\bRMB\b|\byuan\b|元/i],
  ["THB", /฿|\bTHB\b|\bbaht\b/i],
  ["VND", /₫|\bVND\b|\bdong\b/i],
  ["MYR", /\bRM\s?\d|\bMYR\b|\bringgit\b/i],
  ["IDR", /\bRp\.?\s?\d|\bIDR\b|\brupiah\b/i],
  ["AED", /\bAED\b|\bdirhams?\b/i],
  ["SAR", /\bSAR\b|\bsaudi\s*riyals?\b|\briyals?\b/i],
  ["QAR", /\bQAR\b|\bqatari\s*riyals?\b/i],
  ["KWD", /\bKWD\b|\bdinars?\b/i],
  ["EUR", /€|\bEUR\b|\beuros?\b/i],
  ["GBP", /£|\bGBP\b|\bpounds?\b/i],
  ["USD", /US\$|\bUSD\b|\bdollars?\b|\$/i],
];

/** Finds the currency mentioned in a piece of text, or null for pesos / unknown. */
export function detectCurrency(text: string): CurrencyCode | null {
  if (/₱|\bPHP\b|\bpesos?\b/i.test(text)) return null;
  for (const [code, re] of CURRENCY_PATTERNS) if (re.test(text)) return code;
  return null;
}
