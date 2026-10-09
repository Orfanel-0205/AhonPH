import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Insight, Severity } from "./shared";
import { C, S } from "./theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.muted, style as object]}>{children}</Text>;
}

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.button, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={v.fg} /> : icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
      <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: C.brand, fg: "#ffffff", border: C.brand },
  secondary: { bg: C.surface, fg: C.brandStrong, border: C.border },
  ghost: { bg: "transparent", fg: C.brandStrong, border: "transparent" },
  danger: { bg: C.surface, fg: C.danger, border: C.border },
};

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: C.brand, borderColor: C.brand }]}
    >
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = "brand", icon }: { label: string; tone?: "brand" | Severity; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const TONES: Record<"brand" | Severity, { bg: string; fg: string; icon: IconName; label: string }> = {
  brand: { bg: C.brandSoft, fg: C.brandStrong, icon: "sparkles", label: "" },
  good: { bg: C.goodSoft, fg: C.good, icon: "checkmark-circle", label: "Good" },
  info: { bg: C.infoSoft, fg: C.info, icon: "information-circle", label: "Info" },
  warning: { bg: C.warnSoft, fg: C.warn, icon: "warning", label: "Heads up" },
  danger: { bg: C.dangerSoft, fg: C.danger, icon: "alert-circle", label: "Alert" },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const t = TONES[insight.severity];
  return (
    <View style={[styles.insight, { backgroundColor: t.bg }]}>
      <Ionicons name={t.icon} size={20} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.insightTitle, { color: t.fg }]}>
          {t.label} · {insight.title}
        </Text>
        <Text style={styles.insightBody}>{insight.body}</Text>
      </View>
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

/** One horizontal bar per row, single hue, value at the tip, label in text ink. */
export function BarRow({ label, value, fraction, note }: { label: string; value: string; fraction: number; note?: string }) {
  return (
    <View style={{ marginBottom: S.md }} accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ""}`}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue}>
          {value}
          {note ? <Text style={styles.muted}> · {note}</Text> : null}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, fraction * 100))}%` }]} />
      </View>
    </View>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={[styles.insight, { backgroundColor: C.dangerSoft }]}>
      <Ionicons name="alert-circle" size={20} color={C.danger} />
      <Text style={[styles.insightBody, { flex: 1 }]}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: S.lg, marginBottom: S.md },
  h2: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: S.sm },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.sm, borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: S.lg, minHeight: 48 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingVertical: 7, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  chipText: { fontSize: 13, color: C.text, fontWeight: "500" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "600" },
  insight: { flexDirection: "row", gap: S.sm, borderRadius: 12, padding: S.md, marginBottom: S.sm },
  insightTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  insightBody: { fontSize: 14, color: C.text, lineHeight: 20 },
  stat: { flexBasis: "47%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: S.md },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "700", color: C.text, marginTop: 2, fontVariant: ["tabular-nums"] },
  statSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  barHeader: { flexDirection: "row", justifyContent: "space-between", gap: S.sm, marginBottom: 4 },
  barLabel: { flex: 1, fontSize: 14, color: C.text },
  barValue: { fontSize: 14, color: C.text, fontWeight: "600", fontVariant: ["tabular-nums"] },
  barTrack: { height: 8, backgroundColor: C.surface2, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: C.brand, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: S.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  label: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: S.xs },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface, paddingHorizontal: S.md, paddingVertical: 10, fontSize: 15, color: C.text, minHeight: 48 },
  screen: { padding: S.lg, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: "800", color: C.text },
});
