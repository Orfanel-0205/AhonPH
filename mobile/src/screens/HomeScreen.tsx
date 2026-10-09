import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarRow, Button, Card, Chip, H2, InsightCard, Muted, Pill, Stat, styles } from "../components";
import {
  breakdownReceipt,
  budgetStatuses,
  buildInsights,
  buildSampleData,
  ECON_FACTS,
  EXPENSE_INFO,
  formatDate,
  formatPct,
  formatPeso,
  makePeriod,
  SAMPLE_PERSONA,
  personalInflation,
  receiptTips,
  summarize,
  todayISO,
  yearOnYearWindows,
  type PeriodKind,
  type Receipt,
} from "../shared";
import { ExplainReceipt, receiptContext } from "../ExplainReceipt";
import { useStore } from "../store";
import { C, S } from "../theme";

const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: "last30", label: "Last 30 days" },
  { kind: "thisMonth", label: "This month" },
  { kind: "lastMonth", label: "Last month" },
];

export function HomeScreen({ onScan }: { onScan: () => void }) {
  const { data, update } = useStore();
  const [kind, setKind] = useState<PeriodKind>("last30");
  const today = todayISO();

  const { summary, insights } = useMemo(() => {
    const summary = summarize(data.transactions, makePeriod(kind, today));
    return { summary, insights: buildInsights(summary, budgetStatuses(summary, data.budgets)) };
  }, [data, kind, today]);

  const receipts = useMemo(() => [...data.receipts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [data.receipts]);
  const inflation = useMemo(() => {
    const { base, current } = yearOnYearWindows(today);
    return personalInflation(data.receipts, base, current);
  }, [data.receipts, today]);
  const [openReceipt, setOpenReceipt] = useState<Receipt | null>(null);

  if (data.transactions.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title}>Kumusta! 👋</Text>
        <Muted style={{ marginTop: S.xs, marginBottom: S.lg }}>
          KitaPH reads your receipts and explains where your money goes. The AI runs on this phone, so your finances never leave it.
        </Muted>
        <Card>
          <H2>Start here</H2>
          <View style={{ gap: S.sm }}>
            <Button label="Scan a receipt" icon="scan" onPress={onScan} />
            <Button label={`Try sample data (${SAMPLE_PERSONA.name})`} icon="person" variant="secondary" onPress={() => update(() => buildSampleData(today))} />
          </View>
          <Muted style={{ marginTop: S.md }}>{SAMPLE_PERSONA.name}: {SAMPLE_PERSONA.description}</Muted>
        </Card>
      </ScrollView>
    );
  }

  const max = summary.byCategory[0]?.centavos ?? 1;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {data.isSample ? (
        <View style={{ marginBottom: S.md }}>
          <Pill label={`Sample data · ${SAMPLE_PERSONA.name}, ${SAMPLE_PERSONA.description.split("·")[0].trim()}`} tone="info" icon="person" />
        </View>
      ) : null}
      <View style={[styles.wrap, { marginBottom: S.md }]}>
        {PERIODS.map((p) => (
          <Chip key={p.kind} label={p.label} selected={kind === p.kind} onPress={() => setKind(p.kind)} />
        ))}
      </View>
      <Muted style={{ marginBottom: S.sm }}>{summary.period.label}</Muted>

      <View style={[styles.wrap, { marginBottom: S.md }]}>
        <Stat label="Kita · Income" value={formatPeso(summary.incomeCentavos)} />
        <Stat label="Gastos · Spent" value={formatPeso(summary.expenseCentavos)} />
        <Stat label="Natitira · Left" value={formatPeso(summary.remainingCentavos)} />
        <Stat label="Nagastos · Share" value={summary.spentShareOfIncome === null ? "—" : formatPct(summary.spentShareOfIncome)} sub="of income" />
      </View>

      <H2>Insights</H2>
      {insights.slice(0, 5).map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}

      {inflation ? <PresyoCard inflation={inflation} /> : null}

      {summary.byCategory.length ? (
        <Card style={{ marginTop: S.sm }}>
          <H2>Saan napunta ang pera</H2>
          {summary.byCategory.map((c) => (
            <BarRow
              key={c.category}
              label={`${EXPENSE_INFO[c.category].label}${c.essential ? "" : " (flexible)"}`}
              value={formatPeso(c.centavos)}
              note={formatPct(c.share)}
              fraction={c.centavos / max}
            />
          ))}
        </Card>
      ) : null}

      {receipts.length ? (
        <Card>
          <H2>Recent receipts</H2>
          {receipts.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setOpenReceipt(r)}
              accessibilityRole="button"
              accessibilityLabel={`${r.merchant}, ${formatPeso(r.totalCentavos)}, open breakdown`}
              style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surface2 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: C.text, fontWeight: "600" }}>{r.merchant}</Text>
                <Muted>
                  {formatDate(r.date)} · {r.items.length} items
                </Muted>
              </View>
              <Text style={{ fontSize: 15, color: C.text, fontWeight: "600" }}>{formatPeso(r.totalCentavos)}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <ReceiptModal receipt={openReceipt} history={data.receipts} onClose={() => setOpenReceipt(null)} />
    </ScrollView>
  );
}

