import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BarRow, Button, Card, Chip, ErrorBox, H2, InsightCard, Muted, Pill, styles } from "../components";
import { hubReceipt } from "../hub";
import { recognizeText, translate, TRAVELER_LANGUAGES, type OcrResult } from "../native";
import {
  breakdownReceipt,
  checkReceipt,
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
              <Button label="Scan another" icon="refresh" variant="ghost" onPress={reset} />
            </View>
          </View>
        </Card>
      )}

      {error ? <ErrorBox message={error} /> : null}

      {ocr && ocr.text.trim() ? (
        mode === "worker" ? (
          <WorkerResult key={imageUri ?? ""} ocr={ocr} imageBase64={imageBase64} onSaved={() => { reset(); onSaved(); }} />
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

function WorkerResult({ ocr, imageBase64, onSaved }: { ocr: OcrResult; imageBase64: string | null; onSaved: () => void }) {
  const { data, update, settings } = useStore();
  const [hubBusy, setHubBusy] = useState(false);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const today = todayISO();
  const parsed = useMemo(() => parseOcrReceipt(ocr.lines, today), [ocr, today]);
  const [items, setItems] = useState<ReceiptItem[]>(parsed?.items ?? []);
  const [totalText, setTotalText] = useState(parsed ? (parsed.totalCentavos / 100).toFixed(2) : "");
  const [merchant, setMerchant] = useState(parsed?.merchant ?? "Receipt");
  const [category, setCategory] = useState<ExpenseCategory>("food");

  const totalCentavos = Number.isFinite(Number(totalText)) && Number(totalText) > 0 ? toCentavos(Number(totalText)) : 0;
  const check = useMemo(() => checkReceipt(items, totalCentavos).check, [items, totalCentavos]);
  const groups = useMemo(() => breakdownReceipt(items), [items]);
  const tips = useMemo(
    () =>
      parsed
        ? receiptTips({ merchant, date: parsed.date, items, totalCentavos, vatCentavos: parsed.vatCentavos, check, totalFound: parsed.totalFound }, data.receipts)
        : [],
    [parsed, merchant, items, totalCentavos, check, data.receipts],
  );

  if (!parsed) return <ErrorBox message="This doesn't look like a receipt. Try Traveler mode for menus and signs." />;

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
      <Pill label="Items add up to the TOTAL ✓" tone="good" icon="checkmark-circle" />
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
        {settings.hubUrl && imageBase64 ? (
          <View style={{ marginTop: S.md }}>
            <Button label="Double-check with Hub AI" icon="laptop" variant="secondary" onPress={doubleCheckWithHub} busy={hubBusy} />
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
  const rows = receipt?.rows ?? ocr.text.split("\n");
  const priced = useMemo(() => findPricedLines(rows, settings.currency), [rows, settings.currency]);
  const notes = useMemo(() => explainCharges(rows), [rows]);
  const source = ocr.languages.includes("tl") || ocr.languages.includes("fil") ? "tl" : "en";

  const [translated, setTranslated] = useState<{ text: string; notes: ChargeNote[]; ms: number; lang: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTranslate() {
    setBusy(true);
    setError(null);
    try {
      const target = settings.targetLang;
      const main = await translate(rows.join("\n"), source, target);
      const tn: ChargeNote[] = [];
      let ms = main.ms;
      for (const n of notes) {
        const t = await translate(`${n.title}\n${n.body}`, "en", target);
        ms += t.ms;
        const [title, ...body] = t.text.split("\n");
        tn.push({ ...n, title, body: body.join(" ") });
      }
      setTranslated({ text: main.text, notes: tn, ms, lang: target });
    } catch (e) {
      setError(
        `Translation failed: ${e instanceof Error ? e.message : String(e)}. The first use of a language downloads its on-device pack once, so connect to the internet one time, then it works offline.`,
      );
    } finally {
      setBusy(false);
    }
  }

  const showNotes = translated && translated.lang === settings.targetLang ? translated.notes : notes;

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
        <H2>Convert to</H2>
        <View style={styles.wrap}>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} selected={settings.currency === c} onPress={() => setSettings({ currency: c })} />
          ))}
        </View>
        <Muted style={{ marginTop: S.sm }}>
          Approximate, using {FX.source}. Money changers and cards use different rates.
        </Muted>
      </Card>

      {priced.length ? (
        <Card>
          <H2>Prices found</H2>
          {priced.map((p, i) => (
            <View key={`${p.label}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surface2, gap: S.sm }}>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{p.label}</Text>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: "600" }}>
                {formatPeso(p.centavos, { showCentavos: true })} <Text style={{ color: C.brandStrong }}>{p.converted}</Text>
              </Text>
            </View>
          ))}
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

      <Card>
        <H2>Translate on this phone</H2>
        <View style={[styles.wrap, { marginBottom: S.md }]}>
          {TRAVELER_LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.label} selected={settings.targetLang === l.code} onPress={() => setSettings({ targetLang: l.code })} />
          ))}
        </View>
        <Button label="Translate" icon="language" onPress={runTranslate} busy={busy} />
        {error ? <View style={{ marginTop: S.sm }}><ErrorBox message={error} /></View> : null}
        {translated && translated.lang === settings.targetLang ? (
          <View style={{ marginTop: S.md }}>
            <Pill label={`Translated on-device in ${(translated.ms / 1000).toFixed(1)}s · ML Kit`} tone="good" icon="phone-portrait" />
            <Text style={{ marginTop: S.sm, fontSize: 14, color: C.text, lineHeight: 21 }}>{translated.text}</Text>
          </View>
        ) : null}
      </Card>

      <RawText rows={rows} />
    </View>
  );
}
