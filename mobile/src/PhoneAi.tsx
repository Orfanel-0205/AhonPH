import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import KitaNano, { type NanoInfo, type NanoStatus } from "../modules/kita-nano/src/KitaNanoModule";
import { Button, Card, ErrorBox, H2, Muted, Pill } from "./components";
import { C, S } from "./theme";

const TEST_PROMPT = "Nag-jeep ako 26 papuntang trabaho, lunch sa karinderya 95, load 50 sa Globe";
const TEST_SYSTEM =
  'List every peso amount in the message as JSON: {"records":[{"description":string,"amount":number,"type":"expense"|"income"}]}. Copy amounts exactly. Reply with JSON only.';

/** Probe for Android's built-in Gemini Nano. Nothing is bundled in KitaPH; the OS provides the model. */
export function PhoneAiCard() {
  const [status, setStatus] = useState<NanoStatus | "missing" | null>(null);
  const [info, setInfo] = useState<NanoInfo | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!KitaNano) return setStatus("missing");
    try {
      const s = await KitaNano.checkStatus();
      setStatus(s);
      if (s === "available") setInfo(await KitaNano.getInfo());
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    refresh();
    if (!KitaNano) return;
    const sub = KitaNano.addListener("onDownloadProgress", (e) =>
      setProgress(`${(e.downloaded / 1e6).toFixed(0)} MB${e.total ? ` of ${(e.total / 1e6).toFixed(0)} MB` : ""}`),
    );
    return () => sub.remove();
  }, []);

  async function download() {
    if (!KitaNano) return;
    setBusy(true);
    setError(null);
    try {
      await KitaNano.download();
      await refresh();
    } catch (e) {
      setError(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!KitaNano) return;
    setBusy(true);
    setError(null);
    try {
      const r = await KitaNano.generate(TEST_SYSTEM, TEST_PROMPT, 0, 256);
      setOut(`${r.text.trim()}\n\n${(r.ms / 1000).toFixed(1)}s on this phone`);
    } catch (e) {
      setError(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <H2>AI built into this phone</H2>
      <Muted style={{ marginBottom: S.sm }}>Gemini Nano via Android AICore. KitaPH ships no model; Android provides it and it runs offline on the phone.</Muted>
      {status === null ? <Pill label="Checking…" icon="hourglass" /> : null}
      {status === "available" ? <Pill label={`Ready on this phone${info?.baseModel ? ` · ${info.baseModel}` : ""}`} tone="good" icon="checkmark-circle" /> : null}
      {status === "downloadable" ? <Pill label="Supported · needs a one-time download" tone="info" icon="cloud-download" /> : null}
      {status === "downloading" ? <Pill label={`Downloading${progress ? ` · ${progress}` : "…"}`} tone="info" icon="cloud-download" /> : null}
      {status === "unavailable" ? <Pill label="Not available on this phone" tone="warning" icon="warning" /> : null}
      {status === "missing" ? <Pill label="Bridge not in this build" tone="warning" icon="warning" /> : null}
      {info ? <Muted style={{ marginTop: S.xs }}>Token limit {info.tokenLimit ?? "?"}</Muted> : null}
      <View style={{ gap: S.sm, marginTop: S.md }}>
        {status === "downloadable" || status === "downloading" ? <Button label={busy ? `Downloading ${progress ?? ""}` : "Download Gemini Nano"} icon="cloud-download" onPress={download} busy={busy} /> : null}
        {status === "available" ? <Button label="Test: Taglish quick-log on this phone" icon="flash" variant="secondary" onPress={test} busy={busy} /> : null}
        <Button label="Check again" icon="refresh" variant="ghost" onPress={refresh} />
      </View>
      {error ? <View style={{ marginTop: S.sm }}><ErrorBox message={error} /></View> : null}
      {out ? <Text style={{ marginTop: S.sm, fontFamily: "monospace", fontSize: 12, color: C.text }}>{out}</Text> : null}
    </Card>
  );
}
