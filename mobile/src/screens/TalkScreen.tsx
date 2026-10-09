import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Chip, ErrorBox, H2, Muted, Pill, styles } from "../components";
import { phonePolish, phoneRead, phoneSuggestReplies, phoneTranslate } from "../nanoEngine";
import { useNano } from "../nanoStore";
import { detectLanguage, downloadedLanguages, prepareTranslation, translateTexts } from "../onDevice";
import {
  curatedTranslation,
  hintReplies,
  isNanoLang,
  mergeReplies,
  phrasebookReplies,
  SCENARIOS,
  suggestionPrompt,
  TAKE_ME_TO_HOTEL,
  type MeLang,
  type Scenario,
} from "../shared";
import { listen, offlineSpeechLanguages, speak, THEM_LANGS, type Listening } from "../speech";
import { useStore } from "../store";
import { C, S } from "../theme";

type Via = "phrasebook" | "nano" | "polished" | "translator";

interface Line {
  id: number;
  who: "me" | "them";
  /** What was said or typed, in the speaker's language. */
  original: string;
  /** What the other side reads. */
  translated: string;
  /** For my lines: the translation translated back, so I can check the meaning. */
  back?: string;
  /** For my lines: Gemini Nano's tidied English, when it was used. */
  polished?: string;
  via?: Via;
  /** For their lines: how it reached the phone. */
  source?: "heard" | "typed" | "shared";
  /** For their lines: the language they used. */
  lang?: string;
}

const ME_LANGS: { code: MeLang; label: string }[] = [
  { code: "tl", label: "Filipino" },
  { code: "en", label: "English" },
];

const langLabel = (code: string) => THEM_LANGS.find((l) => l.code === code)?.label ?? ME_LANGS.find((l) => l.code === code)?.label ?? code;

const VIA_LABEL: Record<Via, string> = {
  phrasebook: "✓ Checked phrase",
  nano: "✨ Gemini Nano, on this phone",
  polished: "✨ Tidied by Gemini Nano, then translated",
  translator: "Translated on this phone",
};

