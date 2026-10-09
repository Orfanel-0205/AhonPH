import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppData, CurrencyCode, Tier, TripPlan } from "./shared";

const DATA_KEY = "kitaph:v1";
const SETTINGS_KEY = "kitaph:settings";

export const EMPTY_DATA: AppData = { version: 1, transactions: [], receipts: [], budgets: {}, aiLog: [], isSample: false };

export interface Settings {
  hubUrl: string;
  currency: CurrencyCode;
  targetLang: string;
  /** True once the one-time on-device AI setup screen has been completed or skipped. */
  setupDone: boolean;
  /** Usap: the traveler's language and the other person's language (ML Kit codes). */
  meLang: "tl" | "en";
  themLang: string;
  /** Trip currency for amounts said without a currency ("ramen 1200" in Japan). Null at home. */
  tripCurrency: CurrencyCode | null;
  /** Accommodation, shown to drivers in the local language. */
  stayName: string;
  stayAddress: string;
  /** Trip budget; expenses dated inside the trip count against it. */
  trip: TripPlan | null;
  /** "auto": Gemini Nano on this phone, else the team laptop. "laptop": always the team laptop. */
  aiEngine: "auto" | "laptop";
  /** Team access key for the laptop hub, if the hub requires one. */
  hubKey: string;
  /** Travel companions for splitting bills; the first is the user ("Ako"). */
  companions: string[];
  /** The planned itinerary behind the current trip, if the trip came from the planner. */
  itinerary: { cityId: string; tier: Tier; aspects: string[]; days: number; travelers: number } | null;
}

const DEFAULT_SETTINGS: Settings = {
  hubUrl: "",
  currency: "USD",
  targetLang: "en",
  setupDone: false,
  meLang: "tl",
  themLang: "ja",
  tripCurrency: null,
  stayName: "",
  stayAddress: "",
  trip: null,
  aiEngine: "auto",
  hubKey: "",
  companions: ["Ako"],
  itinerary: null,
};

interface Store {
  ready: boolean;
  data: AppData;
  settings: Settings;
  update: (fn: (d: AppData) => AppData) => void;
  setSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<Store | null>(null);

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** All data stays in this phone's app storage. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const [d, s] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(SETTINGS_KEY)]);
        if (d) {
          const parsed = JSON.parse(d) as AppData;
          if (parsed?.version === 1 && Array.isArray(parsed.transactions)) setData({ ...EMPTY_DATA, ...parsed });
        }
        if (s) setSettingsState({ ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<Settings>) });
      } catch {
        // Corrupt or unreadable storage: start empty rather than crash.
      }
      setReady(true);
    })();
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(DATA_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ready, data, settings, update, setSettings }), [ready, data, settings, update, setSettings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
