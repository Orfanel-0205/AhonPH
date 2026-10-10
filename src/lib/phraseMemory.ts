/**
 * "Your phrases": what the traveler says most and the ones they star, with the translation that was
 * used the first time. Saying a saved phrase again is instant and needs no AI or translation pack.
 * Stored on the phone only.
 */
export interface PhraseEntry {
  text: string;
  count: number;
  fav: boolean;
  lastUsed: number;
  /** Translation per target language (ja, ko, ...) and how it was made. */
  translations: Record<string, { text: string; back: string; via: string }>;
}

export type PhraseMemory = Record<string, PhraseEntry>;

const MAX_ENTRIES = 60;
export const phraseKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Counts one use of a phrase and remembers its translation for that language. */
export function rememberPhrase(
  memory: PhraseMemory,
  text: string,
  lang: string,
  translation: { text: string; back: string; via: string },
  now = Date.now(),
): PhraseMemory {
  const key = phraseKey(text);
  if (!key) return memory;
  const prev = memory[key];
  const next: PhraseMemory = {
    ...memory,
    [key]: {
      text: prev?.text ?? text.trim(),
      count: (prev?.count ?? 0) + 1,
      fav: prev?.fav ?? false,
      lastUsed: now,
      translations: { ...(prev?.translations ?? {}), [lang]: translation },
    },
  };
  // Keep favorites, then the most used and most recent.
  const entries = Object.entries(next);
  if (entries.length <= MAX_ENTRIES) return next;
  entries.sort(([, a], [, b]) => Number(b.fav) - Number(a.fav) || b.count - a.count || b.lastUsed - a.lastUsed);
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export function toggleFavorite(memory: PhraseMemory, text: string): PhraseMemory {
  const key = phraseKey(text);
  const prev = memory[key];
  if (!prev) return { ...memory, [key]: { text: text.trim(), count: 0, fav: true, lastUsed: Date.now(), translations: {} } };
  return { ...memory, [key]: { ...prev, fav: !prev.fav } };
}

/** The bubbles to show: favorites first, then phrases said at least twice; most used first. */
export function topPhrases(memory: PhraseMemory, limit = 6): PhraseEntry[] {
  return Object.values(memory)
    .filter((p) => p.fav || p.count >= 2)
    .sort((a, b) => Number(b.fav) - Number(a.fav) || b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, limit);
}

export function savedTranslation(memory: PhraseMemory, text: string, lang: string) {
  return memory[phraseKey(text)]?.translations[lang] ?? null;
}
