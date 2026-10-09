import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import KitaNano, { type NanoInfo, type NanoStatus } from "../modules/kita-nano/src/KitaNanoModule";
import { Button, Card, ErrorBox, H2, Muted, Pill } from "./components";
import { phoneQuickLog } from "./nanoEngine";
import { QUICKLOG_CASES, scoreQuickLog, todayISO } from "./shared";
import { C, S } from "./theme";

export type NanoState = NanoStatus | "missing" | null;

/** Status of Android's built-in Gemini Nano. KitaPH bundles no model; Android provides and updates it. */
export function useNano() {
  const [status, setStatus] = useState<NanoState>(null);
  const [info, setInfo] = useState<NanoInfo | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!KitaNano) return setStatus("missing");
    try {
      const s = await KitaNano.checkStatus();
      setStatus(s);
      if (s === "available") setInfo(await KitaNano.getInfo());
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!KitaNano) return;
    const sub = KitaNano.addListener("onDownloadProgress", (e) =>
      setProgress(`${(e.downloaded / 1e6).toFixed(0)} MB${e.total ? ` of ${(e.total / 1e6).toFixed(0)} MB` : ""}`),
    );
    return () => sub.remove();
  }, [refresh]);

  const download = useCallback(async () => {
    if (!KitaNano) return;
    setDownloading(true);
    setError(null);
    try {
      await KitaNano.download();
    } catch (e) {
      setError(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloading(false);
      refresh();
    }
  }, [refresh]);

  return { status, info, progress, downloading, error, refresh, download };
}

export type Nano = ReturnType<typeof useNano>;

interface BenchResult {
  passed: number;
  cases: number;
  correct: number;
  expected: number;
  medianMs: number;
  failures: string[];
}

export function PhoneAiCard({ nano }: { nano: Nano }) {
  const { status, info, progress, downloading, error, refresh, download } = nano;
  const [bench, setBench] = useState<BenchResult | null>(null);
  const [benchProgress, setBenchProgress] = useState<string | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);

  /** Runs the same 15 Taglish sentences as scripts/eval-quicklog.mjs, on this phone. */
  async function runBenchmark() {
    setBench(null);
    setBenchError(null);
    const times: number[] = [];
    let passed = 0;
    let correct = 0;
    let expected = 0;
    const failures: string[] = [];
    try {
      for (const [i, c] of QUICKLOG_CASES.entries()) {
        setBenchProgress(`Sentence ${i + 1} of ${QUICKLOG_CASES.length}…`);
        let records: Awaited<ReturnType<typeof phoneQuickLog>>["records"] = [];
        try {
          const r = await phoneQuickLog(c.text, todayISO());
          records = r.records;
          times.push(r.meta.durationMs);
        } catch {
          times.push(0);
        }
        const s = scoreQuickLog(c, records);
        expected += s.expected;
        correct += s.correct;
        if (s.pass) passed++;
        else failures.push(c.text);
      }
      const sorted = [...times].sort((a, b) => a - b);
      setBench({ passed, cases: QUICKLOG_CASES.length, correct, expected, medianMs: sorted[Math.floor(sorted.length / 2)], failures });
    } catch (e) {
      setBenchError(String(e instanceof Error ? e.message : e));
    } finally {
      setBenchProgress(null);
    }
  }

  return (
    <Card>
      <H2>AI built into this phone</H2>
      <Muted style={{ marginBottom: S.sm }}>Gemini Nano via Android AICore. KitaPH ships no model; Android provides it and it runs offline on the phone.</Muted>
      {status === null ? <Pill label="Checking…" icon="hourglass" /> : null}
      {status === "available" ? <Pill label={`Ready on this phone${info?.baseModel ? ` · ${info.baseModel}` : ""}`} tone="good" icon="checkmark-circle" /> : null}
      {status === "downloadable" ? <Pill label="Supported · one-time download by Android" tone="info" icon="cloud-download" /> : null}
      {status === "downloading" ? <Pill label={`Android is downloading it${progress ? ` · ${progress}` : "…"}`} tone="info" icon="cloud-download" /> : null}
      {status === "unavailable" ? <Pill label="Not available on this phone" tone="warning" icon="warning" /> : null}
      {status === "missing" ? <Pill label="Bridge not in this build" tone="warning" icon="warning" /> : null}
      <View style={{ gap: S.sm, marginTop: S.md }}>
        {status === "downloadable" || status === "downloading" ? (
          <Button label={downloading ? `Downloading ${progress ?? ""}` : "Download Gemini Nano"} icon="cloud-download" onPress={download} busy={downloading} />
        ) : null}
        {status === "available" ? (
          <Button label={benchProgress ?? "Run the 15-sentence test on this phone"} icon="speedometer" variant="secondary" onPress={runBenchmark} busy={benchProgress !== null} />
        ) : null}
        <Button label="Check again" icon="refresh" variant="ghost" onPress={refresh} />
      </View>
      {error ? <View style={{ marginTop: S.sm }}><ErrorBox message={error} /></View> : null}
      {benchError ? <View style={{ marginTop: S.sm }}><ErrorBox message={benchError} /></View> : null}
      {bench ? (
        <View style={{ marginTop: S.md, gap: 4 }}>
          <Pill label={`${bench.passed}/${bench.cases} sentences · ${bench.correct}/${bench.expected} records · median ${(bench.medianMs / 1000).toFixed(1)}s`} tone={bench.passed === bench.cases ? "good" : "info"} icon="speedometer" />
          <Muted>Measured just now on this phone, same 15 sentences as the laptop test.</Muted>
          {bench.failures.length ? <Text style={{ fontSize: 12, color: C.muted }}>Missed: {bench.failures.join(" · ")}</Text> : null}
        </View>
      ) : null}
    </Card>
  );
}
