import { Audiowide_400Regular } from '@expo-google-fonts/audiowide/400Regular';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { ChakraPetch_400Regular } from '@expo-google-fonts/chakra-petch/400Regular';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch/700Bold';
import { ChakraPetch_700Bold_Italic } from '@expo-google-fonts/chakra-petch/700Bold_Italic';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Lato_400Regular } from '@expo-google-fonts/lato/400Regular';
import { Lato_700Bold } from '@expo-google-fonts/lato/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p/400Regular';
import { Rajdhani_500Medium } from '@expo-google-fonts/rajdhani/500Medium';
import { Rajdhani_700Bold } from '@expo-google-fonts/rajdhani/700Bold';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import { useFonts } from 'expo-font';
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
  const [fontsLoaded] = useFonts({
    Audiowide_400Regular,
    Baloo2_700Bold,
    ChakraPetch_400Regular,
    ChakraPetch_700Bold,
    ChakraPetch_700Bold_Italic,
    Cinzel_700Bold,
    Fredoka_600SemiBold,
    Lato_400Regular,
    Lato_700Bold,
    Nunito_400Regular,
    Nunito_700Bold,
    Orbitron_700Bold,
    PressStart2P_400Regular,
    Rajdhani_500Medium,
    Rajdhani_700Bold,
    VT323_400Regular,
  });

  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);

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
        <Stack.Screen name="list/edit" />
        <Stack.Screen name="library/[status]" />
        <Stack.Screen name="discover/[kind]" />
        <Stack.Screen name="list/pick" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
