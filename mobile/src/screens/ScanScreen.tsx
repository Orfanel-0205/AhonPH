import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BarRow, Button, Card, Chip, ErrorBox, H2, InsightCard, Muted, Pill, styles } from "../components";
import { ExplainReceipt, receiptContext } from "../ExplainReceipt";
import { hubReceipt } from "../hub";
import { phoneReadMenu, phoneReadReceipt } from "../nanoEngine";
import { useNano } from "../nanoStore";
import { expectedScript, recognizeAnyScript, recognizeText, SCRIPT_LABEL, type OcrResult } from "../native";
import { detectLanguage, downloadedLanguages, prepareTranslation, translateTexts, TRAVELER_LANGUAGES } from "../onDevice";
import {
  breakdownReceipt,
  checkReceipt,
  checkReceiptWithSubtotal,
  convertFromPhp,
  EXPENSE_CATEGORIES,
  EXPENSE_INFO,
  explainCharges,
  findPrices,
  detectCurrency,
  convertToPhp,
  formatCurrency,
  formatDate,
  formatForeign,
  formatPct,
  formatPeso,
  FX,
  roundToPeso,
  isNanoLang,
  linesToRows,
  MENU_MAX_LINES,
  parseForeignReceipt,
  parseOcrReceipt,
  receiptTips,
  toCentavos,
  todayISO,
  type ChargeNote,
  type CurrencyCode,
  type ExpenseCategory,
  type MenuReading,
  type ReceiptItem,
  type ScannedReceipt,
} from "../shared";
import { TripCard } from "../TripBudget";
import { newId, useStore } from "../store";
import { C, S } from "../theme";

type Mode = "worker" | "traveler";

