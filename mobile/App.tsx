import { Ionicons } from "@expo/vector-icons";
import { useNetworkState } from "expo-network";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { refreshHubAI, setNanoReady, setPreferHub } from "./src/localAI";
import { refreshNano, useNano } from "./src/nanoStore";
import { onSharedText } from "./src/onDevice";
import { AskScreen } from "./src/screens/AskScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { SetupScreen } from "./src/screens/SetupScreen";
import { TalkScreen } from "./src/screens/TalkScreen";
import { StoreProvider, useStore } from "./src/store";
import { C } from "./src/theme";

type Tab = "home" | "talk" | "scan" | "ask" | "privacy";
type IconName = ComponentProps<typeof Ionicons>["name"];

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "talk", label: "Usap", icon: "chatbox-ellipses" },
  { id: "scan", label: "Scan", icon: "scan" },
  { id: "ask", label: "Gastos", icon: "wallet" },
  { id: "privacy", label: "AI Lab", icon: "flask" },
];

/** Live connectivity, so the demo can show the app still working with the network off. */
function NetworkChip() {
  const net = useNetworkState();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  return (
    <View
      accessibilityLabel={offline ? "Offline. On-device AI still works." : "Online. AI runs on this device."}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: offline ? C.goodSoft : C.brandSoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}
    >
      <Ionicons name={offline ? "airplane" : "phone-portrait"} size={13} color={offline ? C.good : C.brandStrong} />
      <Text style={{ fontSize: 12, fontWeight: "700", color: offline ? C.good : C.brandStrong }}>{offline ? "Offline · AI still on" : "AI on this phone"}</Text>
    </View>
  );
}

function Shell() {
  const { ready, settings } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [setupOpen, setSetupOpen] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const nano = useNano();

  // The AI router: Gemini Nano when this phone has it, else the team laptop over local Wi-Fi.
  useEffect(() => setNanoReady(nano.status === "available"), [nano.status]);
  useEffect(() => {
    refreshHubAI(settings.hubUrl || null);
  }, [settings.hubUrl]);
  useEffect(() => setPreferHub(settings.aiEngine === "laptop"), [settings.aiEngine]);

  useEffect(() => {
    refreshNano();
    // A message shared from a chat app (e.g. the host's message) opens in Usap to read and answer.
    return onSharedText((text) => {
      setShared(text);
      setTab("talk");
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <ActivityIndicator color={C.brand} />
      </View>
    );
  }

  const showSetup = setupOpen || !settings.setupDone;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.brandStrong }}>
            Lakbay<Text style={{ color: C.text }}>Mate</Text>
          </Text>
          <Text style={{ fontSize: 11, color: C.muted, marginTop: -2 }}>Your Smart Travel Companion</Text>
        </View>
        <NetworkChip />
      </View>

      <View style={{ flex: 1 }}>
        {showSetup ? (
          <SetupScreen onDone={() => setSetupOpen(false)} />
        ) : tab === "home" ? (
          <HomeScreen onGo={setTab} />
        ) : tab === "talk" ? (
          <TalkScreen incoming={shared} onIncomingRead={() => setShared(null)} />
        ) : tab === "scan" ? (
          <ScanScreen onSaved={() => setTab("home")} />
        ) : tab === "ask" ? (
          <AskScreen onOpenSetup={() => setSetupOpen(true)} />
        ) : (
          <PrivacyScreen onOpenSetup={() => setSetupOpen(true)} />
        )}
      </View>

      {showSetup ? null : (
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
                <Ionicons name={active ? t.icon : (`${t.icon}-outline` as IconName)} size={22} color={active ? C.brand : C.muted} />
                <Text style={{ fontSize: 11, marginTop: 2, color: active ? C.brand : C.muted, fontWeight: active ? "700" : "500" }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
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
