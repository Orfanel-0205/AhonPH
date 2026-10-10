/**
 * Offline history: what you said and heard in Usap, what you scanned, split, planned and logged, and
 * AI Lab runs. Stored only on this phone (AsyncStorage), newest first, at most 500 entries.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export type HistoryKind = "usap" | "scan" | "split" | "plan" | "gastos" | "ailab";

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  /** ISO timestamp. */
  at: string;
  title: string;
  detail?: string;
}

const KEY = "kitaph:history";
const MAX = 500;
let entries: HistoryEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) entries = (JSON.parse(raw) as HistoryEntry[]).concat(entries).slice(0, MAX);
  } catch {
    // Unreadable history: start a new one.
  }
  emit();
}
load();

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
  emit();
}

export function logHistory(kind: HistoryKind, title: string, detail?: string) {
  const at = new Date().toISOString();
  entries = [{ id: `${at}-${Math.random().toString(36).slice(2, 7)}`, kind, at, title: title.slice(0, 200), detail: detail?.slice(0, 400) }, ...entries].slice(0, MAX);
  save();
}

export function clearHistory() {
  entries = [];
  save();
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => entries,
  );
}