export function ScanScreen({ onSaved }: { onSaved: () => void }) {
  const { settings } = useStore();
  // On a trip, menus and signs come first; at home, receipts.
  const [mode, setMode] = useState<Mode>(settings.trip ? "traveler" : "worker");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  /** Size of the photo a cloud OCR service would have needed; LakbayMate uploads none of it. */
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
      const result =
        mode === "traveler" ? await recognizeAnyScript(uri, expectedScript(settings.themLang, settings.tripCurrency)) : await recognizeText(uri);
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
              {ocr ? (
                <Pill
                  label={`Read on-device in ${(ocr.ms / 1000).toFixed(1)}s · ML Kit${ocr.script && ocr.script !== "latin" ? ` (${SCRIPT_LABEL[ocr.script]})` : ""}`}
                  tone="good"
                  icon="phone-portrait"
                />
              ) : null}
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
/** Currencies printed without centavos, where "2.000" is a misread "2,000". */
const WHOLE_NUMBER_CURRENCIES: CurrencyCode[] = ["JPY", "KRW", "TWD", "VND", "IDR"];
const SAVE_CATEGORIES: ExpenseCategory[] = ["food", "transport", "leisure", "personal", "other"];
const TARGETS = [{ code: "tl", label: "Filipino" }, ...TRAVELER_LANGUAGES];

function TravelerResult({ ocr }: { ocr: OcrResult }) {
  const { settings, setSettings, update } = useStore();
  const today = todayISO();
  const receipt: ScannedReceipt | null = useMemo(() => parseOcrReceipt(ocr.lines, today), [ocr, today]);
  // A menu has no TOTAL, so the receipt parser gives up; rows still pair each name with its price.
  const rows = useMemo(() => receipt?.rows ?? linesToRows(ocr.lines), [receipt, ocr]);
  // Prices are in the currency printed on the page, or the trip currency; null means pesos.
  const fromCurrency = useMemo(() => detectCurrency(rows.join(" ")) ?? settings.tripCurrency, [rows, settings.tripCurrency]);
  // A Filipino abroad sees pesos; a visitor in the Philippines sees their own currency.
  const toCurrency = fromCurrency ? null : settings.currency;
  const priced = useMemo(() => findPrices(rows, fromCurrency, toCurrency), [rows, fromCurrency, toCurrency]);
  const notes = useMemo(() => (fromCurrency ? [] : explainCharges(rows)), [rows, fromCurrency]);
  // A receipt abroad (合計 / 합계 / 合计): items with quantities, an add-up check, and a total to save.
  const abroad = useMemo(() => {
    if (!fromCurrency || receipt?.totalFound) return null;
    const r = parseForeignReceipt(rows, { wholeNumbers: WHOLE_NUMBER_CURRENCIES.includes(fromCurrency) });
    return r && r.items.length && (r.total !== null || r.subtotal !== null) ? r : null;
  }, [rows, fromCurrency, receipt]);
  // The names to translate and explain: receipt items, else priced menu lines.
  const names = useMemo(() => (abroad ? abroad.items.map((i) => i.name) : priced.map((p) => p.label)), [abroad, priced]);
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [savedAbroad, setSavedAbroad] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [target, setTarget] = useState<string>(settings.targetLang);
  const targetLabel = TARGETS.find((l) => l.code === target)?.label ?? target;

  const [source, setSource] = useState<string | null>(null);
  const [langs, setLangs] = useState<string[] | null>(null);
  const [translated, setTranslated] = useState<{ lang: string; labels: string[]; text: string; notes: ChargeNote[]; ms: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "downloading" | "translating">("idle");
  const [error, setError] = useState<string | null>(null);
  const nano = useNano();
  const [menu, setMenu] = useState<{ readings: Map<number, MenuReading>; ms: number } | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  // Item names on a receipt or menu; otherwise the first lines (a sign).
  const menuLines = useMemo(() => (names.length ? names : rows).slice(0, MENU_MAX_LINES), [names, rows]);

  /** Gemini Nano reads the menu from the original text; notes are put into Filipino on the phone if needed. */
  async function readMenu() {
    if (!source || menuBusy) return;
    setMenuBusy(true);
    try {
      const started = Date.now();
      const r = await phoneReadMenu(menuLines, source, (readings) => setMenu({ readings, ms: Date.now() - started }));
      if (settings.meLang === "tl" && r.readings.size) {
        const keys = [...r.readings.keys()].filter((k) => r.readings.get(k)!.note);
        const t = keys.length ? await translateTexts(keys.map((k) => r.readings.get(k)!.note), "en", "tl") : { texts: [] };
        keys.forEach((k, i) => r.readings.set(k, { ...r.readings.get(k)!, note: t.texts[i] ?? r.readings.get(k)!.note }));
      }
      setMenu(r);
    } catch (e) {
      setError(`Gemini Nano couldn't read the menu: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMenuBusy(false);
    }
  }

  // Japanese, Korean and Chinese menus: Gemini Nano reads them right away (the offline translator mangles dish names).
  useEffect(() => {
    if (source && isNanoLang(source) && nano.status === "available" && !menu && !menuBusy && menuLines.length) readMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, nano.status]);

  useEffect(() => {
    detectLanguage(rows.join("\n")).then((src) => {
      setSource(src);
      // A menu in Japanese, Korean... is read in the traveler's own language by default.
      if (src !== "tl" && src !== "en") setTarget(settings.meLang);
    });
    downloadedLanguages().then(setLangs);
    // Only when a new scan arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const main = await translateTexts([...names, rows.join("\n")], source, target);
      const noteTexts = notes.flatMap((n) => [n.title, n.body]);
      const nt = target === "en" || noteTexts.length === 0 ? { texts: noteTexts, ms: 0 } : await translateTexts(noteTexts, "en", target);
      setTranslated({
        lang: target,
        labels: main.texts.slice(0, names.length),
        text: main.texts[names.length] ?? "",
        notes: notes.map((n, i) => ({ ...n, title: nt.texts[i * 2] ?? n.title, body: nt.texts[i * 2 + 1] ?? n.body })),
        ms: main.ms + nt.ms,
      });
    } catch (e) {
      setError(`Translation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPhase("idle");
    }
  }, [source, sameLanguage, names, rows, target, notes]);

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
  const nameAt = (i: number) => menu?.readings.get(i)?.name ?? showTranslated?.labels[i] ?? names[i];
  const noteAt = (i: number) => menu?.readings.get(i)?.note || null;
  const canExplain = nano.status === "available" && !!source && source !== "tl" && menuLines.length > 0;
  const nanoLine = !canExplain
    ? null
    : menuBusy
      ? `✨ Gemini Nano is reading on this phone… ${menu?.readings.size ?? 0} of ${menuLines.length}`
      : menu
        ? `✨ Names by Gemini Nano · ${menu.readings.size} of ${menuLines.length} in ${(menu.ms / 1000).toFixed(1)}s on this phone`
        : null;
  const local = (amount: number) => (fromCurrency ? formatCurrency(amount, fromCurrency) : formatPeso(Math.round(amount * 100)));
  const inPesos = (amount: number) => (fromCurrency ? `≈${formatPeso(roundToPeso(convertToPhp(amount, fromCurrency)))}` : "");

  function saveAbroad() {
    if (!abroad || !fromCurrency) return;
    const amount = abroad.total ?? abroad.subtotal ?? abroad.check.itemsSum;
    const id = newId("rc");
    const merchant = abroad.store ?? "Receipt";
    update((d) => ({
      ...d,
      receipts: [
        {
          id,
          merchant,
          date: today,
          items: abroad.items.map((it, i) => ({
            name: nameAt(i) !== it.name ? `${nameAt(i)} (${it.name})` : it.name,
            quantity: it.quantity,
            lineTotalCentavos: convertToPhp(it.total, fromCurrency),
          })),
          totalCentavos: convertToPhp(amount, fromCurrency),
        },
        ...d.receipts,
      ],
      transactions: [
        {
          id: newId("tx"),
          type: "expense",
          category,
          description: `${merchant} (${formatCurrency(amount, fromCurrency)})`.slice(0, 80),
          amountCentavos: convertToPhp(amount, fromCurrency),
          date: today,
          source: "receipt",
          receiptId: id,
        },
        ...d.transactions,
      ],
    }));
    setSavedAbroad(true);
  }

  const itemRow = (key: string, i: number, original: string, right: ReactNode) => (
    <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2, gap: S.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: C.text, fontWeight: "700" }}>{nameAt(i)}</Text>
        {noteAt(i) ? <Text style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{noteAt(i)}</Text> : null}
        {nameAt(i) !== original ? <Muted>{original}</Muted> : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>{right}</View>
    </View>
  );

  return (
    <View>
      {abroad && fromCurrency ? (
        <Card>
          <Muted>{abroad.store ? `${abroad.store} · ` : ""}Receipt</Muted>
          <Text style={{ fontSize: 30, fontWeight: "800", color: C.text, fontVariant: ["tabular-nums"] }}>
            {local(abroad.total ?? abroad.subtotal ?? 0)} <Text style={{ fontSize: 20, color: C.brandStrong }}>{inPesos(abroad.total ?? abroad.subtotal ?? 0)}</Text>
          </Text>
          <Muted>
            {[abroad.tax !== null ? `includes tax ${local(abroad.tax)}` : null, abroad.payment ? `paid by ${abroad.payment}` : null].filter(Boolean).join(" · ")}
          </Muted>
          <View style={{ marginTop: S.sm }}>
            {abroad.totalRead !== undefined ? (
              <View style={{ marginBottom: S.xs }}>
                <Pill
                  label={`Total corrected: the camera read ${local(abroad.totalRead)} (the ¥ sign looked like a digit); ${local(abroad.total ?? 0)} matches subtotal + tax.`}
                  tone="info"
                  icon="construct"
                />
              </View>
            ) : null}
            {abroad.check.status === "ok" ? (
              <Pill label={`✓ ${abroad.items.length} items add up to the ${abroad.check.against} ${local(abroad.check.printed ?? 0)}`} tone="good" icon="checkmark-circle" />
            ) : abroad.check.status === "mismatch" ? (
              <Pill
                label={`Items add up to ${local(abroad.check.itemsSum)}, the receipt says ${local(abroad.check.printed ?? 0)}. Check the photo.`}
                tone="warning"
                icon="warning"
              />
            ) : null}
          </View>
          {nanoLine ? <Muted style={{ marginTop: S.sm }}>{nanoLine}</Muted> : null}
          <View style={{ marginTop: S.xs }}>
            {abroad.items.map((it, i) =>
              itemRow(
                `${it.name}-${i}`,
                i,
                it.name,
                <>
                  <Text style={{ fontSize: 15, color: C.text, fontWeight: "700" }}>{local(it.total)}</Text>
                  <Muted>{it.quantity !== 1 && it.unit !== null ? `${it.quantity} × ${local(it.unit)}` : inPesos(it.total)}</Muted>
                  {it.quantity !== 1 && it.unit !== null ? <Muted>{inPesos(it.total)}</Muted> : null}
                </>,
              ),
            )}
          </View>
          {savedAbroad ? (
            <View style={{ marginTop: S.md, gap: S.sm }}>
              <Pill label={`Saved ${inPesos(abroad.total ?? abroad.subtotal ?? 0)} · your budget is updated`} tone="good" icon="checkmark-circle" />
              <TripCard compact />
            </View>
          ) : (
            <View style={{ marginTop: S.md }}>
              <View style={[styles.wrap, { marginBottom: S.sm }]}>
                {SAVE_CATEGORIES.map((cat) => (
                  <Chip key={cat} label={EXPENSE_INFO[cat].label} selected={category === cat} onPress={() => setCategory(cat)} />
                ))}
              </View>
              <Button
                label={`${settings.trip ? "Save to trip budget" : "Save to Gastos"} · ${inPesos(abroad.total ?? abroad.subtotal ?? 0).replace("≈", "")}`}
                icon="checkmark"
                onPress={saveAbroad}
              />
            </View>
          )}
          <Muted style={{ marginTop: S.sm }}>Pesos at {FX.source}; your card or money changer may differ.</Muted>
        </Card>
      ) : receipt?.totalFound ? (
        <Card style={{ backgroundColor: C.brandSoft, borderColor: C.brandSoft }}>
          <Muted>Total</Muted>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.text }}>
            {fromCurrency ? formatCurrency(receipt.totalCentavos / 100, fromCurrency) : formatPeso(receipt.totalCentavos, { showCentavos: true })}{" "}
            <Text style={{ fontSize: 20, color: C.brandStrong }}>
              {fromCurrency
                ? `≈${formatPeso(convertToPhp(receipt.totalCentavos / 100, fromCurrency))}`
                : formatForeign(convertFromPhp(receipt.totalCentavos, settings.currency), settings.currency)}
            </Text>
          </Text>
        </Card>
      ) : null}

      {!abroad && priced.length ? (
        <Card>
          <H2>Prices</H2>
          {nanoLine ? <Muted style={{ marginBottom: S.xs }}>{nanoLine}</Muted> : null}
          {priced.map((p, i) =>
            itemRow(
              `${p.label}-${i}`,
              i,
              p.label,
              <>
                <Text style={{ fontSize: 15, color: C.brandStrong, fontWeight: "700" }}>{p.converted}</Text>
                <Muted>{p.printed}</Muted>
              </>,
            ),
          )}
          {fromCurrency ? (
            <Muted style={{ marginTop: S.sm }}>
              Prices read as {fromCurrency}
              {settings.tripCurrency === fromCurrency ? " (your trip currency)" : ""}, shown in pesos.
            </Muted>
          ) : (
            <View style={[styles.wrap, { marginTop: S.md }]}>
              {CURRENCIES.map((cur) => (
                <Chip key={cur} label={cur} selected={settings.currency === cur} onPress={() => setSettings({ currency: cur })} />
              ))}
            </View>
          )}
          <Muted style={{ marginTop: S.sm }}>Approximate, using {FX.source}. Money changers and cards use different rates.</Muted>
        </Card>
      ) : null}

      {!abroad && !priced.length && canExplain && menu?.readings.size ? (
        <Card>
          <H2>✨ Ano ito? · Gemini Nano</H2>
          {nanoLine ? <Muted style={{ marginBottom: S.xs }}>{nanoLine}</Muted> : null}
          {menuLines.map((l, i) => (menu.readings.get(i) ? itemRow(`${l}-${i}`, i, l, null) : null))}
        </Card>
      ) : null}

      {canExplain && !menu && !menuBusy ? (
        <View style={{ marginBottom: S.md }}>
          <Button label={names.length ? "✨ Explain these items (Gemini Nano)" : "✨ Explain this sign (Gemini Nano)"} variant="secondary" onPress={readMenu} />
        </View>
      ) : null}
      {canExplain && (menu || menuBusy) ? <Muted style={{ marginBottom: S.md }}>AI reading made on this phone. If you have allergies or avoid pork, ask the staff.</Muted> : null}

      {showNotes.length ? (
        <View>
          <H2>Good to know</H2>
          {showNotes.map((n) => (
            <InsightCard key={n.id} insight={{ id: n.id, severity: "info", title: n.title, body: n.body }} />
          ))}
        </View>
      ) : null}

      <Card>
        <Pressable onPress={() => setShowLangs((v) => !v)} accessibilityRole="button" style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>Isalin sa · Translate to: {targetLabel}</Text>
          <Text style={{ color: C.brandStrong, fontWeight: "700" }}>{showLangs ? "Done" : "Change"}</Text>
        </Pressable>
        {showLangs ? (
          <View style={[styles.wrap, { marginTop: S.sm }]}>
            {TARGETS.map((l) => (
              <Chip
                key={l.code}
                label={l.label}
                selected={target === l.code}
                onPress={() => {
                  setTarget(l.code);
                  if (l.code !== "tl") setSettings({ targetLang: l.code });
                }}
              />
            ))}
          </View>
        ) : null}
        <Muted style={{ marginTop: S.xs }}>
          {source ? `Detected on this phone: ${source === "tl" ? "Filipino / Tagalog" : source.toUpperCase()}. ` : "Detecting language… "}
          {sameLanguage ? "Already in your language." : phase === "translating" ? "Translating…" : showTranslated ? `Translated on-device in ${(showTranslated.ms / 1000).toFixed(1)}s.` : ""}
        </Muted>
        {!sameLanguage && source && !packsReady ? (
          <View style={{ marginTop: S.sm }}>
            <Button label={phase === "downloading" ? `Downloading ${targetLabel} pack…` : `Get ${targetLabel} pack (one time, ~30 MB)`} icon="cloud-download" onPress={downloadPacks} busy={phase === "downloading"} />
          </View>
        ) : null}
        {error ? (
          <View style={{ marginTop: S.sm }}>
            <ErrorBox message={error} />
          </View>
        ) : null}
        {showTranslated?.text && !menu?.readings.size ? <Text style={{ fontSize: 14, color: C.text, lineHeight: 21, marginTop: S.sm }}>{showTranslated.text}</Text> : null}
      </Card>

      <RawText rows={rows} />
    </View>
  );
}