/** Usap: two-way conversation help abroad. Speech, translation, reply ideas and voice all run on the phone. */
export function TalkScreen({ incoming, onIncomingRead }: { incoming?: string | null; onIncomingRead?: () => void }) {
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
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState<"me" | "them" | null>(null);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speechLangs, setSpeechLangs] = useState<string[] | null>(null);
  const [packs, setPacks] = useState<string[]>([]);
  const [shown, setShown] = useState<Line | null>(null);
  const [stayOpen, setStayOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [theirDraft, setTheirDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const session = useRef<Listening | null>(null);
  const nextId = useRef(1);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    offlineSpeechLanguages().then(setSpeechLangs);
    downloadedLanguages().then(setPacks);
  }, []);

  useEffect(() => {
    setSuggestions(phrasebookReplies(scenario, me, null));
    setSuggestionSource("phrasebook");
  }, [scenario, me]);

  async function translate(text: string, from: string, to: string): Promise<string> {
    if (from === to) return text;
    const needed = [from, to].filter((l) => l !== "en");
    if (!needed.every((l) => packs.includes(l))) {
      // One-time pack download; afterwards this is offline.
      await prepareTranslation(from, to);
      setPacks(await downloadedLanguages());
    }
    return (await translateTexts([text], from, to)).texts[0] ?? text;
  }

  /**
   * Reply bubbles: phrase-bank answers that clearly fit come first, then Gemini Nano's ideas.
   * Nano writes in English, where it is strongest, and ML Kit translates them to Filipino on the phone.
   */
  async function refreshSuggestions(theySaidMe: string, theySaidEn: string, history: Line[]) {
    // Match on both readings: hints are keyed in Filipino and English.
    const hints = hintReplies(me, `${theySaidMe}\n${theySaidEn}`);
    if (nano.status === "available") {
      setThinking(true);
      try {
        let ideas = await phoneSuggestReplies(
          suggestionPrompt({
            scenario,
            lang: "en",
            theySaid: theySaidEn,
            history: history.map((l) => ({
              who: l.who,
              text: l.who === "me" ? (l.polished ?? l.original) : l.translated,
            })),
          }),
        );
        if (ideas.length && me !== "en") ideas = (await translateTexts(ideas, "en", me)).texts;
        if (ideas.length) {
          setSuggestions(mergeReplies(hints, ideas));
          setSuggestionSource("nano");
          return;
        }
      } catch {
        // Fall through to the phrase bank.
      } finally {
        setThinking(false);
      }
    }
    setSuggestions(mergeReplies(hints, phrasebookReplies(scenario, me, theySaidMe)));
    setSuggestionSource("phrasebook");
  }

  /** Translates what the other person said and refreshes the reply bubbles. */
  async function theirLine(original: string, source: Line["source"], replaceId?: number, from: string = them) {
    const id = replaceId ?? nextId.current++;
    const quick = await translate(original, from, me);
    let line: Line = { id, who: "them", original, translated: quick, source, lang: from, via: "translator" };
    const put = (l: Line) => (replaceId ? lines.map((x) => (x.id === replaceId ? l : x)) : [...lines, l]);
    setLines(put(line));
    // Gemini Nano reads Japanese, Korean and Chinese far more naturally than the small offline translator.
    let english: string | null = null;
    if (nano.status === "available" && isNanoLang(from)) {
      setReading(id);
      english = await phoneRead(original, from, scenario);
      setReading(null);
      if (english) {
        line = {
          ...line,
          translated: me === "en" ? english : await translate(english, "en", me),
          via: "nano",
        };
        setLines(put(line));
      }
    }
    english ??= from === "en" ? original : me === "en" ? quick : await translate(original, from, "en");
    refreshSuggestions(line.translated, english, put(line));
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
      if (who === "me") setDraft(heard);
      else await theirLine(heard, "heard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setListening(null);
      session.current = null;
    }
  }

  /**
   * My line: a checked phrase uses its hand-written translation. Anything else is turned into English,
   * tidied by Gemini Nano (the offline translator does much better with clear sentences), translated,
   * and translated back so I can check the meaning.
   */
  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setError(null);
    setSending(true);
    try {
      let translated = curatedTranslation(t, them);
      let polished: string | undefined;
      let via: Via = "phrasebook";
      let back = t;
      if (!translated) {
        let english = me === "en" ? t : await translate(t, me, "en");
        translated = curatedTranslation(english, them);
        if (!translated && nano.status === "available" && isNanoLang(them)) {
          translated = await phoneTranslate(english, them, scenario);
          if (translated) via = "nano";
        }
        if (!translated) {
          if (nano.status === "available") {
            const p = await phonePolish(english, scenario);
            if (p) {
              polished = p;
              english = p;
            }
          }
          translated = curatedTranslation(english, them) ?? (them === "en" ? english : await translate(english, "en", them));
          via = polished ? "polished" : "translator";
        }
        // Translated back by the separate offline translator, so I can check the meaning myself.
        back = them === me ? translated : await translate(translated, them, me);
      }
      const line: Line = {
        id: nextId.current++,
        who: "me",
        original: t,
        translated,
        back,
        polished,
        via,
      };
      setLines((l) => [...l, line]);
      setDraft("");
      speak(translated, them);
    } catch (e) {
      setError(`Couldn't translate: ${e instanceof Error ? e.message : String(e)}. Connect once to download the language pack.`);
    } finally {
      setSending(false);
    }
  }

  // A message shared from a chat app: find its language, switch to it, and read it.
  useEffect(() => {
    if (!incoming) return;
    onIncomingRead?.();
    (async () => {
      try {
        const detected = await detectLanguage(incoming);
        const from = THEM_LANGS.some((l) => l.code === detected) && detected !== me ? detected : them;
        if (from !== them) setSettings({ themLang: from });
        await theirLine(incoming, "shared", undefined, from);
      } catch (e) {
        setError(`Couldn't read the shared message: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const missingThem = speechLangs !== null && !speechLangs.includes(them);
  const missingMe = speechLangs !== null && !speechLangs.includes(me);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.screen, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <View style={[styles.row, { justifyContent: "space-between", marginBottom: S.sm }]}>
          <Text style={styles.title}>Usap</Text>
          <Pressable
            onPress={() => setLangOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Languages: you speak ${langLabel(me)}, they speak ${langLabel(them)}. Change`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ fontWeight: "700", color: C.text }}>{langLabel(me)}</Text>
            <Ionicons name="swap-horizontal" size={16} color={C.brandStrong} />
            <Text style={{ fontWeight: "700", color: C.text }}>{langLabel(them)}</Text>
            <Ionicons name="chevron-down" size={14} color={C.muted} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }} style={{ marginBottom: S.sm }}>
          {SCENARIOS.map((s) => (
            <Chip key={s.id} label={`${s.emoji} ${s.label}`} selected={scenario === s.id} onPress={() => setScenario(s.id)} />
          ))}
        </ScrollView>

        {missingThem ? (
          <Pill label={`Offline speech for ${langLabel(them)} isn't on this phone yet — Privacy → Offline AI setup.`} tone="warning" icon="mic-off" />
        ) : null}
        {missingMe ? (
          <Muted>
            Offline speech for {langLabel(me)} isn&apos;t on this phone — type or tap a reply{me !== "en" ? ", or switch to English to speak" : ""}.
          </Muted>
        ) : null}

        {scenario === "hotel" || scenario === "taxi" ? (
          <Pressable onPress={() => setStayOpen(true)} accessibilityRole="button" style={{ marginTop: S.sm }}>
            <Text style={{ color: C.brandStrong, fontWeight: "700" }}>
              📍 {settings.stayName ? `Show my stay to the driver: ${settings.stayName}` : "Add my hotel address (to show drivers)"} →
            </Text>
          </Pressable>
        ) : null}

        {lines.length === 0 ? (
          <Card style={{ marginTop: S.md }}>
            <Muted>
              Tap <Text style={{ fontWeight: "700" }}>Sila</Text> and let them speak {langLabel(them)}. You&apos;ll read it in {langLabel(me)} with reply ideas.
              Tap a reply, edit it if you like, and KitaPH says it in {langLabel(them)}.
            </Muted>
            <Muted style={{ marginTop: S.sm }}>
              Got a message from your host or driver on a chat app? Share it to <Text style={{ fontWeight: "700" }}>KitaPH</Text> to read and answer it,
              even offline.
            </Muted>
          </Card>
        ) : null}

        {lines.map((l) =>
          l.who === "them" ? (
            <View
              key={l.id}
              style={{
                alignSelf: "flex-start",
                maxWidth: "90%",
                marginTop: S.md,
              }}
            >
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                🗣 Sila · {langLabel(l.lang ?? them)}
                {l.source === "heard" ? " · heard on this phone" : l.source === "shared" ? " · shared message" : " · typed"}
                {reading === l.id ? " · ✨ Gemini Nano is reading…" : l.via === "nano" ? " · ✨ read by Gemini Nano" : ""}
              </Text>
              <View
                style={{
                  backgroundColor: C.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: C.border,
                  padding: S.md,
                }}
              >
                <Text style={{ fontSize: 19, fontWeight: "700", color: C.text }}>{l.translated}</Text>
                {editing?.id === l.id ? (
                  <View style={{ marginTop: S.sm, gap: S.sm }}>
                    <TextInput
                      value={editing.text}
                      onChangeText={(text) => setEditing({ id: l.id, text })}
                      style={styles.input}
                      accessibilityLabel="Correct what was heard"
                    />
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Fix"
                          icon="checkmark"
                          variant="secondary"
                          onPress={async () => {
                            const text = editing.text.trim();
                            setEditing(null);
                            if (text) await theirLine(text, "typed", l.id, l.lang ?? them).catch((e) => setError(String(e)));
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{l.original}</Text>
                )}
                <View style={{ flexDirection: "row", gap: S.lg, marginTop: S.sm }}>
                  <Pressable accessibilityLabel="Play what they said" hitSlop={10} onPress={() => speak(l.original, l.lang ?? them)}>
                    <Ionicons name="volume-high" size={20} color={C.brandStrong} />
                  </Pressable>
                  <Pressable accessibilityLabel="Correct what was heard" hitSlop={10} onPress={() => setEditing({ id: l.id, text: l.original })}>
                    <Ionicons name="create-outline" size={20} color={C.brandStrong} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View
              key={l.id}
              style={{
                alignSelf: "flex-end",
                maxWidth: "90%",
                marginTop: S.md,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: C.muted,
                  marginBottom: 4,
                  textAlign: "right",
                }}
              >
                🙋 Ako · {l.via ? VIA_LABEL[l.via] : ""}
              </Text>
              <View
                style={{
                  backgroundColor: C.brand,
                  borderRadius: 16,
                  padding: S.md,
                }}
              >
                <Text style={{ fontSize: 21, fontWeight: "800", color: "#fff" }}>{l.translated}</Text>
                <Text style={{ fontSize: 13, color: "#d8efe6", marginTop: 6 }}>
                  {me === "tl" ? "Ibig sabihin" : "Means"}: {l.back}
                </Text>
                {l.polished && me !== "en" ? <Text style={{ fontSize: 12, color: "#bfe3d5", marginTop: 2 }}>English: {l.polished}</Text> : null}
                <View style={{ flexDirection: "row", gap: S.lg, marginTop: S.sm }}>
                  <Pressable accessibilityLabel="Play aloud" hitSlop={10} onPress={() => speak(l.translated, them)}>
                    <Ionicons name="volume-high" size={20} color="#fff" />
                  </Pressable>
                  <Pressable accessibilityLabel="Show big" hitSlop={10} onPress={() => setShown(l)}>
                    <Ionicons name="expand" size={20} color="#fff" />
                  </Pressable>
                  <Pressable accessibilityLabel="Send to a chat app" hitSlop={10} onPress={() => Share.share({ message: l.translated })}>
                    <Ionicons name="share-social-outline" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </View>
          ),
        )}

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

        <View style={{ marginTop: S.lg }}>
          <View style={[styles.row, { justifyContent: "space-between", marginBottom: S.sm }]}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: C.text }}>Puwedeng isagot</Text>
            <Muted>{thinking ? "Gemini Nano is thinking…" : suggestionSource === "nano" ? "✨ Gemini Nano + phrasebook" : "Phrasebook"}</Muted>
          </View>
          {suggestions
            .filter((s) => !lines.some((l) => l.who === "me" && l.original === s))
            .map((s) => {
              const checked = curatedTranslation(s, them) !== null;
              return (
                <Pressable
                  key={s}
                  onPress={() => setDraft(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use reply: ${s}`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: S.sm,
                    backgroundColor: pressed ? C.brandSoft : C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    marginBottom: S.sm,
                  })}
                >
                  <Text style={{ flex: 1, fontSize: 15, color: C.text }}>{s}</Text>
                  {checked ? <Text style={{ fontSize: 12, color: C.good, fontWeight: "700" }}>✓</Text> : null}
                  <Ionicons name="create-outline" size={16} color={C.muted} />
                </Pressable>
              );
            })}
          {theirDraft === null ? (
            <Pressable onPress={() => setTheirDraft("")} accessibilityRole="button">
              <Text style={{ color: C.brandStrong, fontWeight: "600" }}>⌨ Type what they said ({langLabel(them)})</Text>
            </Pressable>
          ) : (
            <View style={{ gap: S.sm }}>
              <TextInput
                value={theirDraft}
                onChangeText={setTheirDraft}
                placeholder={`What they said, in ${langLabel(them)}`}
                style={styles.input}
                accessibilityLabel="What the other person said"
              />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Button label="Cancel" variant="ghost" onPress={() => setTheirDraft(null)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Add their line"
                    icon="chatbubble"
                    variant="secondary"
                    disabled={!theirDraft.trim()}
                    onPress={async () => {
                      const t = theirDraft.trim();
                      setTheirDraft(null);
                      setError(null);
                      await theirLine(t, "typed").catch((e) => setError(e instanceof Error ? e.message : String(e)));
                    }}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: C.border,
          backgroundColor: C.surface,
          padding: S.md,
          gap: S.sm,
        }}
      >
        <View style={styles.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Sagot mo (${langLabel(me)}) — i-edit dito`}
            style={[styles.input, { flex: 1 }]}
            multiline
            accessibilityLabel="Your reply"
          />
          <Pressable
            accessibilityLabel="Speak your reply"
            onPress={() => startListening("me")}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: listening === "me" ? C.danger : C.brandSoft,
            }}
          >
            <Ionicons name={listening === "me" ? "stop" : "mic"} size={22} color={listening === "me" ? "#fff" : C.brandStrong} />
          </Pressable>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button
              label={listening === "them" ? "Stop" : `Sila · ${langLabel(them)}`}
              icon={listening === "them" ? "stop" : "mic"}
              variant="secondary"
              onPress={() => startListening("them")}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <Button
              label={sending ? "Isinasalin…" : "Isalin at sabihin"}
              icon="volume-high"
              onPress={() => send(draft)}
              disabled={!draft.trim()}
              busy={sending}
            />
          </View>
        </View>
      </View>

      <LanguageSheet open={langOpen} me={me} them={them} onClose={() => setLangOpen(false)} onPick={(patch) => setSettings(patch)} />
      <ShowBig line={shown} them={them} onClose={() => setShown(null)} />
      <StayModal open={stayOpen} them={them} onClose={() => setStayOpen(false)} translate={translate} />
    </View>
  );
}

function LanguageSheet({
  open,
  me,
  them,
  onClose,
  onPick,
}: {
  open: boolean;
  me: MeLang;
  them: string;
  onClose: () => void;
  onPick: (p: { meLang?: MeLang; themLang?: string }) => void;
}) {
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: C.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: S.lg,
          gap: S.md,
        }}
      >
        <H2>Ako (I speak)</H2>
        <View style={styles.wrap}>
          {ME_LANGS.map((l) => (
            <Chip key={l.code} label={l.label} selected={me === l.code} onPress={() => onPick({ meLang: l.code })} />
          ))}
        </View>
        <H2>Sila (they speak)</H2>
        <View style={styles.wrap}>
          {THEM_LANGS.map((l) => (
            <Chip key={l.code} label={l.label} selected={them === l.code} onPress={() => onPick({ themLang: l.code })} />
          ))}
        </View>
        <Muted>Japanese, Korean and Chinese phrasebook replies use hand-written translations (✓). Everything else is translated on this phone.</Muted>
        <Button label="Done" icon="checkmark" onPress={onClose} />
      </View>
    </Modal>
  );
}

