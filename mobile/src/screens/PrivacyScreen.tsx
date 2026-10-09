import { Alert, ScrollView, Text, View } from "react-native";
import { Button, Card, H2, Muted, styles } from "../components";
import { buildSampleData, ECON_FACTS, formatDate, FX, todayISO } from "../shared";
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

export function PrivacyScreen() {
  const { data, update } = useStore();
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Privacy</Text>
      <Muted style={{ marginBottom: S.md }}>Your receipts and finances stay on this phone. Here is exactly what runs where.</Muted>

      <Card>
        <H2>On this phone (works offline)</H2>
        <Row title="Text recognition" body="Google ML Kit on-device model, bundled in the app. Photos are never uploaded." />
        <Row title="Translation" body="Google ML Kit on-device translation. Each language pack (~30 MB) downloads once, then works offline." />
        <Row title="Receipt reading, checks, budgets, tips" body="KitaPH code: every peso is computed, never guessed by AI." />
        <Row title="Economic data" body={`Bundled PSA inflation (${ECON_FACTS.headlineInflation.period}) and DOLE wage figures; ${FX.source} for currencies.`} />
      </Card>

      <Card>
        <H2>On your KitaPH Hub (optional)</H2>
        <Row title="Taglish logging and advisor" body="Gemma 3 4B via Ollama on your own laptop, reached over local Wi-Fi. No internet, no cloud AI." />
      </Card>

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
