import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AskScreen } from "./src/screens/AskScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { StoreProvider, useStore } from "./src/store";
import KitaNano from "./modules/kita-nano/src/KitaNanoModule";
import { C } from "./src/theme";

type Tab = "home" | "scan" | "ask" | "privacy";

const TABS: { id: Tab; label: string; icon: ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "scan", label: "Scan", icon: "scan" },
  { id: "ask", label: "Kita AI", icon: "chatbubbles" },
  { id: "privacy", label: "Privacy", icon: "shield-checkmark" },
];

function Shell() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>("home");

  // Logged once at startup so on-device AI availability can be confirmed from adb logcat.
  useEffect(() => {
    if (!KitaNano) return console.log("[KitaNano] bridge missing");
    KitaNano.checkStatus()
      .then(async (s) => console.log(`[KitaNano] status=${s}`, s === "available" ? JSON.stringify(await KitaNano!.getInfo()) : ""))
      .catch((e) => console.log(`[KitaNano] error=${e?.message ?? e}`));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.brandStrong }}>
          Kita<Text style={{ color: C.text }}>PH</Text>
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.brandSoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Ionicons name="phone-portrait" size={13} color={C.brandStrong} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: C.brandStrong }}>On-device AI · offline OK</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {!ready ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={C.brand} />
        ) : tab === "home" ? (
          <HomeScreen onScan={() => setTab("scan")} />
        ) : tab === "scan" ? (
          <ScanScreen onSaved={() => setTab("home")} />
        ) : tab === "ask" ? (
          <AskScreen />
        ) : (
          <PrivacyScreen />
        )}
      </View>

      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={{ flex: 1, alignItems: "center", paddingVertical: 8, minHeight: 56 }}
            >
              <Ionicons name={active ? t.icon : (`${t.icon}-outline` as ComponentProps<typeof Ionicons>["name"])} size={22} color={active ? C.brand : C.muted} />
              <Text style={{ fontSize: 11, marginTop: 2, color: active ? C.brand : C.muted, fontWeight: active ? "700" : "500" }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
