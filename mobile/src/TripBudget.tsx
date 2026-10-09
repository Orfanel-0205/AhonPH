import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Chip, H2, InsightCard, Muted, Pill, styles } from "./components";
import { phoneTripTips } from "./nanoEngine";
import { useLocalAI } from "./localAI";
import { translateTexts } from "./onDevice";
import {
  acceptTripTips,
  addDays,
  convertFromPhp,
  formatCurrency,
  formatTripPeso as formatPeso,
  FX,
  inBoth,
  sampleTrip,
  todayISO,
  tripFacts,
  tripStatus,
  tripTips,
  type CurrencyCode,
  type TripPlan,
} from "./shared";
import { useStore } from "./store";
import { C, S } from "./theme";

const STATE_COLOR = { ok: C.good, near: C.warn, over: C.danger } as const;
const isSampleTx = (id: string) => id.startsWith("sample-trip-");

/**
 * Trip budget: updates the moment anything is logged (Scan, voice, or typed), in pesos and the local
 * currency. Tips are computed by code; Gemini Nano can word extra tips, and any amount it uses that
 * is not in the computed facts gets the tip dropped.
 */
export function TripCard({ compact }: { compact?: boolean }) {
  const { data, settings, setSettings, update } = useStore();
  const ai = useLocalAI();
  const [editing, setEditing] = useState(false);
  const [aiTips, setAiTips] = useState<{ tips: string[]; dropped: number; ms: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const today = todayISO();
  const plan = settings.trip;
  const status = useMemo(() => (plan ? tripStatus(plan, data.transactions, today) : null), [plan, data.transactions, today]);
  const tips = useMemo(() => (plan && status ? tripTips(plan, status) : []), [plan, status]);
  const isSample = data.transactions.some((t) => isSampleTx(t.id));

  // New spending makes the AI's tips stale; the code tips above update on their own.
  useEffect(() => setAiTips(null), [status?.spentCentavos]);

  function startSample() {
    const s = sampleTrip(today);
    update((d) => ({ ...d, transactions: [...s.transactions, ...d.transactions.filter((t) => !isSampleTx(t.id))] }));
    setSettings({ trip: s.plan, tripCurrency: s.plan.currency });
  }

  async function askNano() {
    if (!plan || !status) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const facts = tripFacts(plan, status);
      const r = await phoneTripTips(facts);
      if (settings.meLang === "tl" && r.tips.length) {
        // Translated on the phone, then checked again: a tip whose amounts changed stays in English.
        const t = (await translateTexts(r.tips, "en", "tl")).texts;
        r.tips = r.tips.map((en, i) => (t[i] && acceptTripTips(t[i], facts).tips.length ? t[i] : en));
      }
      setAiTips(r);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  if (!plan || !status) {
    if (compact) return null;
    return (
      <Card>
        <H2>✈️ Trip budget</H2>
        <Muted style={{ marginBottom: S.md }}>
          Set a budget for your trip. Everything you scan, say or type is counted right away, in pesos and the local currency, with tips. All on this phone.
        </Muted>
        <View style={{ gap: S.sm }}>
          <Button label="Set a trip budget" icon="airplane" onPress={() => setEditing(true)} />
          <Button label="Try a sample trip (Tokyo, day 3 of 5)" icon="flask" variant="secondary" onPress={startSample} />
        </View>
        <TripSetup open={editing} plan={null} onClose={() => setEditing(false)} />
      </Card>
    );
  }

  const color = STATE_COLOR[status.state];
  const local = (c: number) => formatCurrency(convertFromPhp(Math.abs(c), plan.currency), plan.currency);
  const overToday = status.phase === "during" && status.todayLeftCentavos < 0;

  return (
    <Card>
      <View style={[styles.row, { justifyContent: "space-between", marginBottom: S.sm }]}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: C.text, flex: 1 }} numberOfLines={1}>
          ✈️ {plan.name}
          <Text style={{ fontWeight: "600", color: C.muted }}>
            {" "}
            · {status.phase === "during" ? `Day ${status.day} of ${status.days}` : status.phase === "before" ? `starts ${plan.start}` : "trip ended"}
          </Text>
        </Text>
        {isSample ? <Pill label="Sample" tone="info" /> : null}
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit trip budget" hitSlop={10} style={{ marginLeft: S.sm }}>
          <Ionicons name="create-outline" size={20} color={C.brandStrong} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: S.sm }}>
        <Text style={{ fontSize: 30, fontWeight: "800", color: status.leftCentavos < 0 ? C.danger : C.text, fontVariant: ["tabular-nums"] }}>
          {formatPeso(Math.abs(status.leftCentavos))}
        </Text>
        <Text style={{ fontSize: 15, color: C.muted, marginBottom: 5 }}>{status.leftCentavos < 0 ? "over budget" : "left"}</Text>
      </View>
      <Muted>
        ≈ {local(status.leftCentavos)} · spent {formatPeso(status.spentCentavos)} of {formatPeso(plan.budgetCentavos)}
      </Muted>
      <View style={{ height: 10, backgroundColor: C.surface2, borderRadius: 5, marginTop: S.sm, overflow: "hidden" }}>
        <View style={{ height: 10, width: `${Math.max(2, Math.min(100, status.usedShare * 100))}%`, backgroundColor: color, borderRadius: 5 }} />
      </View>

      {status.phase === "during" ? (
        <View style={{ marginTop: S.md, padding: S.md, borderRadius: 12, backgroundColor: overToday ? C.dangerSoft : C.brandSoft }}>
          <Text style={{ fontSize: 13, color: overToday ? C.danger : C.brandStrong, fontWeight: "700" }}>
            {overToday ? "Today is over its share by" : "Today you can still spend"}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, fontVariant: ["tabular-nums"] }}>
            {formatPeso(Math.abs(status.todayLeftCentavos))} <Text style={{ fontSize: 15, fontWeight: "600", color: C.muted }}>≈ {local(status.todayLeftCentavos)}</Text>
          </Text>
          <Muted>
            Spent today {formatPeso(status.spentTodayCentavos)} of {formatPeso(status.todayAllowanceCentavos)} · updates as you log
          </Muted>
        </View>
      ) : null}

      <View style={{ marginTop: S.md }}>
        {(compact ? tips.slice(0, 1) : tips).map((t) => (
          <InsightCard key={t.id} insight={t} />
        ))}
      </View>

      {!compact && ai.available && status.phase !== "before" ? (
        <View style={{ marginTop: S.xs }}>
          {aiTips ? (
            <View style={{ padding: S.md, borderRadius: 12, borderWidth: 1, borderColor: C.border, gap: S.sm }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: C.brandStrong }}>✨ {ai.name} · {(aiTips.ms / 1000).toFixed(1)}s {ai.where}</Text>
              {aiTips.tips.length ? (
                aiTips.tips.map((t) => (
                  <Text key={t} style={{ fontSize: 15, color: C.text, lineHeight: 21 }}>
                    • {t}
                  </Text>
                ))
              ) : (
                <Muted>No tip passed the check this time. Try again.</Muted>
              )}
              <Muted>
                {aiTips.dropped
                  ? `✓ Checked: ${aiTips.dropped} tip${aiTips.dropped === 1 ? " was" : "s were"} dropped for using an amount that isn't in your records.`
                  : "✓ Checked: every amount comes from your own records."}
              </Muted>
            </View>
          ) : (
            <Button label={`✨ Tips from ${ai.name} (${ai.where})`} variant="secondary" onPress={askNano} busy={aiBusy} />
          )}
          {aiError ? <Muted style={{ marginTop: S.xs }}>{aiError}</Muted> : null}
        </View>
      ) : null}

      <TripSetup open={editing} plan={plan} onClose={() => setEditing(false)} />
    </Card>
  );
}

