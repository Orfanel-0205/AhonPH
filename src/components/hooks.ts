"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStatus, warmup } from "@/lib/client/api";
import { EMPTY_DATA, loadData, saveData } from "@/lib/client/storage";
import { todayISO } from "@/lib/dates";
import type { AiStatus } from "@/lib/server/ollama";
import type { AiCallLog, AppData } from "@/lib/types";

/** App data lives only in this browser's storage. `data` is null until it has been read on the client. */
export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);
  const [persistOk, setPersistOk] = useState(true);

  useEffect(() => {
    // Storage only exists in the browser, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(loadData() ?? EMPTY_DATA);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(prev ?? EMPTY_DATA);
      setPersistOk(saveData(next));
      return next;
    });
  }, []);

  const logAiCall = useCallback(
    (entry: AiCallLog) => update((d) => ({ ...d, aiLog: [entry, ...d.aiLog].slice(0, 50) })),
    [update],
  );

  return { data, update, logAiCall, persistOk };
}

export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayISO());
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

export type AiPhase = "checking" | "warming" | "ready" | "missing-models" | "no-ollama" | "no-server";

/** Polls the local Ollama status and loads both models into GPU memory once at startup. */
export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [phase, setPhase] = useState<AiPhase>("checking");
  const warmedRef = useRef(false);

  const refresh = useCallback(async () => {
    const s = await getStatus();
    setStatus(s);
    if (!s) return setPhase("no-server");
    if (!s.reachable) return setPhase("no-ollama");
    if (!s.text.installed || !s.vision.installed) return setPhase("missing-models");
    if (s.text.loaded && s.vision.loaded) return setPhase("ready");
    if (!warmedRef.current) {
      warmedRef.current = true;
      setPhase("warming");
      const w = await warmup();
      if (w.ok) setStatus(w.data);
      setPhase(w.ok && w.data.text.loaded && w.data.vision.loaded ? "ready" : "ready");
      return;
    }
    // Models were unloaded later (e.g. Ollama restarted); they reload on the next request.
    setPhase("ready");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { status, phase, refresh };
}
