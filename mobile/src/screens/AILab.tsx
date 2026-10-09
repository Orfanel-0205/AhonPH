import { Ionicons } from "@expo/vector-icons";
import { useNetworkState } from "expo-network";
import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Image, Text, TextInput, View } from "react-native";
import { Button, Card, Chip, H2, Muted, Pill, styles } from "../components";
import { phoneQuickLog, phoneRead, phoneReadMenu, phoneSplit, phoneTranslate, phoneTripTips } from "../nanoEngine";
import { normalizeHubUrl } from "../hub";
import { refreshHubAI, useHubAI, useLocalAI } from "../localAI";
import { useNano } from "../nanoStore";
import { recognizeText } from "../native";
import { appNetworkBytes, demoImage, detectLanguage, downloadedLanguages, translateTexts, TRAVELER_LANGUAGES } from "../onDevice";
import { applyCurrency, combineSplit, containsNote, convertToPhp, formatCurrency, lookupDish, ruleSplit, splitBill, formatPeso, linesToRows, parseForeignReceipt, roundToPeso, sampleTrip, todayISO, tripFacts, tripStatus } from "../shared";
import { listen, offlineSpeechLanguages, speak, THEM_LANGS } from "../speech";
import { useStore } from "../store";
import { C, S } from "../theme";

/** A sample receipt bundled in the app (invented store, made for this demo). */
const DEMO_RECEIPT = "demo-receipt-ja.png";
const STAFF_LINE = "お会計はレジでお願いします。カードも使えます。";
const MY_LINE = "Can I pay by card?";
const SPENDING = "taxi 2300 yen, ramen 980";

type StepId = "ocr" | "parse" | "names" | "lang" | "translate" | "say" | "log" | "split" | "tip" | "voice";
type Status = "waiting" | "running" | "done" | "skipped" | "failed";
interface StepView {
  status: Status;
  ms?: number;
  lines: string[];
  note?: string;
}

const STEPS: { id: StepId; title: string; engine: string }[] = [
  { id: "ocr", title: "Read a Japanese receipt photo", engine: "ML Kit Text Recognition · Japanese model" },
  { id: "parse", title: "Itemize it and check the math", engine: "LakbayMate code · unit-tested" },
  { id: "names", title: "Name each item in English", engine: "Hand-checked dish list, then {AI}" },
  { id: "lang", title: "Detect the language staff wrote", engine: "ML Kit Language ID" },
  { id: "translate", title: "Understand what staff said", engine: "ML Kit Translation, then {AI}" },
  { id: "say", title: "Answer like a local", engine: "{AI} + code check + back-translation" },
  { id: "log", title: "Understand spending, no receipt", engine: "{AI} + code check" },
  { id: "split", title: "Split the bill from one sentence", engine: "Rules + {AI} read it, checked against each other · code computes" },
  { id: "tip", title: "Budget tip with checked numbers", engine: "{AI} + code check" },
  { id: "voice", title: "Say the answer out loud", engine: "Android text-to-speech · offline voice" },
];

