import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Chip, ErrorBox, H2, Muted, Pill, styles } from "../components";
import { phoneSuggestReplies } from "../nanoEngine";
import { useNano } from "../nanoStore";
import { downloadedLanguages, prepareTranslation, translateTexts } from "../onDevice";
import { phrasebookReplies, SCENARIOS, suggestionPrompt, type MeLang, type Scenario } from "../shared";
import { listen, offlineSpeechLanguages, speak, THEM_LANGS, type Listening } from "../speech";
import { useStore } from "../store";
import { C, S } from "../theme";

interface Line {
  id: number;
  who: "me" | "them";
  original: string;
  translated: string;
}

const ME_LANGS: { code: MeLang; label: string }[] = [
  { code: "tl", label: "Filipino" },
  { code: "en", label: "English" },
];

const langLabel = (code: string) => THEM_LANGS.find((l) => l.code === code)?.label ?? ME_LANGS.find((l) => l.code === code)?.label ?? code;

/** Usap: two-way conversation help abroad. Speech, translation, reply ideas and voice all run on the phone. */
export function TalkScreen() {
  const { settings, setSettings } = useStore();
  const nano = useNano();
  const me = settings.meLang;
  const them = settings.themLang;
  const [scenario, setScenario] = useState<Scenario>("hotel");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(() => phrasebookReplies("hotel", me, null));
  const [suggestionSource, setSuggestionSource] = useState<"nano" | "phrasebook">("phrasebook");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState<"me" | "them" | null>(null);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speechLangs, setSpeechLangs] = useState<string[] | null>(null);
  const [packs, setPacks] = useState<string[]>([]);
  const [shown, setShown] = useState<Line | null>(null);
  const [stayOpen, setStayOpen] = useState(false);
  const session = useRef<Listening | null>(null);
  const nextId = useRef(1);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    offlineSpeechLanguages().then(setSpeechLangs);
    downloadedLanguages().then(setPacks);
  }, []);

  useEffect(() => {
    // New situation or language: fresh phrase-bank bubbles until the other person speaks.
    setSuggestions(phrasebookReplies(scenario, me, null));
    setSuggestionSource("phrasebook");
  }, [scenario, me]);

  const translationReady = [me, them].filter((l) => l !== "en").every((l) => packs.includes(l));

  async function translate(text: string, from: string, to: string): Promise<string> {
    if (from === to) return text;
    if (!translationReady) {
      // One-time pack download; afterwards this is offline.
      await prepareTranslation(from, to);
      setPacks(await downloadedLanguages());
    }
    return (await translateTexts([text], from, to)).texts[0] ?? text;
  }

  async function refreshSuggestions(theySaid: string, history: Line[]) {
    if (nano.status === "available") {
      setThinking(true);
      const ideas = await phoneSuggestReplies(
        suggestionPrompt({ scenario, lang: me, theySaid, history: history.map((l) => ({ who: l.who, text: l.who === "me" ? l.original : l.translated })) }),
      );
      setThinking(false);
      if (ideas.length) {
        setSuggestions(ideas);
        setSuggestionSource("nano");
        return;
      }
    }
    setSuggestions(phrasebookReplies(scenario, me, theySaid));
    setSuggestionSource("phrasebook");
  }

  async function startListening(who: "me" | "them") {
    if (listening) {
      session.current?.stop();
      return;
    }
    setError(null);
    setPartial("");
    setListening(who);
    try {
      session.current = await listen(who === "me" ? me : them, setPartial);
      const heard = (await session.current.done).trim();
      setPartial("");
      if (!heard) return;
      if (who === "me") {
        setDraft(heard);
      } else {
        const translated = await translate(heard, them, me);
        const line: Line = { id: nextId.current++, who: "them", original: heard, translated };
        const history = [...lines, line];
        setLines(history);
        refreshSuggestions(translated, history);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setListening(null);
      session.current = null;
    }
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t) return;
    setError(null);
    try {
      const translated = await translate(t, me, them);
      const line: Line = { id: nextId.current++, who: "me", original: t, translated };
      setLines((l) => [...l, line]);
      setDraft("");
      speak(translated, them);
    } catch (e) {
      setError(`Couldn't translate: ${e instanceof Error ? e.message : String(e)}. Connect once to download the language pack.`);
    }
  }

  const missingSpeech = speechLangs ? [me, them].filter((l) => !speechLangs.includes(l)) : [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} contentContainerStyle={[styles.screen, { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <Text style={styles.title}>Usap</Text>
        <Muted style={{ marginBottom: S.sm }}>Talk with anyone abroad. Speech, translation, reply ideas and voice all run on this phone, even in airplane mode.</Muted>

        <View style={[styles.wrap, { marginBottom: S.xs }]}>
          <Text style={{ color: C.muted, fontWeight: "600", alignSelf: "center" }}>Ako:</Text>
          {ME_LANGS.map((l) => (
            <Chip key={l.code} label={l.label} selected={me === l.code} onPress={() => setSettings({ meLang: l.code })} />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.xs }} contentContainerStyle={{ gap: S.sm }}>
          <Text style={{ color: C.muted, fontWeight: "600", alignSelf: "center" }}>Sila:</Text>
          {THEM_LANGS.map((l) => (
            <Chip key={l.code} label={l.label} selected={them === l.code} onPress={() => setSettings({ themLang: l.code })} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md }} contentContainerStyle={{ gap: S.sm }}>
          {SCENARIOS.map((s) => (
            <Chip key={s.id} label={`${s.emoji} ${s.label}`} selected={scenario === s.id} onPress={() => setScenario(s.id)} />
          ))}
        </ScrollView>

        {missingSpeech.length ? (
          <Pill label={`Offline speech not downloaded: ${missingSpeech.map(langLabel).join(", ")} (Privacy → Offline AI setup). You can still type.`} tone="warning" icon="mic-off" />
        ) : null}

        {(scenario === "hotel" || scenario === "taxi") ? (
          <Pressable onPress={() => setStayOpen(true)} accessibilityRole="button" style={{ marginTop: S.sm, marginBottom: S.sm }}>
            <Text style={{ color: C.brandStrong, fontWeight: "700" }}>📍 {settings.stayName ? `Show my stay to the driver: ${settings.stayName}` : "Add my hotel address (to show drivers)"} →</Text>
          </Pressable>
        ) : null}

        {lines.length === 0 ? (
          <Card style={{ marginTop: S.sm }}>
            <Muted>
              Tap <Text style={{ fontWeight: "700" }}>Sila magsalita</Text> and let the other person speak in {langLabel(them)}. You&apos;ll see it in {langLabel(me)} with reply ideas. Or
              pick a reply below, edit it, and KitaPH will say it in {langLabel(them)}.
            </Muted>
          </Card>
        ) : null}

        {lines.map((l) => (
          <View key={l.id} style={{ alignSelf: l.who === "me" ? "flex-end" : "flex-start", maxWidth: "88%", marginTop: S.sm }}>
            <View style={{ backgroundColor: l.who === "me" ? C.brand : C.surface, borderRadius: 16, borderWidth: l.who === "me" ? 0 : 1, borderColor: C.border, padding: S.md }}>
              <Text style={{ fontSize: 13, color: l.who === "me" ? "#d8efe6" : C.muted }}>{l.original}</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: l.who === "me" ? "#fff" : C.text, marginTop: 4 }}>{l.translated}</Text>
              <View style={{ flexDirection: "row", gap: S.lg, marginTop: S.sm }}>
                <Pressable accessibilityLabel="Play aloud" hitSlop={10} onPress={() => (l.who === "me" ? speak(l.translated, them) : speak(l.original, them))}>
                  <Ionicons name="volume-high" size={20} color={l.who === "me" ? "#fff" : C.brandStrong} />
                </Pressable>
                {l.who === "me" ? (
                  <Pressable accessibilityLabel="Show big" hitSlop={10} onPress={() => setShown(l)}>
                    <Ionicons name="expand" size={20} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))}

        {listening ? (
          <View style={{ marginTop: S.sm }}>
            <Pill label={`Listening (${langLabel(listening === "me" ? me : them)}) on this phone… ${partial}`} tone="info" icon="mic" />
          </View>
        ) : null}
        {error ? (
          <View style={{ marginTop: S.sm }}>
            <ErrorBox message={error} />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, padding: S.md, gap: S.sm }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>Puwedeng isagot</Text>
          <Muted>{thinking ? "Gemini Nano is thinking…" : suggestionSource === "nano" ? "Ideas from Gemini Nano · on this phone" : "From the phrasebook"}</Muted>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} onPress={() => setDraft(s)} />
          ))}
        </ScrollView>
        <View style={styles.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`I-type o i-edit ang sagot (${langLabel(me)})`}
            style={[styles.input, { flex: 1 }]}
            multiline
            accessibilityLabel="Your reply"
          />
          <Pressable
            accessibilityLabel="Speak your reply"
            onPress={() => startListening("me")}
            style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: listening === "me" ? C.danger : C.brandSoft }}
          >
            <Ionicons name={listening === "me" ? "stop" : "mic"} size={22} color={listening === "me" ? "#fff" : C.brandStrong} />
          </Pressable>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label={listening === "them" ? "Stop" : `Sila magsalita · ${langLabel(them)}`} icon={listening === "them" ? "stop" : "mic"} variant="secondary" onPress={() => startListening("them")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Isalin at sabihin" icon="volume-high" onPress={() => send(draft)} disabled={!draft.trim()} />
          </View>
        </View>
      </View>

      <ShowBig line={shown} them={them} onClose={() => setShown(null)} />
      <StayModal open={stayOpen} them={them} onClose={() => setStayOpen(false)} translate={translate} />
    </View>
  );
}

