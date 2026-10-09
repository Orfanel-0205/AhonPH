import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Chip, H2, Muted, Pill, styles } from "./components";
import { useLocalAI } from "./localAI";
import { phoneSplit } from "./nanoEngine";
import { convertToPhp, formatCurrency, formatPeso, roundToPeso, splitBill, todayISO, type CurrencyCode } from "./shared";
import { listen } from "./speech";
import { newId, useStore } from "./store";
import { C, S } from "./theme";
import { TripCard } from "./TripBudget";

export interface SplitItem {
  /** What the person reads (English name when the AI gave one). */
  name: string;
  original: string;
  total: number;
}

const WHOLE: CurrencyCode[] = ["JPY", "KRW", "TWD", "VND", "IDR"];

/**
 * Hatian: split a receipt abroad among companions. Say who had what in one sentence and the local AI
 * assigns the items (only names in the list are accepted); or tap. Every amount is computed by code.
 */
export function SplitModal({
  open,
  onClose,
  items,
  total,
  currency,
  store,
}: {
  open: boolean;
  onClose: () => void;
  items: SplitItem[];
  total: number;
  currency: CurrencyCode;
  store: string | null;
}) {
  const { settings, setSettings, update } = useStore();
  const ai = useLocalAI();
  const [people, setPeople] = useState<string[]>(() => (settings.companions?.length ? settings.companions : ["Ako"]));
  const [newName, setNewName] = useState("");
  const [shares, setShares] = useState<number[][]>(() => items.map(() => []));
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const decimals = WHOLE.includes(currency) ? 0 : 2;
  const result = useMemo(() => splitBill(items.map((i) => i.total), shares, people.length, total, decimals), [items, shares, people.length, total, decimals]);
  const local = (n: number) => formatCurrency(n, currency);
  const pesos = (n: number) => formatPeso(roundToPeso(convertToPhp(n, currency)));

  function savePeople(next: string[]) {
    setPeople(next);
    setShares(items.map(() => []));
    setSettings({ companions: next });
  }

  function toggle(i: number, p: number) {
    setShares((prev) => {
      const cur = prev[i] ?? [];
      const nextForItem = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].sort((a, b) => a - b);
      return prev.map((s, k) => (k === i ? nextForItem : s));
    });
  }

  async function assignWithAI() {
    if (!said.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await phoneSplit(
        items.map((i) => (i.name !== i.original ? `${i.original} (${i.name})` : i.name)),
        people,
        said.trim(),
      );
      setShares(r.shares);
      setNote(
        `✨ ${ai.name} assigned ${r.assigned} of ${items.length} items in ${(r.ms / 1000).toFixed(1)}s. Only names on your list are accepted; anything not mentioned is shared by everyone. Tap to fix.`,
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function speakIt() {
    if (listening) return;
    setListening(true);
    try {
      const s = await listen("en", setSaid);
      const heard = (await s.done).trim();
      if (heard) setSaid(heard);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setListening(false);
    }
  }

  function shareText() {
    const lines = people.map((p, i) => `${p}: ${local(result.amounts[i])} (≈ ${pesos(result.amounts[i])})`);
    Share.share({ message: `${store ?? "Receipt"} · ${local(total)}\n${lines.join("\n")}\n— split offline with LakbayMate` });
  }

  function saveMine() {
    const mine = result.amounts[0];
    update((d) => ({
      ...d,
      transactions: [
        {
          id: newId("tx"),
          type: "expense",
          category: "food",
          description: `${store ?? "Receipt"} (my share ${local(mine)} of ${local(total)})`.slice(0, 80),
          amountCentavos: convertToPhp(mine, currency),
          date: todayISO(),
          source: "receipt",
        },
        ...d.transactions,
      ],
    }));
    setSaved(true);
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={[styles.screen, { paddingTop: S.lg }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Hatian</Text>
          <Muted style={{ marginBottom: S.md }}>
            Split {store ?? "this receipt"} ({local(total)} ≈ {pesos(total)}) with your group. Works offline; nothing leaves this phone.
          </Muted>

          <Card>
            <H2>Sino-sino kayo? · Who&apos;s splitting</H2>
            <View style={styles.wrap}>
              {people.map((p, i) => (
                <Chip key={`${p}-${i}`} label={i === 0 ? `${p} (ikaw)` : `${p}  ✕`} selected={i === 0} onPress={() => (i === 0 ? null : savePeople(people.filter((_, k) => k !== i)))} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: S.sm, marginTop: S.sm, alignItems: "center" }}>
              <TextInput value={newName} onChangeText={setNewName} placeholder="Add a name (e.g. Maria)" style={[styles.input, { flex: 1 }]} accessibilityLabel="Companion name" />
              <View style={{ width: 96 }}>
                <Button
                  label="Add"
                  icon="person-add"
                  variant="secondary"
                  onPress={() => {
                    const n = newName.trim();
                    if (n && !people.some((p) => p.toLowerCase() === n.toLowerCase())) savePeople([...people, n]);
                    setNewName("");
                  }}
                />
              </View>
            </View>
          </Card>

          {ai.available && people.length > 1 ? (
            <Card>
              <H2>✨ Sabihin kung sino ang kumain ng ano</H2>
              <TextInput
                value={said}
                onChangeText={setSaid}
                multiline
                placeholder={`Kay ${people[1]} ang karaage at beer, hati kaming lahat sa edamame, akin ang oyakodon`}
                style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
                accessibilityLabel="Who had what"
              />
              <View style={{ flexDirection: "row", gap: S.sm, marginTop: S.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label={`Assign with ${ai.name}`} icon="sparkles" onPress={assignWithAI} busy={busy} disabled={!said.trim()} />
                </View>
                <View style={{ width: 64 }}>
                  <Button label="" icon={listening ? "stop" : "mic"} variant="secondary" onPress={speakIt} />
                </View>
              </View>
              {note ? <Muted style={{ marginTop: S.sm }}>{note}</Muted> : null}
            </Card>
          ) : null}

          <Card>
            <H2>Items</H2>
            {items.map((it, i) => (
              <View key={`${it.original}-${i}`} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: S.sm }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: C.text }}>{it.name}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{local(it.total)}</Text>
                </View>
                {it.name !== it.original ? <Muted>{it.original}</Muted> : null}
                <View style={[styles.wrap, { marginTop: 6 }]}>
                  <Chip label="Lahat" selected={!(shares[i] ?? []).length} onPress={() => setShares((prev) => prev.map((s, k) => (k === i ? [] : s)))} />
                  {people.map((p, k) => (
                    <Chip key={`${p}-${k}`} label={p} selected={(shares[i] ?? []).includes(k)} onPress={() => toggle(i, k)} />
                  ))}
                </View>
              </View>
            ))}
          </Card>

          <Card style={{ borderColor: C.brand, borderWidth: 2 }}>
            <H2>Bayad ng bawat isa · Each person pays</H2>
            {people.map((p, i) => (
              <Pressable key={`${p}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
                <Text style={{ fontSize: 16, fontWeight: i === 0 ? "800" : "600", color: C.text }}>{i === 0 ? `${p} (ikaw)` : p}</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: C.text, fontVariant: ["tabular-nums"] }}>
                  {local(result.amounts[i] ?? 0)} <Text style={{ fontSize: 14, color: C.brandStrong }}>≈ {pesos(result.amounts[i] ?? 0)}</Text>
                </Text>
              </Pressable>
            ))}
            <Muted style={{ marginTop: S.sm }}>
              ✓ Adds up to {local(total)} exactly.
              {result.extra ? ` Tax/service ${local(result.extra)} is split by what each person ordered.` : ""} Computed by code, not the AI.
            </Muted>
            <View style={{ gap: S.sm, marginTop: S.md }}>
              <Button label="Share the split" icon="share-social" variant="secondary" onPress={shareText} />
              {saved ? (
                <>
                  <Pill label={`Saved your share ≈ ${pesos(result.amounts[0])}`} tone="good" icon="checkmark-circle" />
                  <TripCard compact />
                </>
              ) : (
                <Button label={`Save my share · ${pesos(result.amounts[0] ?? 0)}`} icon="checkmark" onPress={saveMine} />
              )}
            </View>
          </Card>
          <Button label="Close" icon="close" variant="ghost" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
