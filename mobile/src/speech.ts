/**
 * Speech on the phone: Android's on-device speech recognition (offline language packs) and
 * text-to-speech. Recognition is started with requiresOnDeviceRecognition, so audio never leaves the phone.
 */
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

/** Language codes used for translation (ML Kit) mapped to speech locales. */
export const SPEECH_LOCALE: Record<string, string> = {
  tl: "fil-PH",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "cmn-Hans-CN",
  th: "th-TH",
  vi: "vi-VN",
  ar: "ar-SA",
  es: "es-ES",
  id: "id-ID",
  ms: "ms-MY",
  fr: "fr-FR",
  de: "de-DE",
};

const TTS_LOCALE: Record<string, string> = { ...SPEECH_LOCALE, zh: "zh-CN" };

/** Languages the other person may speak. */
export const THEM_LANGS: { code: string; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "th", label: "ภาษาไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ar", label: "العربية" },
  { code: "es", label: "Español" },
];

const norm = (l: string) => l.toLowerCase().replace(/_/g, "-");
const base = (l: string) => {
  const b = norm(l).split("-")[0];
  return b === "cmn" || b === "yue" ? "zh" : b === "fil" ? "tl" : b;
};

/** Exact offline locales installed on this phone, e.g. ["en-GB", "ja-JP"]. */
let installed: string[] = [];

/** Translation language codes whose offline speech model is installed on this phone. */
export async function offlineSpeechLanguages(): Promise<string[]> {
  try {
    const r = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    installed = r.installedLocales;
    console.log(`[KitaSpeech] installed offline locales: ${installed.join(", ")}`);
    return [...new Set(installed.map(base))];
  } catch {
    return [];
  }
}

/** The installed variant for a language (en-GB rather than en-US if that is what's on the phone). */
function localeFor(code: string): string {
  const preferred = SPEECH_LOCALE[code] ?? code;
  const exact = installed.find((l) => norm(l) === norm(preferred));
  if (exact) return exact;
  return installed.find((l) => base(l) === code) ?? preferred;
}

/** Asks Android to download the offline speech model for a language (one time, needs Wi-Fi). */
export async function downloadSpeech(code: string): Promise<string> {
  const r = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: SPEECH_LOCALE[code] });
  return r.status;
}

const ERROR_TEXT: Record<string, string> = {
  "language-not-supported": "Offline speech for this language isn't on the phone yet. Download it in Offline AI setup.",
  "service-not-allowed": "Offline speech isn't available. Download the language in Offline AI setup.",
  "not-allowed": "Microphone permission is needed.",
  "no-speech": "Didn't catch that. Try again, a bit closer to the phone.",
  "speech-timeout": "Didn't catch that. Try again, a bit closer to the phone.",
  network: "Offline speech for this language isn't on the phone yet. Download it in Offline AI setup.",
};

export interface Listening {
  /** Resolves with the final transcript ("" if nothing was heard). */
  done: Promise<string>;
  stop: () => void;
}

/** Listens once in the given language, fully on the phone, reporting partial text as it comes. */
export async function listen(code: string, onPartial: (text: string) => void): Promise<Listening> {
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) throw new Error(ERROR_TEXT["not-allowed"]);
  if (installed.length === 0) await offlineSpeechLanguages();
  const locale = localeFor(code);
  let latest = "";
  const subs: { remove: () => void }[] = [];
  const done = new Promise<string>((resolve, reject) => {
    subs.push(
      ExpoSpeechRecognitionModule.addListener("result", (e) => {
        const t = e.results[0]?.transcript ?? "";
        if (t) {
          latest = t;
          onPartial(t);
        }
      }),
      ExpoSpeechRecognitionModule.addListener("error", (e) => {
        console.log(`[KitaSpeech] error ${e.error}: ${e.message} (locale ${locale})`);
        if (e.error === "aborted") return;
        if ((e.error === "no-speech" || e.error === "speech-timeout") && latest) return;
        reject(new Error(ERROR_TEXT[e.error] ?? `Speech error: ${e.message || e.error}`));
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => resolve(latest)),
    );
  }).finally(() => subs.forEach((s) => s.remove()));
  ExpoSpeechRecognitionModule.start({
    lang: locale,
    interimResults: true,
    continuous: false,
    requiresOnDeviceRecognition: true,
    addsPunctuation: true,
  });
  return { done, stop: () => ExpoSpeechRecognitionModule.stop() };
}

/** Reads text aloud in the given language with the phone's voice. */
export function speak(text: string, code: string) {
  Speech.stop();
  Speech.speak(text, { language: TTS_LOCALE[code] ?? code, rate: 0.95 });
}

/** The language to listen in: the preferred one if its offline pack is installed, else English if it is. */
export async function speechLanguageFor(preferred: string): Promise<string> {
  const langs = await offlineSpeechLanguages();
  if (langs.includes(preferred)) return preferred;
  return langs.includes("en") ? "en" : preferred;
}
