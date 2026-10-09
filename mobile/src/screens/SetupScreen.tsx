import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button, Chip, Muted, styles } from "../components";
import { downloadNano, refreshNano, useNano } from "../nanoStore";
import { downloadedLanguages, prepareTranslation, TRAVELER_LANGUAGES } from "../onDevice";
import { useStore } from "../store";
import { C, S } from "../theme";

type Icon = ComponentProps<typeof Ionicons>["name"];
type StepState = "ready" | "working" | "todo" | "unavailable";

function Step({ icon, title, body, state, action }: { icon: Icon; title: string; body: string; state: StepState; action?: ReactNode }) {
  const badge: { icon: Icon; color: string; label: string } | null =
    state === "ready"
      ? { icon: "checkmark-circle", color: C.good, label: "Ready" }
      : state === "unavailable"
        ? { icon: "remove-circle", color: C.muted, label: "Not on this phone" }
        : state === "todo"
          ? { icon: "ellipse-outline", color: C.muted, label: "To do" }
          : null;
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: S.lg, marginBottom: S.md }}>
      <View style={{ flexDirection: "row", gap: S.md, alignItems: "flex-start" }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.brandSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={22} color={C.brandStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{title}</Text>
          <Muted style={{ marginTop: 2 }}>{body}</Muted>
        </View>
        {badge ? <Ionicons name={badge.icon} size={22} color={badge.color} accessibilityLabel={badge.label} /> : <ActivityIndicator color={C.brand} />}
      </View>
      {action ? <View style={{ marginTop: S.md }}>{action}</View> : null}
    </View>
  );
}

/** One-time setup: every download happens here, so the rest of the app works offline. */
export function SetupScreen({ onDone }: { onDone: () => void }) {
  const { settings, setSettings } = useStore();
  const nano = useNano();
  const [langs, setLangs] = useState<string[]>([]);
  const [wanted, setWanted] = useState<string[]>([settings.targetLang || "en"]);
  const [langBusy, setLangBusy] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);

  useEffect(() => {
    refreshNano();
    downloadedLanguages().then(setLangs);
  }, []);

  // Tagalog is the source pack; English ships with ML Kit. Each other target needs its own pack.
  const needed = ["tl", ...wanted.filter((w) => w !== "en")];
  const langsReady = wanted.length > 0 && needed.every((l) => langs.includes(l));

  async function getLanguages() {
    setLangBusy(true);
    setLangError(null);
    try {
      for (const target of wanted) await prepareTranslation("tl", target);
      setLangs(await downloadedLanguages());
      setSettings({ targetLang: wanted[0] });
    } catch (e) {
      setLangError(`Download failed: ${e instanceof Error ? e.message : String(e)}. Stay on Wi-Fi and try again.`);
    } finally {
      setLangBusy(false);
    }
  }

  const nanoBusy = nano.downloading || nano.status === "downloading" || nano.status === null;
  const nanoState: StepState =
    nano.status === "available" ? "ready" : nanoBusy ? "working" : nano.status === "downloadable" ? "todo" : "unavailable";
  const allSet = nanoState !== "todo" && nanoState !== "working" && langsReady;

  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingTop: S.xl }]}>
      <Text style={styles.title}>Set up your private AI</Text>
      <Muted style={{ marginTop: S.xs, marginBottom: S.lg }}>
        KitaPH&apos;s AI runs on this phone. Do these one-time downloads now on Wi-Fi, and everything works offline afterwards, even in airplane
        mode. Your receipts and money data never leave the phone.
      </Muted>

      <Step icon="scan" title="Receipt reader" body="Google ML Kit text recognition. Built into KitaPH, nothing to download." state="ready" />

      <Step
        icon="sparkles"
        title="Kita AI · Gemini Nano"
        body={
          nanoState === "unavailable"
            ? "This phone doesn't have Android's built-in AI. KitaPH will use your laptop hub if you connect one, or basic mode."
            : "Android's built-in language model, for Taglish logging and advice. Android downloads and updates it, not KitaPH."
        }
        state={nanoState}
        action={
          nano.status === "downloadable" || nanoBusy ? (
            <View style={{ gap: S.xs }}>
              <Button
                label={nano.downloading || nano.status === "downloading" ? `Downloading${nano.progress ? ` · ${nano.progress}` : "…"}` : "Download (one time)"}
                icon="cloud-download"
                onPress={downloadNano}
                busy={nano.downloading}
                disabled={nano.status === null}
              />
              {nano.error ? <Text style={{ color: C.danger, fontSize: 13 }}>{nano.error}</Text> : null}
            </View>
          ) : null
        }
      />

      <Step
        icon="language"
        title="Traveler translation"
        body="Translate Tagalog menus, signs and receipts on the phone. About 30 MB per language."
        state={langBusy ? "working" : langsReady ? "ready" : "todo"}
        action={
          <View style={{ gap: S.sm }}>
            <View style={styles.wrap}>
              {TRAVELER_LANGUAGES.map((l) => (
                <Chip
                  key={l.code}
                  label={l.label}
                  selected={wanted.includes(l.code)}
                  onPress={() => setWanted(wanted.includes(l.code) ? wanted.filter((w) => w !== l.code) : [...wanted, l.code])}
                />
              ))}
            </View>
            {!langsReady ? (
              <Button label="Download languages" icon="cloud-download" variant="secondary" onPress={getLanguages} busy={langBusy} disabled={wanted.length === 0} />
            ) : null}
            {langError ? <Text style={{ color: C.danger, fontSize: 13 }}>{langError}</Text> : null}
          </View>
        }
      />

      <Button
        label={allSet ? "All set — start using KitaPH" : "Continue (finish later in Privacy)"}
        icon="arrow-forward"
        onPress={() => {
          setSettings({ setupDone: true });
          onDone();
        }}
      />
    </ScrollView>
  );
}
