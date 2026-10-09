/** On-device text recognition (Google ML Kit, model bundled in the APK). Nothing here touches the network. */
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
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
