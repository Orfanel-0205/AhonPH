/** Wrappers around the on-device ML Kit models. Nothing here touches the network. */
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import TranslateText, { TranslateLanguage } from "@react-native-ml-kit/translate-text";
import type { OcrLine } from "./shared";

export interface OcrResult {
  lines: OcrLine[];
  text: string;
  languages: string[];
  ms: number;
}

export async function recognizeText(uri: string): Promise<OcrResult> {
  const started = Date.now();
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
  const lines: OcrLine[] = result.blocks.flatMap((b) => b.lines.map((l) => ({ text: l.text, frame: l.frame })));
  const languages = [...new Set(result.blocks.flatMap((b) => b.recognizedLanguages.map((l) => l.languageCode)).filter((c) => c && c !== "und"))];
  return { lines, text: result.text, languages, ms: Date.now() - started };
}

export const TRAVELER_LANGUAGES: { code: TranslateLanguage; label: string }[] = [
  { code: TranslateLanguage.ENGLISH, label: "English" },
  { code: TranslateLanguage.KOREAN, label: "한국어" },
  { code: TranslateLanguage.JAPANESE, label: "日本語" },
  { code: TranslateLanguage.CHINESE, label: "中文" },
  { code: TranslateLanguage.SPANISH, label: "Español" },
  { code: TranslateLanguage.FRENCH, label: "Français" },
  { code: TranslateLanguage.GERMAN, label: "Deutsch" },
];

/** On-device translation. The language pack (~30 MB) downloads once; after that it works offline. */
export async function translate(text: string, source: string, target: string): Promise<{ text: string; ms: number }> {
  const started = Date.now();
  if (!text.trim() || source === target) return { text, ms: 0 };
  const out = await TranslateText.translate({
    text,
    sourceLanguage: source as TranslateLanguage,
    targetLanguage: target as TranslateLanguage,
    downloadModelIfNeeded: true,
  });
  return { text: String(out), ms: Date.now() - started };
}