const ICON: Record<Status, { name: ComponentProps<typeof Ionicons>["name"]; color: string }> = {
  waiting: { name: "ellipse-outline", color: C.border },
  running: { name: "ellipse-outline", color: C.brand },
  done: { name: "checkmark-circle", color: C.good },
  skipped: { name: "remove-circle-outline", color: C.muted },
  failed: { name: "close-circle", color: C.danger },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * One button runs every on-device model in turn on bundled sample input, with live timings, and then
 * reports how many bytes this app actually sent or received meanwhile (Android TrafficStats).
 */
export function OfflineAIDemo() {
  const ai = useLocalAI();
  const net = useNetworkState();
  const [views, setViews] = useState<Partial<Record<StepId, StepView>>>({});
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ ms: number; done: number; offline: boolean; bytes: { sent: number; received: number } | null } | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const offline = net.isConnected === false || net.isInternetReachable === false;

  useEffect(() => {
    demoImage(DEMO_RECEIPT)
      .then(setReceiptUri)
      .catch(() => setReceiptUri(null));
  }, []);

  const set = (id: StepId, v: StepView) => setViews((prev) => ({ ...prev, [id]: v }));

  async function step(id: StepId, fn: (update: (lines: string[]) => void) => Promise<{ lines: string[]; note?: string; skipped?: boolean }>) {
    set(id, { status: "running", lines: [] });
    const started = Date.now();
    try {
      const r = await fn((lines) => set(id, { status: "running", lines, ms: Date.now() - started }));
      set(id, { status: r.skipped ? "skipped" : "done", ms: r.skipped ? undefined : Date.now() - started, lines: r.lines, note: r.note });
      return !r.skipped;
    } catch (e) {
      set(id, { status: "failed", ms: Date.now() - started, lines: [], note: errText(e) });
      return false;
    }
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setSummary(null);
    setViews(Object.fromEntries(STEPS.map((s): [StepId, StepView] => [s.id, { status: "waiting", lines: [] }])));
    const startOffline = offline;
    const before = appNetworkBytes();
    const t0 = Date.now();
    const hasNano = ai.available;
    const aiName = ai.name;
    const noNano = { lines: [], skipped: true, note: "No local AI model here (no Gemini Nano, no team laptop); LakbayMate falls back to ML Kit, the phrasebook and code." };
    const packs = await downloadedLanguages();
    let ok = 0;
    let rows: string[] = [];
    let itemNames: string[] = [];
    let jaAnswer = "";
    let itemTotals: number[] = [];
    let receiptTotal = 0;
    let english: Map<number, { name: string; note: string }> = new Map();

    if (
      await step("ocr", async () => {
        const uri = receiptUri ?? (await demoImage(DEMO_RECEIPT));
        const r = await recognizeText(uri, "japanese");
        rows = linesToRows(r.lines);
        return { lines: [`${rows.length} lines read`, ...rows.slice(0, 3).map((l) => `“${l}”`), "…"] };
      })
    )
      ok++;

    if (
      await step("parse", async () => {
        const r = parseForeignReceipt(rows, { wholeNumbers: true });
        if (!r) throw new Error("No receipt found in the text.");
        itemNames = r.items.map((i) => i.name);
        itemTotals = r.items.map((i) => i.total);
        const total = r.total ?? r.subtotal ?? 0;
        receiptTotal = total;
        return {
          lines: [
            `${r.items.length} items: ${r.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}`,
            r.check.status === "ok"
              ? `✓ Items add up to the ${r.check.against} ${formatCurrency(r.check.printed ?? 0, "JPY")}`
              : `⚠ Items add up to ${formatCurrency(r.check.itemsSum, "JPY")}, receipt says ${formatCurrency(r.check.printed ?? 0, "JPY")}`,
            `Total ${formatCurrency(total, "JPY")} ≈ ${formatPeso(roundToPeso(convertToPhp(total, "JPY")))}${r.tax !== null ? ` · tax ${formatCurrency(r.tax, "JPY")}` : ""}`,
            ...(r.totalRead !== undefined
              ? [`🔧 The camera read the total as ${formatCurrency(r.totalRead, "JPY")} (¥ seen as a digit); corrected because ${formatCurrency(total, "JPY")} = subtotal + tax.`]
              : []),
          ],
          note: "Every yen and peso here is computed by code, never by the AI.",
        };
      })
    )
      ok++;

    if (
      await step("names", async (update) => {
        if (!itemNames.length) throw new Error("No items to name.");
        // Known dishes come from the hand-checked list (facts, instant); the AI names only the rest.
        const known = new Map<number, { name: string; note: string; checked?: boolean }>();
        itemNames.forEach((n, i) => {
          const d = lookupDish(n);
          if (d) known.set(i, { name: d.en, note: containsNote(d), checked: true });
        });
        const unknown = itemNames.map((_, i) => i).filter((i) => !known.has(i));
        const show = (m: Map<number, { name: string; note: string; checked?: boolean }>) =>
          itemNames.flatMap((n, i) => (m.get(i) ? [`${m.get(i)!.checked ? "✓" : "✨"} ${n} → ${m.get(i)!.name}${m.get(i)!.checked && m.get(i)!.note ? ` (${m.get(i)!.note.replace(/^Contains: /, "").replace(/\.$/, "")})` : ""}`] : []));
        english = new Map(known);
        if (unknown.length && hasNano) {
          const r = await phoneReadMenu(unknown.map((i) => itemNames[i]), "ja", (m) => {
            const all = new Map(known);
            m.forEach((v, j) => all.set(unknown[j], v));
            update(show(all));
          });
          r.readings.forEach((v, j) => english.set(unknown[j], v));
        }
        return {
          lines: show(english),
          note: `✓ ${known.size} from the hand-checked list (what they contain is a fact) · ✨ ${english.size - known.size} named by ${aiName}.`,
        };
      })
    )
      ok++;

    if (
      await step("lang", async () => {
        const code = await detectLanguage(STAFF_LINE);
        return { lines: [`“${STAFF_LINE}”`, `→ ${code === "ja" ? "Japanese (ja)" : code}`] };
      })
    )
      ok++;

    if (
      await step("translate", async (update) => {
        if (!packs.includes("ja")) throw new Error("The Japanese pack isn't on this phone yet. Download it once in Offline AI setup.");
        const r = await translateTexts([STAFF_LINE], "ja", "en");
        const quick = `ML Kit, ${r.ms} ms: ${r.texts[0]}`;
        if (!hasNano) return { lines: [quick] };
        // The word-for-word offline translator is instant; Gemini Nano then reads it the way a person would.
        update([quick, `✨ ${aiName} is reading it…`]);
        const t = Date.now();
        const natural = await phoneRead(STAFF_LINE, "ja", "restaurant");
        return {
          lines: [quick, natural ? `✨ ${aiName}, ${((Date.now() - t) / 1000).toFixed(1)} s: ${natural}` : `✨ ${aiName}'s reading failed the check; ML Kit's stays.`],
          note: natural ? "Checked: plain English, every number kept." : undefined,
        };
      })
    )
      ok++;

    await sleep(600);
    if (
      await step("say", async () => {
        let note = "✓ Code check: Japanese script, every number kept, no chatter.";
        let ja = hasNano ? await phoneTranslate(MY_LINE, "ja", "restaurant") : null;
        if (!ja) {
          if (!packs.includes("ja")) return hasNano ? { lines: [], note: `${aiName}'s answer failed the check and no Japanese pack is installed.`, skipped: true } : noNano;
          ja = (await translateTexts([MY_LINE], "en", "ja")).texts[0];
          note = hasNano ? `${aiName}'s answer failed the check, so ML Kit translated it.` : "Translated by ML Kit (no local AI model here).";
        }
        jaAnswer = ja;
        const back = packs.includes("ja") ? (await translateTexts([ja], "ja", "en")).texts[0] : null;
        return { lines: [`“${MY_LINE}” → ${ja}`, ...(back ? [`Means: ${back}`] : [])], note };
      })
    )
      ok++;

    await sleep(600);
    if (
      await step("log", async () => {
        if (!hasNano) return noNano;
        const r = await phoneQuickLog(SPENDING, todayISO());
        const recs = applyCurrency(r.records, SPENDING, "JPY");
        if (!recs.length) throw new Error(`${aiName} found no spending in the sentence.`);
        return {
          lines: [`“${SPENDING}”`, ...recs.map((x) => `${x.description} → −${formatPeso(roundToPeso(x.amountCentavos))}`)],
          note: "Amounts are checked against what was typed. Not saved.",
        };
      })
    )
      ok++;

    await sleep(600);
    if (
      await step("split", async () => {
        if (!itemNames.length) throw new Error("No receipt items to split.");
        const people = ["Ako", "Maria", "Jun"];
        // The harder sentence: one beer each for two people. Rules and AI read it independently.
        const said = "Kay Maria ang karaage at isang beer, kay Jun ang yakitori at isang beer, hati kaming lahat sa edamame, akin ang oyakodon.";
        const labels = itemNames.map((n, i) => (english.get(i) ? `${n} (${english.get(i)!.name})` : n));
        const aliases = itemNames.map((n, i) => {
          const d = lookupDish(n);
          return [n, ...(english.get(i) ? [english.get(i)!.name] : []), ...(d ? [d.en, ...d.say] : [])];
        });
        const rule = ruleSplit(said, aliases, people);
        const aiShares = hasNano ? (await phoneSplit(labels, people, said)).shares : null;
        const combined = combineSplit(rule, aiShares);
        const r = { shares: combined.shares };
        const mark = { agree: "✓", rules: "rules", ai: "AI", conflict: "⚠ AI differed, rules kept", unmentioned: "" } as const;
        const split = splitBill(itemTotals, r.shares, people.length, receiptTotal, 0);
        return {
          lines: [
            `“${said}”`,
            // Who got what, so anyone watching can check the AI's assignment, then what each person pays.
            ...itemNames.map((n, i) => `${english.get(i)?.name ?? n} → ${r.shares[i]?.length ? r.shares[i].map((k) => people[k]).join(", ") : "everyone"} ${mark[combined.source[i]]}`.trim()),
            ...people.map((p, i) => `${p} pays ${formatCurrency(split.amounts[i], "JPY")} ≈ ${formatPeso(roundToPeso(convertToPhp(split.amounts[i], "JPY")))}`),
          ],
          note: `${aiShares ? `✓ Rules and ${aiName} agree on ${combined.source.filter((x) => x === "agree").length} of ${itemNames.length}` : "Read by the rules (no AI model here)"}${combined.source.includes("conflict") ? `; ⚠ ${combined.source.filter((x) => x === "conflict").length} disagreement flagged` : ""}. Only names on the list count. Shares add up to ${formatCurrency(receiptTotal, "JPY")} exactly, computed by code.`,
        };
      })
    )
      ok++;

    await sleep(600);
    if (
      await step("tip", async () => {
        if (!hasNano) return noNano;
        const sample = sampleTrip(todayISO());
        // Always the labelled sample trip, so the demo is the same on every run and never touches your data.
        const facts = tripFacts(sample.plan, tripStatus(sample.plan, sample.transactions, todayISO()));
        const r = await phoneTripTips(facts);
        return {
          lines: r.tips.length ? r.tips : ["(no tip passed the check this time)"],
          note: `${r.dropped ? `✓ Code check dropped ${r.dropped} tip${r.dropped === 1 ? "" : "s"} that used an amount not in the facts.` : "✓ Code check: every amount in the tips is in the computed facts."} Sample Tokyo trip, not saved.`,
        };
      })
    )
      ok++;

    if (
      await step("voice", async () => {
        const text = jaAnswer || "カードで払えますか？";
        speak(text, "ja");
        return { lines: [`🔊 ${text}`], note: "Spoken with the phone's offline Japanese voice." };
      })
    )
      ok++;

    const after = appNetworkBytes();
    setSummary({
      ms: Date.now() - t0,
      done: ok,
      offline: startOffline,
      bytes: before && after ? { sent: after.sent - before.sent, received: after.received - before.received } : null,
    });
    setRunning(false);
  }

  return (
    <Card style={{ borderColor: offline ? C.good : C.border, borderWidth: offline ? 2 : 1 }}>
      <H2>Offline AI, live</H2>
      <Pill
        label={offline ? "Offline right now · everything below runs on this phone" : "Online now · turn on airplane mode (Wi-Fi off too), then run it"}
        tone={offline ? "good" : "info"}
        icon={offline ? "airplane" : "wifi"}
      />
      <Muted style={{ marginTop: S.sm }}>
        Ten AI steps on a sample receipt and a short conversation: reading, checking, translating, writing, speaking. Timings are measured on this phone as they run.
      </Muted>
      <View style={{ marginTop: S.md }}>
        <Button label={running ? "Running on this phone…" : summary ? "Run again" : "▶  Run the offline AI demo"} icon="flash" onPress={run} busy={running} />
      </View>

      {Object.keys(views).length ? (
        <View style={{ marginTop: S.md }}>
          {receiptUri ? (
            <View style={{ flexDirection: "row", gap: S.md, alignItems: "center", marginBottom: S.sm }}>
              <Image source={{ uri: receiptUri }} style={{ width: 70, height: 118, borderRadius: 6, backgroundColor: C.surface2 }} resizeMode="cover" />
              <Muted style={{ flex: 1 }}>Sample receipt bundled in the app (invented store, made for this demo). The photo never leaves the phone.</Muted>
            </View>
          ) : null}
          {STEPS.map((s, i) => {
            const v = views[s.id] ?? { status: "waiting" as Status, lines: [] };
            return (
              <View key={s.id} style={{ flexDirection: "row", gap: S.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.surface2 }}>
                <View style={{ width: 24, alignItems: "center", paddingTop: 1 }}>
                  {v.status === "running" ? <ActivityIndicator size="small" color={C.brand} /> : <Ionicons name={ICON[v.status].name} size={20} color={ICON[v.status].color} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: S.sm }}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: v.status === "waiting" ? C.muted : C.text }}>
                      {i + 1}. {s.title}
                    </Text>
                    {v.ms !== undefined ? (
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.brandStrong, fontVariant: ["tabular-nums"] }}>{v.ms < 1000 ? `${v.ms} ms` : `${(v.ms / 1000).toFixed(1)} s`}</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: C.muted }}>{s.engine.replace("{AI}", ai.kind === "hub" ? `${ai.name} (team laptop)` : "Gemini Nano (Android AICore)")}</Text>
                  {v.lines.map((l, j) => (
                    <Text key={j} style={{ fontSize: 14, color: C.text, marginTop: 2 }}>
                      {l}
                    </Text>
                  ))}
                  {v.note ? <Text style={{ fontSize: 12, color: v.status === "failed" ? C.danger : C.good, marginTop: 2 }}>{v.note}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {summary ? (
        <View style={{ marginTop: S.sm, padding: S.md, borderRadius: 12, backgroundColor: summary.offline ? C.goodSoft : C.surface2, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: C.text }}>
            {summary.done} of {STEPS.length} AI steps ran on this phone in {(summary.ms / 1000).toFixed(1)} s
          </Text>
          <Text style={{ fontSize: 14, color: C.text }}>
            {summary.offline ? "✈️ Started in airplane mode / offline." : "Started online. Run it again in airplane mode to prove it."}
          </Text>
          {summary.bytes ? (
            <Text style={{ fontSize: 14, color: C.text }}>
              Network used by LakbayMate meanwhile: {summary.bytes.sent.toLocaleString()} bytes sent · {summary.bytes.received.toLocaleString()} bytes received
            </Text>
          ) : null}
          <Muted>
            Measured by Android (TrafficStats) for this app.{" "}
            {ai.kind === "hub"
              ? `${ai.name} answered on your laptop over local Wi-Fi, so that local traffic is counted above; nothing went to the internet.`
              : "Gemini Nano runs in Android's AICore on this phone."}
          </Muted>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Team laptop AI: a phone without Gemini Nano (or any teammate's phone) borrows the laptop's model over
 * the laptop's hotspot or the same Wi-Fi. No internet; the same prompts and checks.
 */
export function TeamLaptopAI() {
  const { settings, setSettings } = useStore();
  const hub = useHubAI();
  const nano = useNano();
  const [address, setAddress] = useState(settings.hubUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function connect() {
    const url = normalizeHubUrl(address);
    if (!url) return;
    setBusy(true);
    setMsg(null);
    const ok = await refreshHubAI(url);
    setBusy(false);
    if (ok) setSettings({ hubUrl: url });
    else setMsg("Can't reach the laptop. Join its hotspot (or the same Wi-Fi), start the hub, and check the address it shows.");
  }

  return (
    <Card>
      <H2>Team laptop AI</H2>
      <Muted style={{ marginBottom: S.sm }}>
        No Gemini Nano on your phone? Join the team laptop&apos;s hotspot and connect. Every AI feature then runs on the laptop&apos;s own model, with the same
        checks. No internet is used.
      </Muted>
      <Pill
        label={hub.reachable ? `Connected · ${hub.model ?? "laptop model"} at ${hub.url?.replace(/^https?:\/\//, "")}` : "Not connected"}
        tone={hub.reachable ? "good" : "info"}
        icon={hub.reachable ? "laptop" : "laptop-outline"}
      />
      <View style={{ flexDirection: "row", gap: S.sm, marginTop: S.sm, alignItems: "center" }}>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="192.168.137.1:3000"
          autoCapitalize="none"
          keyboardType="url"
          style={[styles.input, { flex: 1 }]}
          accessibilityLabel="Laptop hub address"
        />
        <View style={{ width: 120 }}>
          <Button label="Connect" icon="link" variant="secondary" onPress={connect} busy={busy} />
        </View>
      </View>
      {msg ? <Text style={{ fontSize: 13, color: C.danger, marginTop: 4 }}>{msg}</Text> : null}
      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text, marginTop: S.md, marginBottom: S.xs }}>Which AI answers</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.sm }}>
        <Chip label={nano.status === "available" ? "Auto · Gemini Nano first" : "Auto"} selected={settings.aiEngine === "auto"} onPress={() => setSettings({ aiEngine: "auto" })} />
        <Chip label="Team laptop" selected={settings.aiEngine === "laptop"} onPress={() => setSettings({ aiEngine: "laptop" })} />
      </View>
    </Card>
  );
}

/** What AI is on this phone right now, and whether each part works offline. */
export function OnPhoneModels({ onOpenSetup }: { onOpenSetup: () => void }) {
  const nano = useNano();
  const [packs, setPacks] = useState<string[]>([]);
  const [speech, setSpeech] = useState<string[]>([]);
  useEffect(() => {
    downloadedLanguages().then(setPacks);
    offlineSpeechLanguages().then(setSpeech);
  }, []);
  const OTHER: Record<string, string> = { de: "Deutsch", fr: "Français", it: "Italiano", tl: "Filipino" };
  const label = (codes: string[], list: { code: string; label: string }[]) => codes.map((c) => list.find((l) => l.code === c)?.label ?? OTHER[c] ?? c).join(", ");
  const rows: { title: string; use: string; status: string; ok: boolean }[] = [
    {
      title: "Gemini Nano",
      use: "Writes natural Japanese/Korean/Chinese, reads menus, logs spending, words budget tips",
      status:
        nano.status === "available"
          ? `Ready${nano.info?.baseModel ? ` (${nano.info.baseModel})` : ""} · built into Android`
          : nano.status === "unavailable"
            ? "Not on this phone · ML Kit and code take over"
            : "One-time download needed",
      ok: nano.status === "available",
    },
    { title: "ML Kit Text Recognition", use: "Reads menus, signs and receipts", status: "Latin, Japanese, Korean, Chinese · bundled in the app", ok: true },
    {
      title: "ML Kit Translation",
      use: "Translates and checks meaning (back-translation)",
      status: `Offline packs: English${packs.filter((c) => c !== "en").length ? `, ${label(packs.filter((c) => c !== "en"), [{ code: "tl", label: "Filipino" }, ...TRAVELER_LANGUAGES])}` : ""}`,
      ok: packs.length > 1,
    },
    { title: "ML Kit Language ID", use: "Knows what language you're looking at", status: "Bundled in the app", ok: true },
    { title: "Speech recognition", use: "Hears the other person", status: speech.length ? `Offline: ${label(speech, THEM_LANGS)}` : "No offline language installed yet", ok: speech.length > 0 },
    { title: "Text-to-speech", use: "Says your answer aloud", status: "Android's offline voices", ok: true },
  ];
  return (
    <Card>
      <H2>AI on this phone</H2>
      {rows.map((r) => (
        <View key={r.title} style={{ flexDirection: "row", gap: S.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
          <Ionicons name={r.ok ? "checkmark-circle" : "alert-circle-outline"} size={20} color={r.ok ? C.good : C.warn} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{r.title}</Text>
            <Text style={{ fontSize: 13, color: C.text }}>{r.use}</Text>
            <Muted>{r.status}</Muted>
          </View>
        </View>
      ))}
      <SpeechTry languages={speech} />
      <View style={{ marginTop: S.md }}>
        <Button label="Offline AI setup" icon="construct" variant="secondary" onPress={onOpenSetup} />
      </View>
    </Card>
  );
}

/** Live, on-device speech recognition with a timing, for showing it to someone. */
function SpeechTry({ languages }: { languages: string[] }) {
  const [lang, setLang] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choice = lang ?? (languages.includes("en") ? "en" : languages[0]) ?? null;
  if (!languages.length) return null;

  async function go() {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    setMs(null);
    const started = Date.now();
    try {
      const session = await listen(choice, setText);
      const heard = await session.done;
      setText(heard);
      setMs(Date.now() - started);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ marginTop: S.md }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: C.text, marginBottom: S.xs }}>Try speech recognition (on this phone)</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginBottom: S.sm }}>
        {languages.map((c) => (
          <Chip key={c} label={THEM_LANGS.find((l) => l.code === c)?.label ?? (c === "de" ? "Deutsch" : c)} selected={choice === c} onPress={() => setLang(c)} />
        ))}
      </View>
      <Button label={busy ? "Listening… speak now" : "🎤  Listen"} variant="secondary" onPress={go} busy={busy} />
      {text ? <Text style={{ fontSize: 16, color: C.text, marginTop: S.sm }}>“{text}”</Text> : null}
      {ms !== null ? <Muted>Heard on this phone, {(ms / 1000).toFixed(1)} s including the time you spoke.</Muted> : null}
      {error ? <Text style={{ fontSize: 13, color: C.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}
