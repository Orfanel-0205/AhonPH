/** On-device text recognition (Google ML Kit, model bundled in the APK). Nothing here touches the network. */
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import type { OcrLine } from "./shared";

/**
 * Temporary, for tuning the receipt reader on real receipts during the hackathon: writes what the
 * phone read to the device log (adb logcat). Set to false before the final build.
 */
const DEBUG_OCR = false;

function logOcr(lines: OcrLine[]) {
  const compact = lines.map((l) => [l.text, l.frame ? [Math.round(l.frame.left), Math.round(l.frame.top), Math.round(l.frame.width), Math.round(l.frame.height)] : null, l.corners?.map((c) => [Math.round(c.x), Math.round(c.y)]) ?? null]);
  const json = JSON.stringify(compact);
  for (let i = 0; i < json.length; i += 3000) console.log(`[KitaOCR ${i / 3000}/${Math.ceil(json.length / 3000) - 1}] ${json.slice(i, i + 3000)}`);
}

export interface OcrResult {
  lines: OcrLine[];
  text: string;
  languages: string[];
  ms: number;
}

export async function recognizeText(uri: string): Promise<OcrResult> {
  const started = Date.now();
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
  const lines: OcrLine[] = result.blocks.flatMap((b) =>
    b.lines.map((l) => ({ text: l.text, frame: l.frame, corners: l.cornerPoints?.map((p) => ({ x: p.x, y: p.y })) })),
  );
  if (DEBUG_OCR) logOcr(lines);
  const languages = [...new Set(result.blocks.flatMap((b) => b.recognizedLanguages.map((l) => l.languageCode)).filter((c) => c && c !== "und"))];
  return { lines, text: result.text, languages, ms: Date.now() - started };
}
