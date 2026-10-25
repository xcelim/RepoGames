import '@/web/frame';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';

import { loadAllOfficial } from '@/api/official';
import { startSyncEngine } from '@/cloud/engine';
import { startConnectionWatcher, useOnline } from '@/cloud/net';
import { fetchCommunity, restoreSession } from '@/cloud/sync';
import { useStore } from '@/store/useStore';
import { loadFonts } from '@/theme/fonts';
import { SKINS } from '@/theme/skins';
import { BootSplash } from '@/components/BootSplash';
import { CelebrationHost } from '@/components/Celebration';
import { SocialBoot } from '@/components/SocialBoot';
import { WebSidebar } from '@/components/WebSidebar';
import { Platform } from 'react-native';
import { useSkin } from '@/theme/useSkin';

SplashScreen.preventAutoHideAsync();

// Nube: detecta la conexión, recupera la sesión y arranca la sincronización.
function useCloud(enabled: boolean) {
  const online = useOnline();
  useEffect(() => {
    if (!enabled) return;
    const stopNet = startConnectionWatcher();
    let stopSync: (() => void) | null = null;
    restoreSession()
      .catch(() => undefined)
      .finally(() => {
        stopSync = startSyncEngine();
      });
    return () => {
      stopNet();
      stopSync?.();
    };
  }, [enabled]);
  useEffect(() => {
    if (enabled && online) {
      fetchCommunity();
      loadAllOfficial();
    }
  }, [enabled, online]);
}

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);

  // Solo se cargan las letras de la estética elegida (y de nuevo al cambiarla).
  const skinId = useStore((st) => st.skin);
  const [fontsFor, setFontsFor] = useState<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const f = SKINS[skinId]?.fonts ?? SKINS.neon.fonts;
    let alive = true;
    loadFonts([f.display, f.body, f.bodyBold])
      .catch(() => undefined)
      .finally(() => alive && setFontsFor(skinId));
    return () => {
      alive = false;
    };
  }, [hydrated, skinId]);
  const fontsLoaded = fontsFor !== null;
  const ready = fontsLoaded && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  const skin = useSkin();
  useCloud(ready);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: skin.colors.bg }}>
      <StatusBar style={skin.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: skin.colors.bg },
          animation: 'slide_from_right',
          // Las pantallas de debajo no se vuelven a pintar mientras no se ven.
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth-callback" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="list/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="game/[id]/index" />
        <Stack.Screen name="game/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="game/[id]/review" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="platinums" />
        <Stack.Screen name="platinum/[id]" />
        <Stack.Screen name="level" />
        <Stack.Screen name="showcases" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ranks" options={{ presentation: 'modal' }} />
        <Stack.Screen name="player-card" />
        <Stack.Screen name="roulette" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="group/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="wrapped" options={{ animation: 'fade' }} />
        <Stack.Screen name="steam" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="challenge/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="share-game" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="list/edit" />
        <Stack.Screen name="list/import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="library/[status]" />
        <Stack.Screen name="discover/[kind]" />
        <Stack.Screen name="list/pick" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
      </Stack>
      <CelebrationHost />
      <SocialBoot />
      {Platform.OS === 'web' ? <WebSidebar /> : null}
      <BootSplash />
    </GestureHandlerRootView>
  );
}
