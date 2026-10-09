import type { AppData } from "../types";

const KEY = "kitaph:v1";

export const EMPTY_DATA: AppData = { version: 1, transactions: [], receipts: [], budgets: {}, aiLog: [], isSample: false };

/** Reads saved data from this browser. Returns null when nothing (valid) is stored or storage is blocked. */
export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<AppData>;
    if (d?.version !== 1 || !Array.isArray(d.transactions)) return null;
    return { ...EMPTY_DATA, ...d } as AppData;
  } catch {
    return null;
  }
}

export function saveData(d: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}

/** Works without crypto.randomUUID, which is missing on plain-http LAN origins (e.g. a phone hitting the laptop). */
export function newId(prefix = "id"): string {
  const rand = typeof crypto !== "undefined" && "getRandomValues" in crypto
    ? Array.from(crypto.getRandomValues(new Uint32Array(2)), (n) => n.toString(36)).join("")
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
