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
import { useEffect, useState } from 'react';

import { loadAllOfficial } from '@/api/official';
import { fetchCommunity, pushAll } from '@/cloud/sync';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';

SplashScreen.preventAutoHideAsync();

// Con Supabase conectado: sube los cambios unos segundos después de hacerlos.
function useCloudAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    fetchCommunity();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (!state.cloudUserId || state.cloudProfileId !== state.currentProfileId) return;
      const changed =
        state.lists !== prev.lists ||
        state.items !== prev.items ||
        state.userGames !== prev.userGames ||
        state.follows !== prev.follows ||
        state.profiles !== prev.profiles ||
        state.games !== prev.games;
      if (!changed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        pushAll().catch((error) => console.warn('Supabase', error));
      }, 4000);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
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
  useCloudAutoSync(ready);
  useEffect(() => {
    if (ready) loadAllOfficial();
  }, [ready]);
  if (!ready) return null;

  return (
    <>
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
        <Stack.Screen name="list/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="game/[id]/index" />
        <Stack.Screen name="game/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="list/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="list/pick" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
