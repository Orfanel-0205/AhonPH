import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Button, Card, Chip, ErrorBox, H2, Muted, Pill, styles } from "../components";
import { hubAdvise, hubQuickLog, hubStatus, normalizeHubUrl, type HubStatus } from "../hub";
import {
  budgetStatuses,
  buildAdvisorContext,
  buildInsights,
  categoryLabel,
  findUngroundedNumbers,
  formatPeso,
  makePeriod,
  personalInflation,
  summarize,
  todayISO,
  yearOnYearWindows,
  type ParsedRecord,
} from "../shared";
import { newId, useStore } from "../store";
import { C, S } from "../theme";

const SUGGESTIONS = ["Saan napupunta ang pera ko?", "Paano ako makakatipid sa susunod na buwan?", "Paano ako maaapektuhan ng inflation?"];

export function AskScreen() {
  const { data, update, settings, setSettings } = useStore();
  const [urlInput, setUrlInput] = useState(settings.hubUrl);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const hub = settings.hubUrl;

  async function connect(raw = urlInput) {
    const url = normalizeHubUrl(raw);
    if (!url) return;
    setChecking(true);
    const s = await hubStatus(url);
    setStatus(s);
    setChecking(false);
    if (s?.reachable) setSettings({ hubUrl: url });
  }

  useEffect(() => {
    if (settings.hubUrl) connect(settings.hubUrl);
    // Only on first open; later checks are manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = Boolean(status?.reachable && hub);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Kita AI</Text>
      <Muted style={{ marginBottom: S.md }}>
        Taglish logging and advice use a bigger model on your own laptop (the KitaPH Hub), over local Wi-Fi. No internet needed.
      </Muted>

      <Card>
        <H2>KitaPH Hub</H2>
        <View style={[styles.row, { marginBottom: S.sm }]}>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="192.168.1.20:3000"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Hub address"
          />
        </View>
        <Button label="Connect" icon="wifi" variant="secondary" onPress={() => connect()} busy={checking} />
        <View style={{ marginTop: S.sm }}>
          {connected ? (
            <Pill label={`Connected · ${status!.text.name} on ${status!.text.processor}`} tone="good" icon="checkmark-circle" />
          ) : status === null && !checking && urlInput ? (
            <Pill label="Not connected" tone="warning" icon="warning" />
          ) : null}
        </View>
        <Muted style={{ marginTop: S.sm }}>On the laptop run the hub, then type the address it shows under “Network”.</Muted>
      </Card>

      {connected ? (
        <>
          <QuickLog hub={hub} onSave={(records) =>
            update((d) => ({
              ...d,
              transactions: [
                ...records.map((r) => ({ id: newId("tx"), type: r.type, category: r.category, description: r.description, amountCentavos: r.amountCentavos, date: r.date, source: "quicklog" as const })),
                ...d.transactions,
              ],
            }))
          } />
          <Advisor hub={hub} data={data} />
        </>
      ) : null}
    </ScrollView>
  );
}

function QuickLog({ hub, onSave }: { hub: string; onSave: (r: ParsedRecord[]) => void }) {
  const [text, setText] = useState("");
  const [records, setRecords] = useState<ParsedRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await hubQuickLog(hub, text, todayISO());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setRecords(r.data.records);
    setMeta(`${r.data.meta.model} · ${r.data.meta.processor} · ${(r.data.meta.durationMs / 1000).toFixed(1)}s`);
  }

  return (
    <Card>
      <H2>Mag-log sa Taglish</H2>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="jeep 26, lunch 95, load 50"
        multiline
        style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
        accessibilityLabel="What did you spend or receive?"
      />
      <View style={{ marginTop: S.sm }}>
        <Button label="Basahin" icon="sparkles" onPress={run} busy={busy} disabled={!text.trim()} />
      </View>
      {error ? <View style={{ marginTop: S.sm }}><ErrorBox message={error} /></View> : null}
      {records ? (
        <View style={{ marginTop: S.md }}>
          {meta ? <Pill label={`Ran on your hub · ${meta}`} tone="good" icon="laptop" /> : null}
          {records.length === 0 ? <Muted style={{ marginTop: S.sm }}>Walang nakitang halaga.</Muted> : null}
          {records.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: C.text }}>{r.description}</Text>
                <Muted>
                  {r.type === "income" ? "Kita" : "Gastos"} · {categoryLabel(r.category)}
                  {r.amountVerified ? "" : " · ⚠ check amount"}
                </Muted>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: r.type === "income" ? C.good : C.text }}>
                {r.type === "income" ? "+" : "-"}
                {formatPeso(r.amountCentavos)}
              </Text>
            </View>
          ))}
          {records.length ? (
            <View style={{ marginTop: S.sm }}>
              <Button label={`Save ${records.length}`} icon="checkmark" onPress={() => { onSave(records); setRecords(null); setText(""); }} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  ungrounded?: string[];
}

function Advisor({ hub, data }: { hub: string; data: ReturnType<typeof useStore>["data"] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();

  const context = useMemo(() => {
    const summary = summarize(data.transactions, makePeriod("last30", today));
    const budgets = budgetStatuses(summary, data.budgets);
    const { base, current } = yearOnYearWindows(today);
    return buildAdvisorContext({ today, summary, insights: buildInsights(summary, budgets), budgets, inflation: personalInflation(data.receipts, base, current) });
  }, [data, today]);

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: question }]);
    setQ("");
    const r = await hubAdvise(hub, { question, context, history });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setTurns((t) => [...t, { role: "assistant", content: r.data, ungrounded: findUngroundedNumbers(r.data, context) }]);
  }

  return (
    <Card>
      <H2>Tanong kay Kita</H2>
      <View style={[styles.wrap, { marginBottom: S.sm }]}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} onPress={() => ask(s)} />
        ))}
      </View>
      {turns.map((t, i) => (
        <View key={i} style={{ marginBottom: S.sm, alignSelf: t.role === "user" ? "flex-end" : "stretch", backgroundColor: t.role === "user" ? C.brandSoft : C.surface2, borderRadius: 12, padding: S.md, maxWidth: "100%" }}>
          <Text style={{ fontSize: 14, color: C.text, lineHeight: 21 }}>{t.content.replace(/\*\*/g, "")}</Text>
          {t.role === "assistant" ? (
            <View style={{ marginTop: 6 }}>
              {t.ungrounded && t.ungrounded.length ? (
                <Pill label={`Check these numbers: ${t.ungrounded.join(", ")}`} tone="warning" icon="warning" />
              ) : (
                <Pill label="All numbers match your records ✓" tone="good" icon="checkmark-circle" />
              )}
            </View>
          ) : null}
        </View>
      ))}
      {error ? <ErrorBox message={error} /> : null}
      <View style={[styles.row, { marginTop: S.sm }]}>
        <TextInput value={q} onChangeText={setQ} placeholder="Itanong sa Taglish…" style={[styles.input, { flex: 1 }]} onSubmitEditing={() => ask(q)} accessibilityLabel="Question" />
      </View>
      <View style={{ marginTop: S.sm }}>
        <Button label="Ask" icon="send" onPress={() => ask(q)} busy={busy} disabled={!q.trim()} />
      </View>
      <Muted style={{ marginTop: S.sm }}>Estimates only, not professional financial advice. The numbers Kita uses are computed on this phone from your records.</Muted>
    </Card>
  );
}
