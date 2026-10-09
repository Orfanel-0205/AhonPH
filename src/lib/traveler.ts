/**
 * Traveler mode: finds peso prices in scanned text (receipts, menus, price tags), converts them,
 * and explains Philippine charges. Explanations are written in English and translated on-device.
 */
import { formatPeso, roundToPeso, toCentavos } from "./money";
import { convertFromPhp, convertToPhp, formatCurrency, formatForeign, type CurrencyCode } from "./rates";
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

export interface Price {
  label: string;
  /** The price as printed, e.g. "¥980" or "₱150". */
  printed: string;
  /** Value in Philippine centavos. */
  phpCentavos: Centavos;
  /** The price in the reader's currency, e.g. "₱389" for a Filipino abroad. */
  converted: string;
}

// Optional currency prefix (¥980, HK$45) or suffix (980円, 9,000원) around the amount at the end of a row.
const ANY_PRICE_AT_END =
  /(?:HK\$|S\$|NT\$|US\$|A\$|C\$|₱|PHP|Php|P|¥|￥|₩|\$|฿|€|£|RM|Rp\.?)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,7}(?:\.\d{1,2})?)\s*(?:円|원|元|บาท|yen|won|baht|php|pesos?)?\s*[A-Z*]{0,2}\s*$/iu;

/**
 * Prices on a menu, price tag or receipt in any script and currency. `from` is the currency the
 * prices are in (null = pesos); `to` is the reader's currency (null = pesos).
 */
export function findPrices(rows: string[], from: CurrencyCode | null, to: CurrencyCode | null): Price[] {
  const out: Price[] = [];
  for (const row of rows) {
    const m = row.match(ANY_PRICE_AT_END);
    if (!m) continue;
    const label = row.slice(0, m.index).replace(/[.\s:\-…]+$/gu, "").trim();
    // A real item name has at least two letters in any script (ラーメン, 김치찌개, Adobo).
    if (!/\p{L}{2,}/u.test(label)) continue;
    if (/\b(TIN|NO\.?|TEL|PHONE|CEL|DATE|TIME|SI|OR|QTY|ITEMS?)\b/i.test(label) && !/TOTAL/i.test(label)) continue;
    const value = Number(m[1].replace(/,/g, ""));
    if (!(value > 0) || value > 10_000_000) continue;
    const phpCentavos = from ? convertToPhp(value, from) : toCentavos(value);
    out.push({
      label,
      printed: from ? formatCurrency(value, from) : formatPeso(phpCentavos, { showCentavos: !Number.isInteger(value) }),
      phpCentavos,
      converted: to ? formatForeign(convertFromPhp(phpCentavos, to), to) : `≈${formatPeso(roundToPeso(phpCentavos))}`,
    });
  }
  return out;
}
