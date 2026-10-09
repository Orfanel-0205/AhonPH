import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button, Card, Chip, ErrorBox, H2, Muted, Pill, styles } from "../components";
import { hubAdvise, hubQuickLog, hubStatus, normalizeHubUrl, type HubStatus } from "../hub";
import { NANO_LABEL, phoneAdvise, phoneQuickLog } from "../nanoEngine";
import { useNano } from "../nanoStore";
import {
  basicQuickLog,
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
  type Insight,
  type ParsedRecord,
} from "../shared";
import { newId, useStore } from "../store";
import { C, S } from "../theme";

const SUGGESTIONS = ["Saan napupunta ang pera ko?", "Paano ako makakatipid sa susunod na buwan?", "Paano ako maaapektuhan ng inflation?"];

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type History = { role: "user" | "assistant"; content: string }[];

/** Where Kita's language AI runs. Every option is local: this phone, the user's own laptop, or plain code. */
interface Engine {
  id: "phone" | "hub" | "basic";
  label: string;
  icon: "phone-portrait" | "laptop" | "calculator";
  quickLog: (text: string, today: string) => Promise<Result<{ records: ParsedRecord[]; meta: string }>>;
  advise: (question: string, context: string, history: History, onText: (t: string) => void) => Promise<Result<{ text: string; meta: string }>>;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const PHONE_ENGINE: Engine = {
  id: "phone",
  label: "This phone",
  icon: "phone-portrait",
  quickLog: async (text, today) => {
    try {
      const r = await phoneQuickLog(text, today);
      return { ok: true, data: { records: r.records, meta: `On this phone · ${NANO_LABEL} · ${secs(r.ms)}` } };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  },
  advise: async (question, context, history, onText) => {
    try {
      const r = await phoneAdvise(question, context, history, onText);
      return { ok: true, data: { text: r.text, meta: `On this phone · ${NANO_LABEL} · ${secs(r.ms)}` } };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  },
};

function hubEngine(hub: string, model: string): Engine {
  return {
    id: "hub",
    label: "Laptop hub",
    icon: "laptop",
    quickLog: async (text, today) => {
      const r = await hubQuickLog(hub, text, today);
      return r.ok ? { ok: true, data: { records: r.data.records, meta: `On your laptop hub · ${r.data.meta.model} · ${secs(r.data.meta.durationMs)}` } } : r;
    },
    advise: async (question, context, history) => {
      const started = Date.now();
      const r = await hubAdvise(hub, { question, context, history });
      return r.ok ? { ok: true, data: { text: r.data, meta: `On your laptop hub · ${model} · ${secs(Date.now() - started)}` } } : r;
    },
  };
}

/** Plain code, no language model: keeps the app useful on phones without on-device AI or a hub. */
function basicEngine(insights: Insight[]): Engine {
  return {
    id: "basic",
    label: "Basic mode",
    icon: "calculator",
    quickLog: async (text, today) => ({ ok: true, data: { records: basicQuickLog(text, today), meta: "Basic mode · keyword rules, no AI" } }),
    advise: async () => ({
      ok: true,
      data: {
        text: insights.length
          ? `Ito ang mga nakita sa records mo:\n${insights.slice(0, 4).map((i) => `• ${i.title}: ${i.body}`).join("\n")}`
          : "Wala pang sapat na records. Mag-scan ng resibo o mag-log ng gastos muna.",
        meta: "Basic mode · computed findings, no AI",
      },
    }),
  };
}

export function AskScreen({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { data, update, settings, setSettings } = useStore();
  const nano = useNano();
  const today = todayISO();
  const [hubInfo, setHubInfo] = useState<HubStatus | null>(null);
  const [engineId, setEngineId] = useState<Engine["id"] | null>(null);

  useEffect(() => {
    if (settings.hubUrl) hubStatus(settings.hubUrl).then(setHubInfo);
  }, [settings.hubUrl]);

  const { context, insights } = useMemo(() => {
    const summary = summarize(data.transactions, makePeriod("last30", today));
    const budgets = budgetStatuses(summary, data.budgets);
    const insights = buildInsights(summary, budgets);
    const { base, current } = yearOnYearWindows(today);
    return { insights, context: buildAdvisorContext({ today, summary, insights, budgets, inflation: personalInflation(data.receipts, base, current) }) };
  }, [data, today]);

  const engines: Engine[] = [
    ...(nano.status === "available" ? [PHONE_ENGINE] : []),
    ...(hubInfo?.reachable && settings.hubUrl ? [hubEngine(settings.hubUrl, hubInfo.text.name)] : []),
    basicEngine(insights),
  ];
  const engine = engines.find((e) => e.id === engineId) ?? engines[0];

  const saveRecords = (records: ParsedRecord[]) =>
    update((d) => ({
      ...d,
      transactions: [
        ...records.map((r) => ({ id: newId("tx"), type: r.type, category: r.category, description: r.description, amountCentavos: r.amountCentavos, date: r.date, source: "quicklog" as const })),
        ...d.transactions,
      ],
    }));

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Kita AI</Text>
      <Muted style={{ marginBottom: S.md }}>Log in Taglish and ask about your money. The AI runs on your own devices, never in the cloud.</Muted>

      <View style={[styles.wrap, { marginBottom: S.sm }]}>
        {engines.map((e) => (
          <Chip key={e.id} label={e.label} selected={engine.id === e.id} onPress={() => setEngineId(e.id)} />
        ))}
      </View>
      {nano.status === "available" ? (
        <View style={{ marginBottom: S.md }}>
          <Pill label="Gemini Nano ready on this phone · works offline" tone="good" icon="phone-portrait" />
        </View>
      ) : (
        <Pressable onPress={onOpenSetup} accessibilityRole="button" style={{ marginBottom: S.md }}>
          <Text style={{ color: C.brandStrong, fontWeight: "600" }}>
            {nano.status === "downloadable" || nano.status === "downloading"
              ? "Set up on-device AI (one-time download) →"
              : "On-device AI isn't available on this phone. Connect a laptop hub below, or use basic mode."}
          </Text>
        </Pressable>
      )}

      <QuickLog engine={engine} onSave={saveRecords} />
      <Advisor key={engine.id} engine={engine} context={context} />
      <HubCard
        hubInfo={hubInfo}
        initialUrl={settings.hubUrl}
        onConnected={(url, info) => {
          setSettings({ hubUrl: url });
          setHubInfo(info);
        }}
      />
    </ScrollView>
  );
}

function QuickLog({ engine, onSave }: { engine: Engine; onSave: (r: ParsedRecord[]) => void }) {
  const [text, setText] = useState("");
  const [records, setRecords] = useState<ParsedRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await engine.quickLog(text, todayISO());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setRecords(r.data.records);
    setMeta(r.data.meta);
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
          {meta ? <Pill label={meta} tone="good" icon={engine.icon} /> : null}
          {records.length === 0 ? <Muted style={{ marginTop: S.sm }}>Walang nakitang halaga.</Muted> : null}
          {records.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
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
              <Pressable accessibilityLabel={`Remove ${r.description}`} onPress={() => setRecords(records.filter((_, j) => j !== i))} hitSlop={12}>
                <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {records.length ? (
            <View style={{ marginTop: S.sm }}>
              <Button
                label={`Save ${records.length}`}
                icon="checkmark"
                onPress={() => {
                  onSave(records);
                  setRecords(null);
                  setText("");
                }}
              />
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
  meta?: string;
  streaming?: boolean;
}

function Advisor({ engine, context }: { engine: Engine; context: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    const history = turns.filter((t) => !t.streaming).map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: question }, { role: "assistant", content: "", streaming: true }]);
    setQ("");
    const r = await engine.advise(question, context, history, (soFar) =>
      setTurns((t) => t.map((x, i) => (i === t.length - 1 && x.streaming ? { ...x, content: soFar } : x))),
    );
    setBusy(false);
    if (!r.ok) {
      setTurns((t) => t.filter((x) => !x.streaming));
      return setError(r.error);
    }
    const text = r.data.text;
    setTurns((t) => [
      ...t.filter((x) => !x.streaming),
      // Basic mode repeats computed findings, so there is nothing to verify.
      { role: "assistant", content: text, meta: r.data.meta, ungrounded: engine.id === "basic" ? undefined : findUngroundedNumbers(text, context) },
    ]);
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
        <View
          key={i}
          style={{
            marginBottom: S.sm,
            alignSelf: t.role === "user" ? "flex-end" : "stretch",
            backgroundColor: t.role === "user" ? C.brandSoft : C.surface2,
            borderRadius: 12,
            padding: S.md,
            maxWidth: "100%",
          }}
        >
          <Text style={{ fontSize: 14, color: C.text, lineHeight: 21 }}>{t.content ? t.content.replace(/\*\*/g, "") : "…"}</Text>
          {t.role === "assistant" && !t.streaming ? (
            <View style={{ marginTop: 6, gap: 4 }}>
              {t.meta ? <Muted>{t.meta}</Muted> : null}
              {t.ungrounded === undefined ? null : t.ungrounded.length ? (
                <Pill label={`Check these numbers: ${t.ungrounded.join(", ")}`} tone="warning" icon="warning" />
              ) : (
                <Pill label="All numbers match your records ✓" tone="good" icon="checkmark-circle" />
              )}
            </View>
          ) : null}
        </View>
      ))}
      {error ? <ErrorBox message={error} /> : null}
      <TextInput value={q} onChangeText={setQ} placeholder="Itanong sa Taglish…" style={[styles.input, { marginTop: S.sm }]} onSubmitEditing={() => ask(q)} accessibilityLabel="Question" />
      <View style={{ marginTop: S.sm }}>
        <Button label="Ask" icon="send" onPress={() => ask(q)} busy={busy} disabled={!q.trim()} />
      </View>
      <Muted style={{ marginTop: S.sm }}>Estimates only, not professional financial advice. Every number Kita uses is computed on this phone from your records.</Muted>
    </Card>
  );
}

