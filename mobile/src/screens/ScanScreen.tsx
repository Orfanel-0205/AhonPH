import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BarRow, Button, Card, Chip, ErrorBox, H2, InsightCard, Muted, Pill, styles } from "../components";
import { ExplainReceipt, receiptContext } from "../ExplainReceipt";
import { hubReceipt } from "../hub";
import { phoneReadReceipt } from "../nanoEngine";
import { useNano } from "../nanoStore";
import { recognizeText, type OcrResult } from "../native";
import { detectLanguage, downloadedLanguages, prepareTranslation, translateTexts, TRAVELER_LANGUAGES } from "../onDevice";
import {
  breakdownReceipt,
  checkReceipt,
  checkReceiptWithSubtotal,
  convertFromPhp,
  EXPENSE_CATEGORIES,
  EXPENSE_INFO,
  explainCharges,
  findPricedLines,
  formatDate,
  formatForeign,
  formatPct,
  formatPeso,
  FX,
  parseOcrReceipt,
  receiptTips,
  toCentavos,
  todayISO,
  type ChargeNote,
  type CurrencyCode,
  type ExpenseCategory,
  type ReceiptItem,
  type ScannedReceipt,
} from "../shared";
import { newId, useStore } from "../store";
import { C, S } from "../theme";

type Mode = "worker" | "traveler";