const CURRENCIES = Object.keys(FX.phpPerUnit) as CurrencyCode[];

function TripSetup({ open, plan, onClose }: { open: boolean; plan: TripPlan | null; onClose: () => void }) {
  const { settings, setSettings, update } = useStore();
  const today = todayISO();
  const [name, setName] = useState(plan?.name ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(plan?.currency ?? settings.tripCurrency ?? "JPY");
  const [budget, setBudget] = useState(plan ? String(Math.round(plan.budgetCentavos / 100)) : "");
  const [start, setStart] = useState(plan?.start ?? today);
  const [days, setDays] = useState(plan ? String(Math.round((Date.parse(plan.end) - Date.parse(plan.start)) / 86_400_000) + 1) : "5");

  const pesos = Number(budget.replace(/[^\d.]/g, ""));
  const nDays = Math.max(1, Math.min(90, Math.round(Number(days) || 0)));
  const valid = name.trim().length > 0 && pesos > 0 && Number(days) >= 1;

  function save() {
    if (!valid) return;
    const next: TripPlan = { name: name.trim(), currency, budgetCentavos: Math.round(pesos * 100), start, end: addDays(start, nDays - 1) };
    setSettings({ trip: next, tripCurrency: currency });
    onClose();
  }

  function remove() {
    update((d) => ({ ...d, transactions: d.transactions.filter((t) => !isSampleTx(t.id)) }));
    setSettings({ trip: null, tripCurrency: null });
    onClose();
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={[styles.screen, { paddingTop: S.lg }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Trip budget</Text>
          <Muted style={{ marginBottom: S.md }}>Stays on this phone. Amounts you log in {currency} are converted to pesos at {FX.source}.</Muted>

          <Text style={styles.label}>Where to?</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Tokyo" style={styles.input} accessibilityLabel="Trip name" />

          <Text style={[styles.label, { marginTop: S.md }]}>Local currency</Text>
          <View style={styles.wrap}>
            {CURRENCIES.map((c) => (
              <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: S.md }]}>Budget in pesos</Text>
          <TextInput value={budget} onChangeText={setBudget} placeholder="60000" keyboardType="numeric" style={styles.input} accessibilityLabel="Budget in pesos" />
          {pesos > 0 ? <Muted style={{ marginTop: S.xs }}>{inBoth(Math.round(pesos * 100), currency)} · about {inBoth(Math.floor((pesos * 100) / nDays), currency)} a day</Muted> : null}

          <Text style={[styles.label, { marginTop: S.md }]}>Starts</Text>
          <View style={styles.wrap}>
            {[
              { label: "Today", value: today },
              { label: "Tomorrow", value: addDays(today, 1) },
              { label: "Started yesterday", value: addDays(today, -1) },
            ].map((o) => (
              <Chip key={o.label} label={o.label} selected={start === o.value} onPress={() => setStart(o.value)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: S.md }]}>Number of days</Text>
          <TextInput value={days} onChangeText={setDays} keyboardType="number-pad" style={styles.input} accessibilityLabel="Number of days" />

          <View style={{ gap: S.sm, marginTop: S.lg }}>
            <Button label="Save trip budget" icon="checkmark" onPress={save} disabled={!valid} />
            {plan ? <Button label="End and remove this trip" icon="trash" variant="ghost" onPress={remove} /> : null}
            <Button label="Cancel" icon="close" variant="ghost" onPress={onClose} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
