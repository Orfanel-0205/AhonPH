/**
 * Traveler mode: finds peso prices in scanned text (receipts, menus, price tags), converts them,
 * and explains Philippine charges. Explanations are written in English and translated on-device.
 */
import { toCentavos } from "./money";
import { convertFromPhp, formatForeign, type CurrencyCode } from "./rates";
import type { Centavos } from "./types";

export interface PricedLine {
  label: string;
  centavos: Centavos;
  converted: string;
}

const PRICE_AT_END = /(?:₱|PHP|Php|P)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{1,6}(?:\.\d{2})?)\s*[A-Z*]{0,2}\s*$/;

/** Rows like "Adobo rice meal   ₱150" or "TOTAL 575.75". Rows that are only numbers (phone, TIN) are skipped. */
export function findPricedLines(rows: string[], currency: CurrencyCode): PricedLine[] {
  const out: PricedLine[] = [];
  for (const row of rows) {
    const m = row.match(PRICE_AT_END);
    if (!m) continue;
    const label = row.slice(0, m.index).replace(/[.\s:-]+$/g, "").trim();
    if (!/[A-Za-z]{2,}/.test(label)) continue;
    // Skip dates, times, IDs and quantities that merely end in digits.
    if (/\b(TIN|NO\.?|#|TEL|PHONE|CEL|DATE|TIME|SI|OR|QTY|ITEMS?)\b/i.test(label) && !/TOTAL/i.test(label)) continue;
    const value = Number(m[1].replace(/,/g, ""));
    if (!(value > 0) || value > 1_000_000) continue;
    const centavos = toCentavos(value);
    out.push({ label, centavos, converted: formatForeign(convertFromPhp(centavos, currency), currency) });
  }
  return out;
}

export interface ChargeNote {
  id: "vat" | "service" | "discount" | "tip";
  title: string;
  body: string;
}

/** Plain-language notes about charges found in the text. Facts only; the law references are cited. */
export function explainCharges(rows: string[]): ChargeNote[] {
  const text = rows.join("\n").toUpperCase();
  const notes: ChargeNote[] = [];
  if (/\bVAT\b|V\.A\.T|VATABLE/.test(text)) {
    notes.push({
      id: "vat",
      title: "12% VAT",
      body: "Shelf and menu prices in the Philippines usually already include the 12% VAT. A VAT line on a receipt normally shows the tax portion of the total, not an extra charge.",
    });
  }
  if (/SERVICE\s*CHARGE|SVC\s*CHG|SERV\.?\s*CHG/.test(text)) {
    notes.push({
      id: "service",
      title: "Service charge",
      body: "Restaurants often add a service charge (commonly 10%). Under Republic Act No. 11360, all of it goes to the staff. Tipping on top of it is optional.",
    });
  } else if (/MENU|ORDER|TABLE|DINE|SERVER|WAITER/.test(text)) {
    notes.push({
      id: "tip",
      title: "Tipping",
      body: "If no service charge is listed, tipping is appreciated but not required in the Philippines.",
    });
  }
  if (/SENIOR|\bPWD\b/.test(text)) {
    notes.push({
      id: "discount",
      title: "Senior citizen / PWD discount",
      body: "The 20% senior citizen or PWD discount (with VAT exemption) applies to holders of a Philippine senior citizen or PWD ID.",
    });
  }
  return notes;
}
