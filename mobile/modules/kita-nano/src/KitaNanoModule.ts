import { NativeModule, requireOptionalNativeModule } from "expo";

export type NanoStatus = "available" | "downloadable" | "downloading" | "unavailable";

export interface NanoInfo {
  baseModel: string | null;
  tokenLimit: number | null;
}

export interface NanoResult {
  text: string;
  ms: number;
}

type Events = { onDownloadProgress: (e: { downloaded: number; total?: number }) => void };

declare class KitaNanoModule extends NativeModule<Events> {
  checkStatus(): Promise<NanoStatus>;
  getInfo(): Promise<NanoInfo>;
  download(): Promise<string>;
  generate(system: string, prompt: string, temperature: number, maxOutputTokens: number): Promise<NanoResult>;
}

/** Null when the native module is missing (e.g. an older build). */
export default requireOptionalNativeModule<KitaNanoModule>("KitaNano");