/** Full-screen text to hold up to the other person (noisy places, or when voice isn't right). */
function ShowBig({ line, them, onClose }: { line: Line | null; them: string; onClose: () => void }) {
  if (!line) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.brand,
          padding: S.xl,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 40,
            fontWeight: "800",
            color: "#fff",
            textAlign: "center",
          }}
        >
          {line.translated}
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: "#d8efe6",
            textAlign: "center",
            marginTop: S.lg,
          }}
        >
          {line.back ?? line.original}
        </Text>
        <View style={{ marginTop: S.xl, gap: S.sm }}>
          <Button label="Play aloud" icon="volume-high" variant="secondary" onPress={() => speak(line.translated, them)} />
          <Button label="Close" icon="close" variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Accommodation card: hotel name and address with a request in the local language, for drivers. */
function StayModal({
  open,
  them,
  onClose,
  translate,
}: {
  open: boolean;
  them: string;
  onClose: () => void;
  translate: (t: string, from: string, to: string) => Promise<string>;
}) {
  const { settings, setSettings } = useStore();
  const [name, setName] = useState(settings.stayName);
  const [address, setAddress] = useState(settings.stayAddress);
  const [request, setRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !settings.stayName) return;
    setError(null);
    const curated = curatedTranslation(TAKE_ME_TO_HOTEL.en, them);
    if (curated) {
      setRequest(curated);
      return;
    }
    translate(TAKE_ME_TO_HOTEL.en, "en", them)
      .then(setRequest)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // Re-run only when the card opens or the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, them, settings.stayName]);

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
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: "#fff",
                  marginTop: S.md,
                }}
              >
                {settings.stayName}
              </Text>
              <Text style={{ fontSize: 18, color: "#e6f4ee", marginTop: 4 }}>{settings.stayAddress}</Text>
              <View style={{ marginTop: S.md }}>
                <Button label="Play aloud" icon="volume-high" variant="secondary" onPress={() => request && speak(request, them)} disabled={!request} />
              </View>
            </Card>
          ) : null}
          {error ? <ErrorBox message={error} /> : null}
          <Card>
            <H2>{settings.stayName ? "Edit" : "Add your hotel"}</H2>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Hotel name"
              style={[styles.input, { marginBottom: S.sm }]}
              accessibilityLabel="Hotel name"
            />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Address (copy it from your booking)"
              style={[styles.input, { marginBottom: S.sm }]}
              multiline
              accessibilityLabel="Hotel address"
            />
            <Button
              label="Save"
              icon="checkmark"
              onPress={() =>
                setSettings({
                  stayName: name.trim(),
                  stayAddress: address.trim(),
                })
              }
              disabled={!name.trim()}
            />
          </Card>
          <Button label="Close" icon="close" variant="ghost" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