function HubCard({ hubInfo, onConnected, initialUrl }: { hubInfo: HubStatus | null; onConnected: (url: string, info: HubStatus) => void; initialUrl: string }) {
  const [open, setOpen] = useState(Boolean(initialUrl));
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function connect() {
    const url = normalizeHubUrl(urlInput);
    if (!url) return;
    setChecking(true);
    setFailed(false);
    const s = await hubStatus(url);
    setChecking(false);
    if (s?.reachable) onConnected(url, s);
    else setFailed(true);
  }

  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <H2>Laptop hub (optional)</H2>
        <Text style={{ color: C.brandStrong, fontWeight: "600" }}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {hubInfo?.reachable ? <Pill label={`Connected · ${hubInfo.text.name} on ${hubInfo.text.processor}`} tone="good" icon="laptop" /> : null}
      {open ? (
        <View style={{ marginTop: S.sm, gap: S.sm }}>
          <Muted>A bigger model (Gemma 3 4B) on your own laptop, over local Wi-Fi. Still no internet or cloud.</Muted>
          <TextInput value={urlInput} onChangeText={setUrlInput} placeholder="192.168.1.20:3000" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} accessibilityLabel="Hub address" />
          <Button label="Connect" icon="wifi" variant="secondary" onPress={connect} busy={checking} />
          {failed ? <Pill label="Can't reach the hub. Same Wi-Fi?" tone="warning" icon="warning" /> : null}
        </View>
      ) : null}
    </Card>
  );
}
