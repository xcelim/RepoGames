import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect } from "expo-router";
import { useEffect } from "react";
import { Tabs } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CloudGate, OfflineBanner, useOfflineMode } from "@/components/offline";
import { ThemedText } from "@/components/ThemedText";
import { isCloudEnabled } from "@/cloud/supabase";
import { notify } from "@/utils/notify";
import type { IconName } from "@/components/ui";
import { useCurrentProfile, useStore } from "@/store/useStore";
import { useSkin } from "@/theme/useSkin";

// Las cuatro pestañas de IGN Playlist: Descubrir, Biblioteca, Listas y Perfil.
const TABS: {
  name: string;
  title: string;
  icon: IconName;
  iconActive: IconName;
}[] = [
  { name: "index", title: "DESCUBRIR", icon: "tv-outline", iconActive: "tv" },
  {
    name: "library",
    title: "BIBLIOTECA",
    icon: "library-outline",
    iconActive: "library",
  },
  {
    name: "lists",
    title: "LISTAS",
    icon: "albums-outline",
    iconActive: "albums",
  },
  {
    name: "profile",
    title: "PERFIL",
    icon: "person-circle-outline",
    iconActive: "person-circle",
  },
];

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (e: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
};

// Sin conexión, Descubrir se desactiva (y si estabas ahí, pasas a tu perfil).
const NEEDS_NET = new Set(["index"]);

function IgnTabBar({ state, navigation }: BarProps) {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const offline = useOfflineMode() && isCloudEnabled();
  const current = state.routes[state.index]?.name;
  useEffect(() => {
    if (offline && current && NEEDS_NET.has(current))
      navigation.navigate("profile");
  }, [offline, current, navigation]);
  return (
    <View>
      <OfflineBanner />
      <View
        style={[
          styles.bar,
          {
            backgroundColor: skin.colors.bg,
            borderTopColor: skin.colors.line,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          const disabled = offline && NEEDS_NET.has(route.name);
          const color = disabled
            ? skin.colors.line
            : focused
              ? skin.colors.text
              : skin.colors.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                if (disabled) {
                  notify("Sin conexión: solo puedes usar tu perfil");
                  return;
                }
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              <View
                style={[
                  styles.pill,
                  focused && { backgroundColor: skin.colors.panel2 },
                ]}
              >
                <Ionicons
                  name={focused ? tab.iconActive : tab.icon}
                  size={24}
                  color={color}
                />
                <ThemedText
                  variant={focused ? "bold" : "body"}
                  size={9}
                  style={{ color, letterSpacing: 0.6 }}
                >
                  {tab.title}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const skin = useSkin();
  const profile = useCurrentProfile();
  const cloudUserId = useStore((s) => s.cloudUserId);
  // Con Supabase hace falta haber entrado con una cuenta; sin él, basta un perfil en el móvil.
  if (isCloudEnabled() ? !cloudUserId : !profile)
    return <Redirect href="/welcome" />;

  return (
    <CloudGate>
      <Tabs
        tabBar={(props) => <IgnTabBar {...(props as unknown as BarProps)} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: skin.colors.bg },
          animation: "fade",
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: tab.title }}
          />
        ))}
      </Tabs>
    </CloudGate>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: "center" },
  pill: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 72,
  },
});
