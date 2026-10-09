/**
 * Turns on-device OCR output (ML Kit text lines with bounding boxes) into a structured receipt.
 * Pure code: no model involved, so every step is testable and the result is checked by arithmetic.
 */
import { parseReceiptDate } from "./ai";
import { addDays } from "./dates";
import { toCentavos } from "./money";
import { checkReceipt, checkReceiptWithSubtotal, type ReceiptCheck } from "./receipt";
import type { Centavos, ReceiptItem } from "./types";

export interface OcrFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OcrPoint {
  x: number;
  y: number;
}

export interface OcrLine {
  text: string;
  frame?: OcrFrame;
  /** ML Kit corner points: top-left, top-right, bottom-right, bottom-left. They carry the text's tilt. */
  corners?: OcrPoint[];
}

/** Median tilt (radians) of the longer text lines, from their top edge. 0 when unknown. */
export function estimateSkew(lines: OcrLine[]): number {
  const angles = lines
    .filter((l) => l.corners && l.corners.length >= 2 && l.frame && l.frame.width > l.frame.height * 2)
    .map((l) => Math.atan2(l.corners![1].y - l.corners![0].y, l.corners![1].x - l.corners![0].x))
    .filter((a) => Math.abs(a) < Math.PI / 6)
    .sort((a, b) => a - b);
  return angles.length >= 3 ? angles[Math.floor(angles.length / 2)] : 0;
}

export interface ScannedReceipt {
  merchant: string;
  date: string;
  dateFromReceipt: boolean;
  items: ReceiptItem[];
  totalCentavos: Centavos;
  /** False when no TOTAL line was found and the items' sum is used instead. */
  totalFound: boolean;
  vatCentavos: Centavos | null;
  /** Printed SUBTOTAL, when present. */
  subtotalCentavos: Centavos | null;
  check: ReceiptCheck;
  /** "subtotal" when the items match the SUBTOTAL and the TOTAL adds tax or fees on top. */
  checkBasis: "total" | "subtotal";
  /** The reconstructed rows, shown to the user so they can see what was read. */
  rows: string[];
}

/** Groups OCR lines that sit on the same printed row (receipts put names left and prices right). */
export function linesToRows(lines: OcrLine[]): string[] {
  const withFrames = lines.filter((l) => l.frame && l.text.trim());
  if (withFrames.length < lines.filter((l) => l.text.trim()).length * 0.8) {
    return lines.map((l) => l.text.trim()).filter(Boolean);
  }
  const heights = withFrames.map((l) => l.frame!.height).sort((a, b) => a - b);
  const tolerance = heights[Math.floor(heights.length / 2)] * 0.5;
  // Rotate centers back by the photo's tilt so a name and its price on one printed row line up,
  // even when the receipt was photographed at an angle.
  const skew = estimateSkew(withFrames);
  const cos = Math.cos(skew);
  const sin = Math.sin(skew);
  const placed = withFrames.map((l) => {
    const cx = l.frame!.left + l.frame!.width / 2;
    const cy = l.frame!.top + l.frame!.height / 2;
    return { line: l, x: cx * cos + cy * sin, y: -cx * sin + cy * cos };
  });
  placed.sort((a, b) => a.y - b.y);
  const rows: { cy: number; parts: typeof placed }[] = [];
  for (const p of placed) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(p.y - row.cy) <= tolerance) {
      row.parts.push(p);
      row.cy = (row.cy * (row.parts.length - 1) + p.y) / row.parts.length;
    } else {
      rows.push({ cy: p.y, parts: [p] });
    }
  }
  return rows.map((r) =>
    r.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.line.text.trim())
      .join("  "),
  );
}

