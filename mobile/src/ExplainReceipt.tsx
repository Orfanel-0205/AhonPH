import { useState } from "react";
import { Text, View } from "react-native";
import { Button, ErrorBox, Muted, Pill } from "./components";
import { NANO_LABEL, phoneAdvise } from "./nanoEngine";
import { useNano } from "./nanoStore";
import { breakdownReceipt, ECON_FACTS, findUngroundedNumbers, formatDate, formatPct, formatPeso, type Insight, type ReceiptItem } from "./shared";
import { C, S } from "./theme";

const QUESTION = "Ipaliwanag ang resibong ito sa simpleng Taglish, at magbigay ng 2 tip para makatipid sa susunod.";

/** The DATA block for one receipt. Every number here is computed by code; the model only explains it. */
export function receiptContext(r: { merchant: string; date: string; items: ReceiptItem[]; totalCentavos: number }, tips: Insight[]): string {
  const lines = [
    `Receipt from ${r.merchant} on ${formatDate(r.date)}. Total ${formatPeso(r.totalCentavos, { showCentavos: true })}.`,
    `Items: ${r.items.map((i) => `${i.quantity !== 1 ? `${i.quantity} × ` : ""}${i.name} ${formatPeso(i.lineTotalCentavos, { showCentavos: true })}`).join("; ")}`,
    `Breakdown: ${breakdownReceipt(r.items)
      .filter((g) => g.centavos > 0)
      .map((g) => `${g.label} ${formatPeso(g.centavos, { showCentavos: true })} (${formatPct(g.share)})`)
      .join("; ")}`,
  ];
  if (tips.length) lines.push("Findings computed by the app:", ...tips.map((t) => `- ${t.title}: ${t.body}`));
  lines.push(`Philippine data: rice inflation ${ECON_FACTS.riceInflation.value}% and food inflation ${ECON_FACTS.foodInflation.value}% (PSA, ${ECON_FACTS.foodInflation.period}).`);
  return lines.join("\n");
}

/** One tap: Gemini Nano on this phone explains the receipt in Taglish, with the number check. */
export function ExplainReceipt({ context }: { context: string }) {
  const nano = useNano();
  const [text, setText] = useState("");
  const [done, setDone] = useState<{ meta: string; ungrounded: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nano.status !== "available") return null;

  async function explain() {
    setBusy(true);
    setError(null);
    setDone(null);
    setText("");
    try {
      const r = await phoneAdvise(QUESTION, context, [], setText);
      setText(r.text);
      setDone({ meta: `On this phone · ${NANO_LABEL} · ${(r.ms / 1000).toFixed(1)}s`, ungrounded: findUngroundedNumbers(r.text, context) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ marginBottom: S.md }}>
      <Button label={busy ? "Ipinapaliwanag…" : "Ipaliwanag · explain this receipt"} icon="sparkles" variant="secondary" onPress={explain} busy={busy && !text} />
      {text ? (
        <View style={{ marginTop: S.sm, backgroundColor: C.surface2, borderRadius: 12, padding: S.md }}>
          <Text style={{ fontSize: 14, color: C.text, lineHeight: 21 }}>{text.replace(/\*\*/g, "")}</Text>
          {done ? (
            <View style={{ marginTop: 6, gap: 4 }}>
              <Muted>{done.meta}</Muted>
              {done.ungrounded.length ? (
                <Pill label={`Check these numbers: ${done.ungrounded.join(", ")}`} tone="warning" icon="warning" />
              ) : (
                <Pill label="All numbers match the receipt ✓" tone="good" icon="checkmark-circle" />
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      {error ? (
        <View style={{ marginTop: S.sm }}>
          <ErrorBox message={error} />
        </View>
      ) : null}
    </View>
  );
}
