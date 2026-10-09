import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Button, Card, H2, Muted, Pill, styles } from "../components";
import { phoneQuickLog } from "../nanoEngine";
import { useNano } from "../nanoStore";
import { buildSampleData, ECON_FACTS, formatDate, FX, QUICKLOG_CASES, scoreQuickLog, todayISO } from "../shared";
import { EMPTY_DATA, useStore } from "../store";
import { C, S } from "../theme";

function Row({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{title}</Text>
      <Muted>{body}</Muted>
    </View>
  );
}

interface TestResult {
  passed: number;
  cases: number;
  correct: number;
  expected: number;
  medianMs: number;
  missed: string[];
}

/** Runs the same 15 Taglish sentences as scripts/eval-quicklog.mjs, on this phone, and shows the measured result. */
function OnDeviceTest() {
  const nano = useNano();
  const [result, setResult] = useState<TestResult | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function run() {
    setResult(null);
    const times: number[] = [];
    let passed = 0;
    let correct = 0;
    let expected = 0;
    const missed: string[] = [];
    for (const [i, c] of QUICKLOG_CASES.entries()) {
      setProgress(`Sentence ${i + 1} of ${QUICKLOG_CASES.length}…`);
      let records: Awaited<ReturnType<typeof phoneQuickLog>>["records"] = [];
      try {
        const r = await phoneQuickLog(c.text, todayISO());
        records = r.records;
        times.push(r.ms);
      } catch {
        // An unreadable answer counts as a miss.
      }
      const s = scoreQuickLog(c, records);
      expected += s.expected;
      correct += s.correct;
      if (s.pass) passed++;
      else missed.push(c.text);
    }
    const sorted = [...times].sort((a, b) => a - b);
    setResult({ passed, cases: QUICKLOG_CASES.length, correct, expected, medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0, missed });
    setProgress(null);
  }

  if (nano.status !== "available") return null;
  return (
    <Card>
      <H2>Test the on-device AI</H2>
      <Muted style={{ marginBottom: S.sm }}>Runs our 15 Taglish test sentences through Gemini Nano on this phone and scores them exactly.</Muted>
      <Button label={progress ?? "Run the 15-sentence test"} icon="speedometer" variant="secondary" onPress={run} busy={progress !== null} />
      {result ? (
        <View style={{ marginTop: S.md, gap: 4 }}>
          <Pill
            label={`${result.passed}/${result.cases} sentences · ${result.correct}/${result.expected} records · median ${(result.medianMs / 1000).toFixed(1)}s`}
            tone={result.passed === result.cases ? "good" : "info"}
            icon="speedometer"
          />
          <Muted>Measured just now on this phone. Same sentences as the laptop test in the repo.</Muted>
          {result.missed.length ? <Text style={{ fontSize: 12, color: C.muted }}>Missed: {result.missed.join(" · ")}</Text> : null}
        </View>
      ) : null}
    </Card>
  );
}

export function PrivacyScreen({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { data, update } = useStore();
  const nano = useNano();
  const nanoText =
    nano.status === "available"
      ? `Ready${nano.info?.baseModel ? ` (${nano.info.baseModel})` : ""}. Android's built-in model; KitaPH bundles none.`
      : nano.status === "downloadable" || nano.status === "downloading"
        ? "Supported on this phone. Finish the one-time download in setup."
        : "Not available on this phone. Kita AI uses your laptop hub or basic mode.";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Privacy</Text>
      <Muted style={{ marginBottom: S.md }}>Your receipts and finances stay on this phone. Here is exactly what runs where.</Muted>

      <Card>
        <H2>On this phone (works offline)</H2>
        <Row title="Receipt reader" body="Google ML Kit text recognition, bundled in the app. Photos are never uploaded." />
        <Row title="Kita AI · Gemini Nano" body={nanoText} />
        <Row title="Traveler translation" body="Google ML Kit on-device translation and language detection. Language packs download once, then work offline." />
        <Row title="Receipt checks, budgets, tips" body="KitaPH code: every peso is computed, never guessed by AI." />
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
        <Row title="No cloud AI, no account, no tracking" body="KitaPH sends your finances nowhere. There is no login and no analytics." />
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
