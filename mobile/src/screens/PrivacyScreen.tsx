import { useNetworkState } from "expo-network";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Button, Card, H2, Muted, Pill, styles } from "../components";
import { phoneQuickLog } from "../nanoEngine";
import { useNano } from "../nanoStore";
import { downloadedLanguages, TRAVELER_LANGUAGES } from "../onDevice";
import { buildSampleData, ECON_FACTS, formatDate, formatPeso, FX, QUICKLOG_CASES, QUICKLOG_FINAL, QUICKLOG_HOLDOUT, scoreQuickLog, todayISO, type ParsedRecord, type QuickLogCase } from "../shared";
import { EMPTY_DATA, useStore } from "../store";
import { OfflineAIDemo, OnPhoneModels, TeamLaptopAI } from "./AILab";
import { C, S } from "../theme";

function Row({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{title}</Text>
      <Muted>{body}</Muted>
    </View>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** AICore throttles bursts of requests from one app; the test paces itself and retries, and reports leftovers. */
async function quickLogWithRetry(text: string): Promise<{ raw: ParsedRecord[]; records: ParsedRecord[]; ms: number } | { error: string }> {
  let last = "";
  for (const wait of [0, 5_000, 15_000, 30_000]) {
    if (wait) await sleep(wait);
    try {
      return await phoneQuickLog(text, todayISO());
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  return { error: last };
}

interface SetResult {
  name: string;
  cases: number;
  aiOnly: number;
  hybrid: number;
  records: number;
  hybridRecords: number;
}

const TEST_SETS: { name: string; cases: QuickLogCase[] }[] = [
  { name: "Dev set", cases: QUICKLOG_CASES },
  { name: "Held-out", cases: QUICKLOG_HOLDOUT },
  { name: "Final (scored once)", cases: QUICKLOG_FINAL },
];

/** Runs all three Taglish test sets through Gemini Nano on this phone and scores them exactly. */
function OnDeviceTest() {
  const nano = useNano();
  const [results, setResults] = useState<SetResult[] | null>(null);
  const [medianMs, setMedianMs] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function run() {
    setResults(null);
    const errs: string[] = [];
    const times: number[] = [];
    const out: SetResult[] = [];
    const total = TEST_SETS.reduce((n, t) => n + t.cases.length, 0);
    let done = 0;
    for (const set of TEST_SETS) {
      const r: SetResult = { name: set.name, cases: set.cases.length, aiOnly: 0, hybrid: 0, records: 0, hybridRecords: 0 };
      for (const c of set.cases) {
        setProgress(`Sentence ${++done} of ${total}…`);
        let raw: ParsedRecord[] = [];
        let refined: ParsedRecord[] = [];
        const res = await quickLogWithRetry(c.text);
        if ("error" in res) {
          errs.push(`${c.text}: ${res.error}`);
        } else {
          raw = res.raw;
          refined = res.records;
          times.push(res.ms);
        }
        await sleep(1_500);
        const a = scoreQuickLog(c, raw);
        const h = scoreQuickLog(c, refined);
        if (a.pass) r.aiOnly++;
        if (h.pass) r.hybrid++;
        r.records += a.correct;
        r.hybridRecords += h.correct;
      }
      out.push(r);
    }
    const sorted = [...times].sort((x, y) => x - y);
    setMedianMs(sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0);
    setResults(out);
    setErrors(errs);
    setProgress(null);
  }

  if (nano.status !== "available") return null;
  return (
    <Card>
      <H2>Test the on-device AI</H2>
      <Muted style={{ marginBottom: S.sm }}>
        Runs 45 Taglish test sentences through Gemini Nano on this phone. &quot;AI only&quot; is the model&apos;s answer; &quot;AI + local&quot; adds LakbayMate&apos;s keyword knowledge.
      </Muted>
      <Button label={progress ?? "Run the on-device test"} icon="speedometer" variant="secondary" onPress={run} busy={progress !== null} />
      {results ? (
        <View style={{ marginTop: S.md }}>
          <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ flex: 1.4, fontSize: 12, color: C.muted, fontWeight: "700" }}>Set</Text>
            <Text style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: "700", textAlign: "right" }}>AI only</Text>
            <Text style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: "700", textAlign: "right" }}>AI + local</Text>
          </View>
          {results.map((r) => (
            <View key={r.name} style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
              <Text style={{ flex: 1.4, fontSize: 13, color: C.text }}>{r.name}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: C.text, textAlign: "right", fontVariant: ["tabular-nums"] }}>{r.aiOnly}/{r.cases}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: C.text, textAlign: "right", fontWeight: "700", fontVariant: ["tabular-nums"] }}>{r.hybrid}/{r.cases}</Text>
            </View>
          ))}
          <Muted style={{ marginTop: S.sm }}>Sentences fully correct. Median {(medianMs / 1000).toFixed(1)}s per sentence on this phone. Measured just now.</Muted>
          <Muted>{errors.length ? `${errors.length} sentence(s) still failed after retries (counted as wrong): ${errors.slice(0, 2).join(" · ")}` : "No AI errors during the run."}</Muted>
        </View>
      ) : null}
    </Card>
  );
}