/** "Your personal inflation": same items on your own receipts, now vs a year ago, next to PSA's figures. */
function PresyoCard({ inflation }: { inflation: NonNullable<ReturnType<typeof personalInflation>> }) {
  const up = inflation.rate >= 0;
  return (
    <Card style={{ marginTop: S.sm }}>
      <H2>Presyo · your personal inflation</H2>
      <View style={{ flexDirection: "row", gap: S.md, marginBottom: S.sm }}>
        <View style={{ flex: 1 }}>
          <Muted>Your basket</Muted>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.text, fontVariant: ["tabular-nums"] }}>
            {up ? "+" : ""}
            {formatPct(inflation.rate)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Muted>Official (PSA, {ECON_FACTS.headlineInflation.period})</Muted>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.muted, fontVariant: ["tabular-nums"] }}>+{ECON_FACTS.headlineInflation.value}%</Text>
        </View>
      </View>
      <Muted style={{ marginBottom: S.sm }}>
        Same items from your receipts, {formatDate(inflation.current.start)} – {formatDate(inflation.current.end)} vs a year earlier. Computed on this phone; your
        receipts never leave it.
      </Muted>
      {inflation.items.slice(0, 4).map((i) => (
        <View key={i.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.surface2 }}>
          <Text style={{ flex: 1, fontSize: 14, color: C.text }} numberOfLines={1}>
            {i.name}
          </Text>
          <Text style={{ fontSize: 14, color: C.text, fontVariant: ["tabular-nums"] }}>
            {formatPeso(i.baseUnitPriceCentavos, { showCentavos: true })} → {formatPeso(i.currentUnitPriceCentavos, { showCentavos: true })}{" "}
            <Text style={{ fontWeight: "700" }}>
              {i.change >= 0 ? "+" : ""}
              {formatPct(i.change)}
            </Text>
          </Text>
        </View>
      ))}
    </Card>
  );
}

function ReceiptModal({ receipt, history, onClose }: { receipt: Receipt | null; history: Receipt[]; onClose: () => void }) {
  if (!receipt) return null;
  const groups = breakdownReceipt(receipt.items).filter((g) => g.centavos > 0);
  const tips = receiptTips(
    {
      merchant: receipt.merchant,
      date: receipt.date,
      items: receipt.items,
      totalCentavos: receipt.totalCentavos,
      vatCentavos: null,
      totalFound: true,
      check: { status: "ok", itemsSumCentavos: receipt.totalCentavos, totalCentavos: receipt.totalCentavos },
    },
    history.filter((h) => h.id !== receipt.id),
  );
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[styles.screen, { paddingTop: S.lg }]}>
        <Text style={styles.title}>{receipt.merchant}</Text>
        <Muted style={{ marginBottom: S.md }}>
          {formatDate(receipt.date)} · {receipt.items.length} items · {formatPeso(receipt.totalCentavos, { showCentavos: true })}
        </Muted>
        {tips.map((t) => (
          <InsightCard key={t.id} insight={t} />
        ))}
        <ExplainReceipt context={receiptContext(receipt, tips)} />
        {groups.length ? (
          <Card>
            <H2>Breakdown</H2>
            {groups.map((g) => (
              <BarRow key={g.group} label={g.label} value={formatPeso(g.centavos)} note={formatPct(g.share)} fraction={g.share} />
            ))}
          </Card>
        ) : null}
        <Card>
          <H2>Items</H2>
          {receipt.items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>
                {it.quantity !== 1 ? `${it.quantity} × ` : ""}
                {it.name}
              </Text>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: "600" }}>{formatPeso(it.lineTotalCentavos, { showCentavos: true })}</Text>
            </View>
          ))}
        </Card>
        <Button label="Close" icon="close" variant="secondary" onPress={onClose} />
      </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
