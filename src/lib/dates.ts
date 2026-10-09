/** Date helpers that work on local calendar dates as "YYYY-MM-DD" strings (UTC math, no timezone drift). */

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** Inclusive number of days from start to end. */
export function daysBetweenInclusive(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000) + 1;
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function endOfMonth(iso: string): string {
  const d = parse(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return format(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parse(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + months);
  return format(d);
}

/** Same calendar date in another year; Feb 29 falls back to Feb 28. */
export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidISODate(target) ? target : addDays(`${y + years}-${String(m).padStart(2, "0")}-01`, d - 2);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return format(parse(s)) === s;
}
