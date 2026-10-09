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
};

/** Currencies whose everyday amounts are written without decimals. */
const NO_DECIMALS: CurrencyCode[] = ["JPY", "KRW", "TWD"];

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