// Amount at the end of a row, optionally followed by a VAT flag like "V", "T", "*", "X".
const AMOUNT_AT_END = /(-?\d{1,3}(?:,\d{3})+\.\d{2}|-?\d+\.\d{2})\s*[A-Z*#]{0,2}\s*$/i;
const QTY_AT = /(\d+(?:\.\d+)?)\s*(?:PCS?|PC|KG|G)?\s*[@xX×]\s*(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/;
const TOTAL_RE = /\b(GRAND\s*TOTAL|TOTAL\s*AMOUNT(\s*DUE)?|AMOUNT\s*DUE|TOTAL\s*DUE|TOTAL\s*SALES?|TOTAL)\b/i;
const NOT_TOTAL_RE = /SUB\s*-?\s*TOTAL|TOTAL\s*(ITEMS?|QTY|QUANTITY|DISC(OUNT)?|SAVINGS?|PCS)/i;
const VAT_AMOUNT_RE = /^(VAT|V\.A\.T\.?)(\s*\(?12\s*%\)?)?\s*(AMOUNT)?\b/i;
const SKIP_RE =
  /SUB\s*-?\s*TOTAL|VAT|V\.A\.T|ZERO[-\s]*RATED|EXEMPT|CASH|CHANGE|TENDER|G\s*CASH|MAYA|CARD|CREDIT|DEBIT|\bTIN\b|\bS\.?I\.?\s*(NO|#)|\bO\.?R\.?\s*(NO|#)|INVOICE|TRANS(ACTION)?|CASHIER|TERMINAL|ITEMS?\s*SOLD|TOTAL\s*(ITEMS?|QTY|PCS)|BALANCE|POINTS|SERIAL|\bMIN\b|\bPTU\b|ACCRED|THANK|\bDATE\b|\bTIME\b|CUSTOMER|ADDRESS|BUSINESS\s*STYLE|\bTAX\b|SAVINGS?|YOU\s*SAVED|\bTEND(ERED)?\b/i;
const DISCOUNT_RE = /DISCOUNT|\bLESS\b|SENIOR|\bPWD\b|PROMO|\bDISC\b/i;
const SERVICE_RE = /SERVICE\s*CHARGE|SVC\s*CHG|SERV\.?\s*CHG/i;
const SUBTOTAL_RE = /SUB\s*-?\s*TOTAL/i;

function toAmount(s: string): number {
  return Number(s.replace(/,/g, ""));
}

function stripAmount(row: string): { label: string; amount: number | null } {
  const m = row.match(AMOUNT_AT_END);
  if (!m) return { label: row.trim(), amount: null };
  return { label: row.slice(0, m.index).trim(), amount: toAmount(m[1]) };
}

function cleanName(s: string): string {
  return s
    .replace(QTY_AT, "")
    // Barcodes / product codes and trailing tax-flag letters ("N", "X", "F") are not part of the name.
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+[A-Z]$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-*.:]+|[\s\-*.:]+$/g, "")
    .trim();
}

function findDate(rows: string[], today: string): { date: string; fromReceipt: boolean } {
  for (const row of rows) {
    for (const m of row.matchAll(/(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g)) {
      const d = parseReceiptDate(m[1]);
      if (d && d <= today && d >= addDays(today, -730)) return { date: d, fromReceipt: true };
    }
  }
  return { date: today, fromReceipt: false };
}

export function parseOcrReceipt(lines: OcrLine[], today: string): ScannedReceipt | null {
  const rows = linesToRows(lines);
  if (rows.length === 0) return null;

  const items: ReceiptItem[] = [];
  /** Every TOTAL-like amount, in order; the one that agrees with the items is chosen afterwards. */
  const totals: number[] = [];
  let subtotal: number | null = null;
  let vat: number | null = null;
  let pendingName: string | null = null;
  let awaitingTotal = false;
  /** Set after "NAME  6 @ 16.50": the printed line total may follow on its own row. */
  let awaitingLineTotal = false;

  for (const row of rows) {
    const { label, amount } = stripAmount(row);
    const qty = row.match(QTY_AT);

    if (awaitingTotal && amount !== null && label === "") {
      totals.push(amount);
      awaitingTotal = false;
      continue;
    }
    awaitingTotal = false;

    if (awaitingLineTotal && amount !== null && label === "") {
      // The printed line total wins over quantity × unit price (weighed items, rounding).
      items[items.length - 1].lineTotalCentavos = toCentavos(amount);
      awaitingLineTotal = false;
      continue;
    }
    awaitingLineTotal = false;

    // "NAME   6 @ 16.50" — the row ends with the unit price, not the line total.
    const qtyEndsRow = qty !== null && row.trim().replace(/\s*[A-Z*#]{1,2}$/i, "").endsWith(qty[0].trim());
    if (qtyEndsRow && !TOTAL_RE.test(label) && !SKIP_RE.test(label)) {
      const name = cleanName(row.slice(0, qty.index)) || pendingName;
      if (name && /[A-Z]{2,}/i.test(name)) {
        const quantity = Number(qty[1]);
        items.push({ name: name.slice(0, 80), quantity, lineTotalCentavos: toCentavos(quantity * toAmount(qty[2])) });
        pendingName = null;
        awaitingLineTotal = true;
        continue;
      }
    }

    if (TOTAL_RE.test(label) && !NOT_TOTAL_RE.test(label)) {
      // When the amount is on the next row, take it from there.
      if (amount !== null) totals.push(amount);
      else awaitingTotal = true;
      pendingName = null;
      continue;
    }
    if (SUBTOTAL_RE.test(label) && amount !== null) {
      subtotal = amount;
      pendingName = null;
      continue;
    }
    if (VAT_AMOUNT_RE.test(label) && amount !== null) {
      vat = amount;
      continue;
    }
    if (SERVICE_RE.test(label) && amount !== null) {
      items.push({ name: "Service charge", quantity: 1, lineTotalCentavos: toCentavos(amount) });
      continue;
    }
    if (DISCOUNT_RE.test(label) && amount !== null) {
      items.push({ name: cleanName(label) || "Discount", quantity: 1, lineTotalCentavos: -Math.abs(toCentavos(amount)) });
      continue;
    }
    if (SKIP_RE.test(label)) {
      pendingName = null;
      continue;
    }

    const name = cleanName(label);
    if (amount !== null) {
      const quantity = qty ? Number(qty[1]) : 1;
      if (name && /[A-Z]{2,}/i.test(name)) {
        items.push({ name, quantity, lineTotalCentavos: toCentavos(amount) });
        pendingName = null;
      } else if (pendingName) {
        // "6 @ 16.50     99.00" under a name-only row.
        items.push({ name: pendingName, quantity, lineTotalCentavos: toCentavos(amount) });
        pendingName = null;
      } else if (qty && items.length > 0) {
        // Quantity row printed after an item that already had its amount.
        const last = items[items.length - 1];
        if (toCentavos(Number(qty[1]) * toAmount(qty[2])) === last.lineTotalCentavos) last.quantity = Number(qty[1]);
      }
      continue;
    }

    if (qty && items.length > 0 && !name) {
      // "6 @ 16.50" alone after "LUCKY ME ... 99.00": attach the quantity if it multiplies out.
      const last = items[items.length - 1];
      if (toCentavos(Number(qty[1]) * toAmount(qty[2])) === last.lineTotalCentavos) last.quantity = Number(qty[1]);
      continue;
    }
    if (name && /[A-Z]{3,}/i.test(name)) pendingName = name.slice(0, 80);
  }

  const merchant =
    rows.find((r) => /[A-Z]{3,}/i.test(r) && !AMOUNT_AT_END.test(r) && !SKIP_RE.test(r))?.trim().slice(0, 80) ?? "Receipt";
  // The merchant header is never an item.
  const purchased = items.filter((i) => i.name !== merchant);
  const subtotalCentavos = subtotal !== null ? toCentavos(subtotal) : null;
  const candidates = totals.filter((t) => t > 0).map(toCentavos);
  const maxItem = purchased.reduce((m, i) => Math.max(m, i.lineTotalCentavos), 0);
  // Prefer a TOTAL the items actually add up to (last one first), then one consistent with the
  // SUBTOTAL, then the last TOTAL that is at least as large as the biggest item.
  const agrees = (c: Centavos) => {
    const st = checkReceiptWithSubtotal(purchased, c, subtotalCentavos).check.status;
    return st === "ok" || st === "repaired";
  };
  const chosen =
    [...candidates].reverse().find(agrees) ??
    [...candidates].reverse().find((c) => c >= maxItem) ??
    (candidates.length ? Math.max(...candidates) : null);
  const totalFound = chosen !== null;
  const totalCentavos = chosen ?? subtotalCentavos ?? purchased.reduce((s, i) => s + i.lineTotalCentavos, 0);
  if (totalCentavos <= 0 && purchased.length === 0) return null;
  const checked = checkReceiptWithSubtotal(purchased, totalCentavos, subtotalCentavos);
  const { date, fromReceipt } = findDate(rows, today);
  return {
    merchant,
    date,
    dateFromReceipt: fromReceipt,
    items: checked.items,
    totalCentavos,
    totalFound,
    vatCentavos: vat !== null ? toCentavos(vat) : null,
    subtotalCentavos,
    check: checked.check,
    checkBasis: checked.basis,
    rows,
  };
}