function Check({ ok, label, note }: { ok: boolean; label: string; note: string }) {
  return (
    <View style={{ flexDirection: "row", gap: S.sm, paddingVertical: 6 }}>
      <Text style={{ fontSize: 16, color: ok ? C.good : C.muted, width: 20 }}>{ok ? "✓" : "–"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{label}</Text>
        <Muted>{note}</Muted>
      </View>
    </View>
  );
}

/** Live proof for the demo: with the network off, everything that matters still works. */
function CloudGoneCard() {
  const net = useNetworkState();
  const nano = useNano();
  const { data } = useStore();
  const [langs, setLangs] = useState<string[]>([]);
  useEffect(() => {
    downloadedLanguages().then(setLangs);
  }, []);
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const tracked = data.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCentavos, 0);
  const langNames = TRAVELER_LANGUAGES.filter((l) => l.code !== "en" && langs.includes(l.code)).map((l) => l.label);
  return (
    <Card style={{ borderColor: offline ? C.good : C.border, borderWidth: offline ? 2 : 1 }}>
      <H2>If the cloud disappears</H2>
      <Pill label={offline ? "Right now: offline — and still working" : "Right now: online (LakbayMate doesn't need it)"} tone={offline ? "good" : "info"} icon={offline ? "airplane" : "wifi"} />
      <View style={{ marginTop: S.sm }}>
        <Check ok label="Scan receipts, breakdown, tips, Presyo" note="ML Kit text recognition + LakbayMate code, on this phone" />
        <Check ok={nano.status === "available"} label="Taglish logging and LakbayMate AI" note={nano.status === "available" ? "Gemini Nano, built into Android, on this phone" : "Needs the one-time Gemini Nano setup (or basic mode)"} />
        <Check ok={langNames.length > 0} label="Traveler translation" note={langNames.length ? `Offline packs: Filipino, English, ${langNames.join(", ")}` : "English only until a language pack is downloaded"} />
      </View>
      <Muted style={{ marginTop: S.sm }}>
        Kept only on this phone: {data.receipts.length} receipts · {data.transactions.length} records · {formatPeso(tracked)} of spending. Nothing is uploaded.
      </Muted>
    </Card>
  );
}

export function PrivacyScreen({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { data, update } = useStore();
  const nano = useNano();
  const nanoText =
    nano.status === "available"
      ? `Ready${nano.info?.baseModel ? ` (${nano.info.baseModel})` : ""}. Android's built-in model; LakbayMate bundles none.`
      : nano.status === "downloadable" || nano.status === "downloading"
        ? "Supported on this phone. Finish the one-time download in setup."
        : "Not available on this phone. LakbayMate AI uses your laptop hub or basic mode.";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>AI Lab</Text>
      <Muted style={{ marginBottom: S.md }}>
        Every AI model in LakbayMate runs on this phone. Turn on airplane mode and run the demo: nothing needs the internet, and your data never leaves the phone.
      </Muted>

      <OfflineAIDemo />
      <TeamLaptopAI />
      <OnPhoneModels onOpenSetup={onOpenSetup} />
      <CloudGoneCard />

      <Card>
        <H2>Privacy · what runs where</H2>
        <Row title="Receipt reader" body="Google ML Kit text recognition, bundled in the app. Photos are never uploaded." />
        <Row title="LakbayMate AI · Gemini Nano" body={nanoText} />
        <Row title="Traveler translation" body="Google ML Kit on-device translation and language detection. Language packs download once, then work offline." />
        <Row title="Receipt checks, budgets, tips" body="LakbayMate code: every peso is computed, never guessed by AI." />
        <Row title="Economic data" body={`Bundled PSA inflation (${ECON_FACTS.headlineInflation.period}) and DOLE wage figures; ${FX.source} for currencies.`} />
        <View style={{ marginTop: S.md }}>
          <Button label="Offline AI setup" icon="construct" variant="secondary" onPress={onOpenSetup} />
        </View>
      </Card>

      <Card>
        <H2>On your laptop hub (optional)</H2>
        <Row title="Taglish logging and advisor" body="Gemma 3 4B via Ollama on your own laptop, over local Wi-Fi. No internet, no cloud AI." />
      </Card>

      <Card>
        <H2>Never</H2>
        <Row title="No cloud AI, no account, no tracking" body="LakbayMate sends your finances nowhere. There is no login and no analytics." />
      </Card>

      <OnDeviceTest />

      <Card>
        <H2>Your data</H2>
        <Muted style={{ marginBottom: S.md }}>
          {data.transactions.length} records · {data.receipts.length} receipts{data.isSample ? " · sample data" : ""} · today {formatDate(todayISO())}
        </Muted>
        <View style={{ gap: S.sm }}>
          <Button label="Load sample data" icon="person" variant="secondary" onPress={() => update(() => buildSampleData(todayISO()))} />
          <Button
            label="Delete all data"
            icon="trash"
            variant="danger"
            onPress={() =>
              Alert.alert("Delete all data?", "This removes every record and receipt from this phone. It can't be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => update(() => EMPTY_DATA) },
              ])
            }
          />
        </View>
      </Card>
    </ScrollView>
  );
}