/** Full-screen text to hold up to the other person (noisy places, or when voice isn't right). */
function ShowBig({ line, them, onClose }: { line: Line | null; them: string; onClose: () => void }) {
  if (!line) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.brand, padding: S.xl, justifyContent: "center" }}>
        <Text style={{ fontSize: 40, fontWeight: "800", color: "#fff", textAlign: "center" }}>{line.translated}</Text>
        <Text style={{ fontSize: 16, color: "#d8efe6", textAlign: "center", marginTop: S.lg }}>{line.original}</Text>
        <View style={{ marginTop: S.xl, gap: S.sm }}>
          <Button label="Play aloud" icon="volume-high" variant="secondary" onPress={() => speak(line.translated, them)} />
          <Button label="Close" icon="close" variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Accommodation card: hotel name and address with a request in the local language, for drivers. */
function StayModal({ open, them, onClose, translate }: { open: boolean; them: string; onClose: () => void; translate: (t: string, from: string, to: string) => Promise<string> }) {
  const { settings, setSettings } = useStore();
  const [name, setName] = useState(settings.stayName);
  const [address, setAddress] = useState(settings.stayAddress);
  const [request, setRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !settings.stayName) return;
    setError(null);
    translate("Please take me to this hotel.", "en", them)
      .then(setRequest)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [open, them, settings.stayName, translate]);

  if (!open) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={styles.screen}>
          <Text style={styles.title}>My stay</Text>
          <Muted style={{ marginBottom: S.md }}>Saved on this phone. Show it to a taxi driver or ask for directions, offline.</Muted>
          {settings.stayName ? (
            <Card style={{ backgroundColor: C.brand, borderColor: C.brand }}>
              {request ? <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff" }}>{request}</Text> : null}
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#fff", marginTop: S.md }}>{settings.stayName}</Text>
              <Text style={{ fontSize: 18, color: "#e6f4ee", marginTop: 4 }}>{settings.stayAddress}</Text>
              <View style={{ marginTop: S.md }}>
                <Button label="Play aloud" icon="volume-high" variant="secondary" onPress={() => request && speak(request, them)} disabled={!request} />
              </View>
            </Card>
          ) : null}
          {error ? <ErrorBox message={error} /> : null}
          <Card>
            <H2>{settings.stayName ? "Edit" : "Add your hotel"}</H2>
            <TextInput value={name} onChangeText={setName} placeholder="Hotel name" style={[styles.input, { marginBottom: S.sm }]} accessibilityLabel="Hotel name" />
            <TextInput value={address} onChangeText={setAddress} placeholder="Address (copy it from your booking)" style={[styles.input, { marginBottom: S.sm }]} multiline accessibilityLabel="Hotel address" />
            <Button label="Save" icon="checkmark" onPress={() => setSettings({ stayName: name.trim(), stayAddress: address.trim() })} disabled={!name.trim()} />
          </Card>
          <Button label="Close" icon="close" variant="ghost" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
