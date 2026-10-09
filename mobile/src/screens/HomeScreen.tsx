import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BarRow, Button, Card, Chip, H2, InsightCard, Muted, Pill, Stat, styles } from "../components";
import {
  budgetStatuses,
  buildInsights,
  buildSampleData,
  EXPENSE_INFO,
  formatDate,
  formatPct,
  formatPeso,
  makePeriod,
  SAMPLE_PERSONA,
  summarize,
  todayISO,
  type PeriodKind,
} from "../shared";
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
            <Pressable key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surface2 }}>
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
    </ScrollView>
  );
}
