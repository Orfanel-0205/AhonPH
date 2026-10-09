import type { Centavos } from "./types";

/** Converts a peso amount (possibly with centavos, e.g. 16.5) to integer centavos. */
export function toCentavos(pesos: number): Centavos {
  if (!Number.isFinite(pesos)) throw new Error(`Invalid peso amount: ${pesos}`);
  // toFixed first so binary artifacts like 100.49999999999999 round the way a person expects.
  return Math.round(Number((pesos * 100).toFixed(4)));
}

export function toPesos(c: Centavos): number {
  return c / 100;
}

/** Formats centavos as "₱1,850" or "₱16.50". Hand-rolled so server and browser render identically. */
export function formatPeso(c: Centavos, opts: { showCentavos?: boolean } = {}): string {
  const rounded = Math.round(c);
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const showCents = opts.showCentavos ?? cents !== 0;
  return `${rounded < 0 ? "-" : ""}₱${wholeStr}${showCents ? "." + cents.toString().padStart(2, "0") : ""}`;
}

/** Formats a 0..1 share as a percentage with one decimal, dropping a trailing ".0". */
export function formatPct(share: number): string {
  const v = Math.round(share * 1000) / 10;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}%`;
}

/** Rounds centavos to the nearest whole peso (for estimates, where centavos imply false precision). */
export function roundToPeso(c: Centavos): Centavos {
  return Math.round(c / 100) * 100;
}
