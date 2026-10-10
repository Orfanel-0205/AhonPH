import { useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Chip, Muted, styles } from "./components";
import { clearHistory, useHistory, type HistoryKind } from "./history";
import { C, S } from "./theme";

const KINDS: { id: HistoryKind | "all"; label: string }[] = [
  { id: "all", label: "Lahat" },
  { id: "usap", label: "🗣 Usap" },
  { id: "scan", label: "🧾 Scan" },
  { id: "split", label: "👥 Hatian" },
  { id: "plan", label: "🗺 Plan" },
  { id: "gastos", label: "💸 Gastos" },
  { id: "ailab", label: "🧪 AI Lab" },
];
const ICON: Record<HistoryKind, string> = { usap: "🗣", scan: "🧾", split: "👥", plan: "🗺", gastos: "💸", ailab: "🧪" };

/** Kasaysayan: everything done in the app, kept only on this phone and readable offline. */
export function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const all = useHistory();
  const [kind, setKind] = useState<HistoryKind | "all">("all");
  const days = useMemo(() => {
    const shown = kind === "all" ? all : all.filter((e) => e.kind === kind);
    const groups = new Map<string, typeof shown>();
    for (const e of shown) {
      const day = new Date(e.at).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
      groups.set(day, [...(groups.get(day) ?? []), e]);
    }
    return [...groups.entries()];
  }, [all, kind]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={[styles.screen, { paddingTop: S.lg }]}>
          <Text style={styles.title}>🕘 Kasaysayan · History</Text>
          <Muted style={{ marginBottom: S.md }}>Everything you did in LakbayMate, saved only on this phone. Works offline.</Muted>
          <View style={[styles.wrap, { marginBottom: S.md }]}>
            {KINDS.map((k) => (
              <Chip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
            ))}
          </View>
          {days.length ? (
            days.map(([day, list]) => (
              <Card key={day}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: C.muted, marginBottom: S.xs }}>{day}</Text>
                {list.map((e) => (
                  <View key={e.id} style={{ flexDirection: "row", gap: S.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.surface2 }}>
                    <Text style={{ fontSize: 16 }}>{ICON[e.kind]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{e.title}</Text>
                      {e.detail ? <Text style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{e.detail}</Text> : null}
                    </View>
                    <Text style={{ fontSize: 12, color: C.muted }}>{new Date(e.at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</Text>
                  </View>
                ))}
              </Card>
            ))
          ) : (
            <Card>
              <Muted>Nothing here yet. Talk, scan, split or plan, and it shows up here.</Muted>
            </Card>
          )}
          <View style={{ gap: S.sm }}>
            {all.length ? (
              <Button
                label="Clear history"
                icon="trash"
                variant="ghost"
                onPress={() =>
                  Alert.alert("Clear history?", "This removes the history from this phone.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: clearHistory },
                  ])
                }
              />
            ) : null}
            <Button label="Close" icon="close" variant="secondary" onPress={onClose} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
