/**
 * The phone's own AI models, used by every screen:
 *  - Gemini Nano (built into Android) for Taglish logging and advice
 *  - ML Kit translation + language identification for traveler mode
 * Text recognition (receipt OCR) lives in native.ts.
 */
import OnDevice, { type NanoInfo, type NanoStatus } from "../modules/kita-ondevice/src/KitaOnDeviceModule";

export { OnDevice };
export type { NanoInfo, NanoStatus };

export const TRAVELER_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "th", label: "ภาษาไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ar", label: "العربية" },
  { code: "es", label: "Español" },
];

const SUPPORTED_SOURCES = new Set(["en", "tl", "ko", "ja", "zh", "es", "fr", "de", "id", "ms", "vi", "th", "ar"]);

/** Detects the language of scanned text on-device; Filipino text is reported as "tl". */
/** Bytes LakbayMate itself has sent/received since boot (Android TrafficStats); null where unsupported. */
export function appNetworkBytes(): { sent: number; received: number } | null {
  try {
    const b = OnDevice?.appNetworkBytes();
    return b && b.sent >= 0 && b.received >= 0 ? b : null;
  } catch {
    return null;
  }
}

/** File URI of a sample image bundled in the app (for the AI Lab demo). */
export async function demoImage(name: string): Promise<string> {
  if (!OnDevice) throw new Error("The on-device module is not in this build.");
  return OnDevice.demoImage(name);
}

/** Calls back with text shared to LakbayMate from another app (now, if the share opened the app, and later). */
export function onSharedText(cb: (text: string) => void): () => void {
  if (!OnDevice) return () => {};
  const take = () => {
    const text = OnDevice?.takeSharedText();
    if (text) cb(text);
  };
  take();
  const sub = OnDevice.addListener("onSharedText", take);
  return () => sub.remove();
}

export async function detectLanguage(text: string): Promise<string> {
  if (!OnDevice) return "en";
  try {
    const code = (await OnDevice.identifyLanguage(text.slice(0, 1000))).toLowerCase();
    if (code === "fil") return "tl";
    return SUPPORTED_SOURCES.has(code) ? code : "en";
  } catch {
    return "en";
  }
}

export async function downloadedLanguages(): Promise<string[]> {
  if (!OnDevice) return [];
  try {
    return await OnDevice.downloadedLanguages();
  } catch {
    return [];
  }
}

/** One-time download of a language pack pair. Returns milliseconds spent (near zero when already downloaded). */
export async function prepareTranslation(source: string, target: string): Promise<number> {
  if (!OnDevice) throw new Error("On-device translation is not in this build.");
  if (source === target) return 0;
  return OnDevice.prepareTranslation(source, target);
}

/** Translates many strings in one call using an already-open translator. */
export async function translateTexts(texts: string[], source: string, target: string): Promise<{ texts: string[]; ms: number }> {
  if (!OnDevice) throw new Error("On-device translation is not in this build.");
  if (source === target) return { texts, ms: 0 };
  return OnDevice.translateBatch(texts, source, target);
}

let counter = 0;

/** Runs Gemini Nano on the phone, streaming partial text to onText. */
export async function nanoGenerate(
  prompt: string,
  opts: { temperature: number; maxOutputTokens: number; onText?: (soFar: string) => void },
): Promise<{ text: string; ms: number; firstTokenMs: number }> {
  if (!OnDevice) throw new Error("On-device AI is not in this build.");
  const requestId = `req-${Date.now()}-${counter++}`;
  let soFar = "";
  const sub = opts.onText
    ? OnDevice.addListener("onNanoText", (e) => {
        if (e.requestId !== requestId) return;
        soFar += e.chunk;
        opts.onText!(soFar);
      })
    : null;
  try {
    return await OnDevice.nanoGenerate(requestId, prompt, opts.temperature, opts.maxOutputTokens);
  } finally {
    sub?.remove();
  }
}