export function ScanScreen({ onSaved }: { onSaved: () => void }) {
  const [mode, setMode] = useState<Mode>("worker");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  /** Size of the photo a cloud OCR service would have needed; KitaPH uploads none of it. */
  const [photoBytes, setPhotoBytes] = useState<number | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: "camera" | "library") {
    setError(null);
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setError("Camera permission is needed to scan. You can also pick a photo from the gallery.");
      }
      const res =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      setImageUri(uri);
      // Kept only in memory, for the optional hub double-check over local Wi-Fi.
      setImageBase64(res.assets[0].base64 ?? null);
      const b64 = res.assets[0].base64;
      setPhotoBytes(res.assets[0].fileSize ?? (b64 ? Math.round((b64.length * 3) / 4) : null));
      setOcr(null);
      setBusy(true);
      const result = await recognizeText(uri);
      if (!result.text.trim()) setError("No text found. Try a sharper, well-lit photo with the whole receipt in view.");
      setOcr(result);
    } catch (e) {
      setError(`Could not read the photo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setImageUri(null);
    setImageBase64(null);
    setPhotoBytes(null);
    setOcr(null);
    setError(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Scan</Text>
      <Muted style={{ marginBottom: S.md }}>Text is read on this phone with an on-device model. Works in airplane mode.</Muted>
      <View style={[styles.wrap, { marginBottom: S.md }]}>
        <Chip label="Gastos ko · My receipt" selected={mode === "worker"} onPress={() => setMode("worker")} />
        <Chip label="Traveler · Translate & convert" selected={mode === "traveler"} onPress={() => setMode("traveler")} />
      </View>

      {!imageUri ? (
        <Card>
          <H2>{mode === "worker" ? "Scan a receipt" : "Scan a menu, receipt, or sign"}</H2>
          <View style={{ gap: S.sm }}>
            <Button label="Take a photo" icon="camera" onPress={() => pick("camera")} />
            <Button label="Choose from gallery" icon="images" variant="secondary" onPress={() => pick("library")} />
          </View>
        </Card>
      ) : (
        <Card>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Image source={{ uri: imageUri }} style={{ width: 72, height: 96, borderRadius: 8, backgroundColor: C.surface2 }} />
            <View style={{ flex: 1, gap: 6 }}>
              {busy ? <Pill label="Reading on this phone…" icon="hourglass" /> : null}
              {ocr ? <Pill label={`Read on-device in ${(ocr.ms / 1000).toFixed(1)}s · ML Kit`} tone="good" icon="phone-portrait" /> : null}
              {ocr && photoBytes ? (
                <Pill label={`0 bytes sent · cloud OCR would need this ${(photoBytes / 1e6).toFixed(1)} MB photo`} tone="good" icon="cloud-offline" />
              ) : null}
              <Button label="Scan another" icon="refresh" variant="ghost" onPress={reset} />
            </View>
          </View>
        </Card>
      )}

      {error ? <ErrorBox message={error} /> : null}

      {ocr && ocr.text.trim() ? (
        mode === "worker" ? (
          <WorkerResult key={imageUri ?? ""} ocr={ocr} imageUri={imageUri} imageBase64={imageBase64} onSaved={() => { reset(); onSaved(); }} />
        ) : (
          <TravelerResult key={imageUri ?? ""} ocr={ocr} />
        )
      ) : null}
    </ScrollView>
  );
}

function RawText({ rows }: { rows: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
        <Text style={{ color: C.brandStrong, fontWeight: "600" }}>{open ? "Hide" : "Show"} what the phone read ({rows.length} lines)</Text>
      </Pressable>
      {open ? <Text style={{ marginTop: S.sm, fontFamily: "monospace", fontSize: 12, color: C.text }}>{rows.join("\n")}</Text> : null}
    </Card>
  );
}

function WorkerResult({ ocr, imageUri, imageBase64, onSaved }: { ocr: OcrResult; imageUri: string | null; imageBase64: string | null; onSaved: () => void }) {
  const { data, update, settings } = useStore();
  const nano = useNano();
  const [nanoBusy, setNanoBusy] = useState(false);
  const [hubBusy, setHubBusy] = useState(false);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const today = todayISO();
  const parsed = useMemo(() => parseOcrReceipt(ocr.lines, today), [ocr, today]);
  const [items, setItems] = useState<ReceiptItem[]>(parsed?.items ?? []);
  const [totalText, setTotalText] = useState(parsed ? (parsed.totalCentavos / 100).toFixed(2) : "");
  const [merchant, setMerchant] = useState(parsed?.merchant ?? "Receipt");
  const [category, setCategory] = useState<ExpenseCategory>("food");

  const totalCentavos = Number.isFinite(Number(totalText)) && Number(totalText) > 0 ? toCentavos(Number(totalText)) : 0;
  const checked = useMemo(() => checkReceiptWithSubtotal(items, totalCentavos, parsed?.subtotalCentavos ?? null), [items, totalCentavos, parsed]);
  const check = checked.check;
  const checksOut = check.status === "ok" || check.status === "repaired" || check.status === "no-items";
  const groups = useMemo(() => breakdownReceipt(items), [items]);
  const tips = useMemo(
    () =>
      parsed
        ? receiptTips({ merchant, date: parsed.date, items, totalCentavos, vatCentavos: parsed.vatCentavos, check, totalFound: parsed.totalFound }, data.receipts)
        : [],
    [parsed, merchant, items, totalCentavos, check, data.receipts],
  );

  if (!parsed) return <ErrorBox message="This doesn't look like a receipt. Try Traveler mode for menus and signs." />;

  async function readWithPhoneAi() {
    if (!imageUri) return;
    setNanoBusy(true);
    setHubNote(null);
    try {
      const r = await phoneReadReceipt(imageUri);
      if (r.items.length === 0 && r.totalCentavos === null) {
        setHubNote("The phone's AI couldn't read items from this photo. Try a flatter, brighter photo.");
        return;
      }
      const c = checkReceipt(r.items, r.totalCentavos ?? 0);
      const addsUp = r.items.length > 0 && (c.check.status === "ok" || c.check.status === "repaired");
      if (r.merchant) setMerchant(r.merchant);
      if (r.totalCentavos) setTotalText((r.totalCentavos / 100).toFixed(2));
      // Only replace the items when the AI's own items add up; otherwise keep what OCR read and take just the total.
      if (addsUp) setItems(c.items);
      const secs = (r.ms / 1000).toFixed(1);
      setHubNote(
        addsUp
          ? `Read by Gemini Nano on this phone in ${secs}s. Items add up ✓`
          : r.totalCentavos
            ? `Gemini Nano read the TOTAL (${formatPeso(r.totalCentavos, { showCentavos: true })}) in ${secs}s, but not every item. Check the items, or save the total only.`
            : `Gemini Nano couldn't read this photo clearly (${secs}s). Try a flatter, brighter photo.`,
      );
    } catch (e) {
      setHubNote(e instanceof Error ? e.message : String(e));
    } finally {
      setNanoBusy(false);
    }
  }

  async function doubleCheckWithHub() {
    if (!imageBase64 || !settings.hubUrl) return;
    setHubBusy(true);
    setHubNote(null);
    const r = await hubReceipt(settings.hubUrl, imageBase64, today);
    setHubBusy(false);
    if (!r.ok) return setHubNote(r.error);
    const h = r.data.receipt;
    setItems(h.items);
    setTotalText((h.totalCentavos / 100).toFixed(2));
    if (h.merchant) setMerchant(h.merchant);
    setHubNote(`Read by ${r.data.meta.model} on your hub (${r.data.meta.processor}, ${(r.data.meta.durationMs / 1000).toFixed(1)}s). ${h.check.status === "mismatch" ? "Items still don't add up — please check." : "Items add up."}`);
  }

  const save = () => {
    const receiptId = newId("rcpt");
    update((d) => ({
      ...d,
      receipts: [...d.receipts, { id: receiptId, merchant, date: parsed.date, items, totalCentavos }],
      transactions: [
        { id: newId("tx"), type: "expense", category, description: merchant, amountCentavos: totalCentavos, date: parsed.date, source: "receipt", receiptId },
        ...d.transactions,
      ],
    }));
    onSaved();
  };

  const checkPill =
    check.status === "ok" ? (
      <Pill label={checked.basis === "subtotal" ? "Items add up to the SUBTOTAL ✓ (total adds tax/fees)" : "Items add up to the TOTAL ✓"} tone="good" icon="checkmark-circle" />
    ) : check.status === "repaired" ? (
      <Pill label="Fixed quantities so items add up ✓" tone="good" icon="build" />
    ) : check.status === "mismatch" ? (
      <Pill label={`Off by ${formatPeso(Math.abs(check.diffCentavos))} — please check`} tone="warning" icon="warning" />
    ) : (
      <Pill label="No items read — total only" tone="info" icon="information-circle" />
    );

  return (
    <View>
      <Card>
        <TextInput value={merchant} onChangeText={setMerchant} style={[styles.input, { fontWeight: "700", marginBottom: S.sm }]} accessibilityLabel="Store name" />
        <Muted>
          {formatDate(parsed.date)}
          {parsed.dateFromReceipt ? "" : " (date not found, using today)"}
        </Muted>
        <View style={[styles.row, { marginTop: S.md }]}>
          <Text style={{ fontSize: 15, color: C.text, fontWeight: "600" }}>TOTAL ₱</Text>
          <TextInput value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" style={[styles.input, { flex: 1, fontSize: 20, fontWeight: "700" }]} accessibilityLabel="Total amount" />
        </View>
        <View style={{ marginTop: S.sm }}>{checkPill}</View>
        {nano.status === "available" && imageUri ? (
          <View style={{ marginTop: S.md }}>
            <Button
              label={check.status === "ok" ? "Re-read with phone AI" : "Read with phone AI (Gemini Nano)"}
              icon="sparkles"
              variant={check.status === "ok" ? "ghost" : "secondary"}
              onPress={readWithPhoneAi}
              busy={nanoBusy}
            />
          </View>
        ) : null}
        {settings.hubUrl && imageBase64 ? (
          <View style={{ marginTop: S.sm }}>
            <Button label="Double-check with laptop hub" icon="laptop" variant="ghost" onPress={doubleCheckWithHub} busy={hubBusy} />
          </View>
        ) : null}
        {hubNote ? <Muted style={{ marginTop: S.sm }}>{hubNote}</Muted> : null}
      </Card>

      {tips.length ? (
        <View>
          <H2>Mga tip para sa resibong ito</H2>
          {tips.map((t) => (
            <InsightCard key={t.id} insight={t} />
          ))}
        </View>
      ) : null}

      {checksOut ? (
        <ExplainReceipt context={receiptContext({ merchant, date: parsed.date, items, totalCentavos }, tips)} />
      ) : (
        <Card>
          <H2>This photo is hard to read</H2>
          <Muted style={{ marginBottom: S.sm }}>
            The items don&apos;t add up to the TOTAL yet. Fix the TOTAL above, remove wrong items, try Read with phone AI, or keep just the total.
          </Muted>
          <Button label="Save total only" icon="receipt" variant="secondary" onPress={() => setItems([])} />
        </Card>
      )}

      {groups.length ? (
        <Card>
          <H2>Breakdown</H2>
          {groups
            .filter((g) => g.centavos > 0)
            .map((g) => (
              <BarRow key={g.group} label={g.label} value={formatPeso(g.centavos)} note={formatPct(g.share)} fraction={g.share} />
            ))}
        </Card>
      ) : null}

      <Card>
        <H2>Items ({items.length})</H2>
        {items.map((it, i) => (
          <View key={`${it.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2, gap: S.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: C.text }}>{it.name}</Text>
              {it.quantity !== 1 ? <Muted>{it.quantity} × {formatPeso(Math.round(it.lineTotalCentavos / it.quantity), { showCentavos: true })}</Muted> : null}
            </View>
            <Text style={{ fontSize: 14, color: C.text, fontWeight: "600" }}>{formatPeso(it.lineTotalCentavos, { showCentavos: true })}</Text>
            <Pressable accessibilityLabel={`Remove ${it.name}`} onPress={() => setItems(items.filter((_, j) => j !== i))} hitSlop={12}>
              <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <H2>Save as</H2>
        <View style={[styles.wrap, { marginBottom: S.md }]}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip key={c} label={EXPENSE_INFO[c].label} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <Button label={`Save ${formatPeso(totalCentavos)}`} icon="checkmark" onPress={save} disabled={totalCentavos <= 0} />
      </Card>

      <RawText rows={parsed.rows} />
    </View>
  );
}

const CURRENCIES = Object.keys(FX.phpPerUnit) as CurrencyCode[];

function TravelerResult({ ocr }: { ocr: OcrResult }) {
  const { settings, setSettings } = useStore();
  const today = todayISO();
  const receipt: ScannedReceipt | null = useMemo(() => parseOcrReceipt(ocr.lines, today), [ocr, today]);
  const rows = useMemo(() => receipt?.rows ?? ocr.text.split("\n").filter(Boolean), [receipt, ocr]);
  const priced = useMemo(() => findPricedLines(rows, settings.currency), [rows, settings.currency]);
  const notes = useMemo(() => explainCharges(rows), [rows]);
  const target = settings.targetLang;
  const targetLabel = TRAVELER_LANGUAGES.find((l) => l.code === target)?.label ?? target;

  const [source, setSource] = useState<string | null>(null);
  const [langs, setLangs] = useState<string[] | null>(null);
  const [translated, setTranslated] = useState<{ lang: string; labels: string[]; text: string; notes: ChargeNote[]; ms: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "downloading" | "translating">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectLanguage(rows.join("\n")).then(setSource);
    downloadedLanguages().then(setLangs);
  }, [rows]);

  // Packs needed: the scanned text's language and the target (English ships with ML Kit).
  const needed = source ? [...new Set([source, target])].filter((l) => l !== "en") : [];
  const packsReady = langs !== null && needed.every((l) => langs.includes(l));
  const sameLanguage = source === target;

  const runTranslate = useCallback(async () => {
    if (!source || sameLanguage) return;
    setError(null);
    setPhase("translating");
    try {
      // Two calls in total: scanned text (detected language → target) and the English notes (→ target).
      const main = await translateTexts([...priced.map((p) => p.label), rows.join("\n")], source, target);
      const noteTexts = notes.flatMap((n) => [n.title, n.body]);
      const nt = target === "en" || noteTexts.length === 0 ? { texts: noteTexts, ms: 0 } : await translateTexts(noteTexts, "en", target);
      setTranslated({
        lang: target,
        labels: main.texts.slice(0, priced.length),
        text: main.texts[priced.length] ?? "",
        notes: notes.map((n, i) => ({ ...n, title: nt.texts[i * 2] ?? n.title, body: nt.texts[i * 2 + 1] ?? n.body })),
        ms: main.ms + nt.ms,
      });
    } catch (e) {
      setError(`Translation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPhase("idle");
    }
  }, [source, sameLanguage, priced, rows, target, notes]);

  // Translate automatically as soon as the packs are on the phone.
  useEffect(() => {
    if (packsReady && !sameLanguage && source && translated?.lang !== target && phase === "idle" && !error) runTranslate();
  }, [packsReady, sameLanguage, source, target, translated, phase, error, runTranslate]);

  async function downloadPacks() {
    if (!source) return;
    setError(null);
    setPhase("downloading");
    try {
      await prepareTranslation(source, target);
      if (target !== "en") await prepareTranslation("en", target);
      setLangs(await downloadedLanguages());
    } catch (e) {
      setError(`Download failed: ${e instanceof Error ? e.message : String(e)}. Connect to Wi-Fi once; after that it works offline.`);
    } finally {
      setPhase("idle");
    }
  }

  const showTranslated = translated && translated.lang === target ? translated : null;
  const showNotes = showTranslated ? showTranslated.notes : notes;

  return (
    <View>
      {receipt?.totalFound ? (
        <Card style={{ backgroundColor: C.brandSoft, borderColor: C.brandSoft }}>
          <Muted>Total</Muted>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.text }}>
            {formatPeso(receipt.totalCentavos, { showCentavos: true })}{" "}
            <Text style={{ fontSize: 20, color: C.brandStrong }}>{formatForeign(convertFromPhp(receipt.totalCentavos, settings.currency), settings.currency)}</Text>
          </Text>
        </Card>
      ) : null}

      <Card>
        <H2>Your language</H2>
        <View style={[styles.wrap, { marginBottom: S.sm }]}>
          {TRAVELER_LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.label} selected={target === l.code} onPress={() => setSettings({ targetLang: l.code })} />
          ))}
        </View>
        <Muted>
          {source ? `Detected on this phone: ${source === "tl" ? "Filipino / Tagalog" : source.toUpperCase()}. ` : "Detecting language… "}
          {sameLanguage ? "Already in your language." : phase === "translating" ? "Translating…" : showTranslated ? `Translated on-device in ${(showTranslated.ms / 1000).toFixed(1)}s.` : ""}
        </Muted>
        {!sameLanguage && source && !packsReady ? (
          <View style={{ marginTop: S.sm }}>
            <Button label={phase === "downloading" ? `Downloading ${targetLabel} pack…` : `Get ${targetLabel} pack (one time, ~30 MB)`} icon="cloud-download" onPress={downloadPacks} busy={phase === "downloading"} />
          </View>
        ) : null}
        {error ? <View style={{ marginTop: S.sm }}><ErrorBox message={error} /></View> : null}
      </Card>

      {priced.length ? (
        <Card>
          <H2>Prices</H2>
          {priced.map((p, i) => (
            <View key={`${p.label}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2, gap: S.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: C.text, fontWeight: "600" }}>{showTranslated?.labels[i] ?? p.label}</Text>
                {showTranslated && showTranslated.labels[i] !== p.label ? <Muted>{p.label}</Muted> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 15, color: C.brandStrong, fontWeight: "700" }}>{p.converted}</Text>
                <Muted>{formatPeso(p.centavos, { showCentavos: true })}</Muted>
              </View>
            </View>
          ))}
          <View style={[styles.wrap, { marginTop: S.md }]}>
            {CURRENCIES.map((c) => (
              <Chip key={c} label={c} selected={settings.currency === c} onPress={() => setSettings({ currency: c })} />
            ))}
          </View>
          <Muted style={{ marginTop: S.sm }}>Approximate, using {FX.source}. Money changers and cards use different rates.</Muted>
        </Card>
      ) : null}

      {showNotes.length ? (
        <View>
          <H2>Good to know</H2>
          {showNotes.map((n) => (
            <InsightCard key={n.id} insight={{ id: n.id, severity: "info", title: n.title, body: n.body }} />
          ))}
        </View>
      ) : null}

      {showTranslated?.text ? (
        <Card>
          <H2>Full translation</H2>
          <Text style={{ fontSize: 14, color: C.text, lineHeight: 21 }}>{showTranslated.text}</Text>
        </Card>
      ) : null}

      <RawText rows={rows} />
    </View>
  );
}
