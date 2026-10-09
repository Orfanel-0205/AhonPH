import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Chip, H2, Muted, styles } from "./components";
import { useLocalAI } from "./localAI";
import { phoneDayTips } from "./nanoEngine";
import {
  addDays,
  ASPECTS,
  CITIES,
  convertToPhp,
  formatCurrency,
  formatTripPeso,
  planFacts,
  planTrip,
  TIERS,
  todayISO,
  type Aspect,
  type Tier,
} from "./shared";
import { useStore } from "./store";
import { C, S } from "./theme";

const COUNTRIES = [...new Set(CITIES.map((c) => c.country))];

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: S.md }}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel={`Fewer ${label}`} hitSlop={8} style={stepBtn}>
          <Text style={{ fontSize: 20, color: C.brandStrong, fontWeight: "800" }}>−</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, minWidth: 24, textAlign: "center" }}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel={`More ${label}`} hitSlop={8} style={stepBtn}>
          <Text style={{ fontSize: 20, color: C.brandStrong, fontWeight: "800" }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
const stepBtn = { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border, alignItems: "center" as const, justifyContent: "center" as const };

/**
 * Plan a trip: pick where, how long and what you like; compare Tipid / Sakto / Bongga in pesos; get a
 * day-by-day plan; turn it into the live trip budget. Places and costs are bundled estimates (offline).
 */
export function PlannerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings } = useStore();
  const ai = useLocalAI();
  const saved = settings.itinerary;
  const [cityId, setCityId] = useState(saved?.cityId ?? "tokyo");
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  const [country, setCountry] = useState(city.country);
  const [days, setDays] = useState(saved?.days ?? 4);
  const [travelers, setTravelers] = useState(saved?.travelers ?? 2);
  const [aspects, setAspects] = useState<Aspect[]>((saved?.aspects as Aspect[]) ?? ["food", "culture", "views"]);
  const [tier, setTier] = useState<Tier>(saved?.tier ?? 2);
  const [start, setStart] = useState(addDays(todayISO(), 1));
  const [tips, setTips] = useState<{ key: string; map: Map<number, string>; ms: number } | null>(null);
  const [tipsBusy, setTipsBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const plans = useMemo(() => TIERS.map((t) => planTrip(city, days, t.id, aspects, travelers)), [city, days, aspects, travelers]);
  const plan = plans[tier - 1];
  const planKey = `${city.id}-${days}-${tier}-${aspects.join(",")}`;
  const local = (n: number) => formatCurrency(n, city.currency);
  const pesos = (n: number) => formatTripPeso(convertToPhp(n, city.currency));

  function toggleAspect(a: Aspect) {
    setAspects((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function dayTips() {
    setTipsBusy(true);
    setMsg(null);
    try {
      const r = await phoneDayTips(planFacts(plan), plan.days.map((d) => d.places.map((p) => p.name)));
      setTips({ key: planKey, map: r.tips, ms: r.ms });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTipsBusy(false);
    }
  }

  function useAsBudget() {
    setSettings({
      trip: { name: city.name, currency: city.currency, budgetCentavos: convertToPhp(plan.totals.pocket, city.currency), start, end: addDays(start, days - 1) },
      tripCurrency: city.currency,
      itinerary: { cityId: city.id, tier, aspects, days, travelers },
    });
    onClose();
  }

  function share() {
    const lines = plan.days.map((d) => `Day ${d.day} · ${d.area}: ${d.places.map((p) => p.name).join(", ") || "free day"}`);
    Share.share({
      message: `${city.name} · ${days} days · ${TIERS[tier - 1].label}\n${lines.join("\n")}\nPocket money about ${pesos(plan.totals.pocket)} per person + hotel about ${pesos(plan.totals.hotel)}\n— planned offline with LakbayMate`,
    });
  }

  const shownTips = tips?.key === planKey ? tips : null;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={[styles.screen, { paddingTop: S.lg }]}>
          <Text style={styles.title}>🗺️ Plan a trip</Text>
          <Muted style={{ marginBottom: S.md }}>Pick where and what you like. Works offline; prices are estimates to plan with.</Muted>

          <Card>
            <H2>Saan? · Where</H2>
            <View style={styles.wrap}>
              {COUNTRIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={country === c}
                  onPress={() => {
                    setCountry(c);
                    setCityId(CITIES.find((x) => x.country === c)!.id);
                  }}
                />
              ))}
            </View>
            <View style={[styles.wrap, { marginTop: S.sm }]}>
              {CITIES.filter((c) => c.country === country).map((c) => (
                <Chip key={c.id} label={`📍 ${c.name}`} selected={cityId === c.id} onPress={() => setCityId(c.id)} />
              ))}
            </View>
            <View style={{ marginTop: S.sm }}>
              <Stepper label="Days" value={days} min={1} max={10} onChange={setDays} />
              <Stepper label="Travelers" value={travelers} min={1} max={8} onChange={setTravelers} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, marginTop: S.sm, marginBottom: S.xs }}>Gusto mo · What you like</Text>
            <View style={styles.wrap}>
              {ASPECTS.map((a) => (
                <Chip key={a.id} label={`${a.emoji} ${a.label}`} selected={aspects.includes(a.id)} onPress={() => toggleAspect(a.id)} />
              ))}
            </View>
          </Card>

          <H2>Magkano? · Per person</H2>
          <View style={{ flexDirection: "row", gap: S.sm, marginBottom: S.md }}>
            {plans.map((p, i) => {
              const t = TIERS[i];
              const sel = tier === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTier(t.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label}, ${pesos(p.totals.all)} per person`}
                  style={{ flex: 1, padding: S.md, borderRadius: 14, borderWidth: sel ? 2 : 1, borderColor: sel ? C.brand : C.border, backgroundColor: sel ? C.brandSoft : C.surface }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }}>{t.label}</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>{t.sub}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: C.brandStrong, marginTop: 6 }}>{pesos(p.totals.all)}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{days === 1 ? "day trip" : "with hotel"}</Text>
                </Pressable>
              );
            })}
          </View>

          <Card>
            <H2>
              {city.name} · {days} day{days === 1 ? "" : "s"} · {TIERS[tier - 1].label}
            </H2>
            {plan.days.map((d) => (
              <View key={d.day} style={{ paddingVertical: S.sm, borderTopWidth: 1, borderTopColor: C.surface2 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }}>
                  Day {d.day} · {d.area}
                </Text>
                {d.places.length ? (
                  d.places.map((p) => (
                    <View key={p.name} style={{ flexDirection: "row", justifyContent: "space-between", gap: S.sm, marginTop: 4 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: C.text }}>
                          {p.name} <Text style={{ color: C.muted }}>{p.local !== p.name ? p.local : ""}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: C.muted }}>{p.note}</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: C.text, fontWeight: "600" }}>{p.fee ? `about ${local(p.fee)}` : "Free"}</Text>
                    </View>
                  ))
                ) : (
                  <Muted>Free day: rest, wander, or go back to a favourite.</Muted>
                )}
                {shownTips?.map.get(d.day) ? <Text style={{ fontSize: 13, color: C.brandStrong, marginTop: 4 }}>✨ {shownTips.map.get(d.day)}</Text> : null}
              </View>
            ))}

            <View style={{ marginTop: S.sm, padding: S.md, borderRadius: 12, backgroundColor: C.surface2, gap: 2 }}>
              <Text style={{ fontSize: 14, color: C.text }}>
                Tickets {local(plan.totals.activities)} · Food {local(plan.totals.food)} · Transport {local(plan.totals.transport)}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: C.text }}>
                Pocket money {pesos(plan.totals.pocket)} <Text style={{ fontSize: 13, color: C.muted }}>({local(plan.totals.pocket)}) per person</Text>
              </Text>
              <Text style={{ fontSize: 14, color: C.text }}>
                {days === 1
                  ? "Day trip or layover: no hotel."
                  : `Hotel about ${pesos(plan.totals.hotel)} per person (${Math.ceil(travelers / 2)} room${Math.ceil(travelers / 2) === 1 ? "" : "s"}, ${days - 1} night${days - 1 === 1 ? "" : "s"})`}
              </Text>
              <Muted>Estimates for 2026 computed by code from bundled prices; flights not included. Check prices before you go.</Muted>
            </View>

            {ai.available ? (
              <View style={{ marginTop: S.sm }}>
                {shownTips ? (
                  <Muted>
                    ✨ {shownTips.map.size} of {plan.days.length} day tips by {ai.name} in {(shownTips.ms / 1000).toFixed(1)}s {ai.where}. Tips must name that day's places and carry no prices; prices come from code.
                  </Muted>
                ) : (
                  <Button label={`✨ Tips for each day (${ai.name})`} variant="secondary" onPress={dayTips} busy={tipsBusy} />
                )}
                {msg ? <Muted>{msg}</Muted> : null}
              </View>
            ) : null}
          </Card>

          <Card>
            <H2>Kailan? · Starts</H2>
            <View style={styles.wrap}>
              {[
                { label: "Today", value: todayISO() },
                { label: "Tomorrow", value: addDays(todayISO(), 1) },
                { label: "In a week", value: addDays(todayISO(), 7) },
              ].map((o) => (
                <Chip key={o.label} label={o.label} selected={start === o.value} onPress={() => setStart(o.value)} />
              ))}
            </View>
            <View style={{ gap: S.sm, marginTop: S.md }}>
              <Button label={`Use as my trip budget · ${pesos(plan.totals.pocket)}`} icon="airplane" onPress={useAsBudget} />
              <Button label="Share the plan" icon="share-social" variant="secondary" onPress={share} />
              <Button label="Close" icon="close" variant="ghost" onPress={onClose} />
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
