import { NativeModule, requireOptionalNativeModule } from "expo";

export type NanoStatus = "available" | "downloadable" | "downloading" | "unavailable";

export interface NanoInfo {
  baseModel: string | null;
  tokenLimit: number | null;
}

export interface NanoResult {
  text: string;
  ms: number;
  firstTokenMs: number;
}

type Events = {
  onNanoDownload: (e: { downloaded: number; total?: number }) => void;
  onNanoText: (e: { requestId: string; chunk: string }) => void;
};

declare class KitaOnDeviceModule extends NativeModule<Events> {
  nanoStatus(): Promise<NanoStatus>;
  nanoInfo(): Promise<NanoInfo>;
  nanoDownload(): Promise<string>;
  nanoWarmup(): Promise<boolean>;
  nanoGenerate(requestId: string, prompt: string, temperature: number, maxOutputTokens: number): Promise<NanoResult>;
  nanoReadImage(uri: string, prompt: string, maxOutputTokens: number): Promise<{ text: string; ms: number }>;
  downloadedLanguages(): Promise<string[]>;
  prepareTranslation(source: string, target: string): Promise<number>;
  translateBatch(texts: string[], source: string, target: string): Promise<{ texts: string[]; ms: number }>;
  identifyLanguage(text: string): Promise<string>;
}

/** Null when the native module is missing (e.g. running in Expo Go). */
export default requireOptionalNativeModule<KitaOnDeviceModule>("KitaOnDevice");
