/** App-wide status of Gemini Nano, shared by the setup screen, Kita AI, and Privacy. */
import { useSyncExternalStore } from "react";
import { OnDevice, type NanoInfo, type NanoStatus } from "./onDevice";

export type NanoState = {
  status: NanoStatus | "missing" | null;
  info: NanoInfo | null;
  progress: string | null;
  downloading: boolean;
  error: string | null;
};

let state: NanoState = { status: null, info: null, progress: null, downloading: false, error: null };
const listeners = new Set<() => void>();

function set(patch: Partial<NanoState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useNano(): NanoState {
  return useSyncExternalStore(subscribe, () => state);
}

export async function refreshNano(): Promise<void> {
  if (!OnDevice) return set({ status: "missing" });
  try {
    const status = await OnDevice.nanoStatus();
    set({ status, error: null });
    if (status === "available") {
      set({ info: await OnDevice.nanoInfo() });
      // Load the model into memory so the first answer is not slowed by startup.
      OnDevice.nanoWarmup().catch(() => {});
    }
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
  }
}

export async function downloadNano(): Promise<void> {
  if (!OnDevice || state.downloading) return;
  set({ downloading: true, error: null });
  const sub = OnDevice.addListener("onNanoDownload", (e) =>
    set({ progress: `${(e.downloaded / 1e6).toFixed(0)} MB${e.total ? ` of ${(e.total / 1e6).toFixed(0)} MB` : ""}` }),
  );
  try {
    await OnDevice.nanoDownload();
  } catch (e) {
    set({ error: `Download failed: ${e instanceof Error ? e.message : String(e)}. Stay on Wi-Fi and try again.` });
  } finally {
    sub.remove();
    set({ downloading: false });
    await refreshNano();
  }
}
