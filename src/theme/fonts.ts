// Todas las tipografías de las estéticas. Se cargan solo las de la estética que uses
// (y todas en segundo plano al abrir el selector), así la app arranca rápido.
import * as Font from 'expo-font';

type FontSource = () => number;

export const FONT_SOURCES: Record<string, FontSource> = {
  Audiowide_400Regular: () => require('@expo-google-fonts/audiowide/400Regular/Audiowide_400Regular.ttf'),
  Baloo2_700Bold: () => require('@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf'),
  ChakraPetch_400Regular: () => require('@expo-google-fonts/chakra-petch/400Regular/ChakraPetch_400Regular.ttf'),
  ChakraPetch_700Bold: () => require('@expo-google-fonts/chakra-petch/700Bold/ChakraPetch_700Bold.ttf'),
  ChakraPetch_700Bold_Italic: () =>
    require('@expo-google-fonts/chakra-petch/700Bold_Italic/ChakraPetch_700Bold_Italic.ttf'),
  Cinzel_700Bold: () => require('@expo-google-fonts/cinzel/700Bold/Cinzel_700Bold.ttf'),
  Fredoka_600SemiBold: () => require('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
  Lato_400Regular: () => require('@expo-google-fonts/lato/400Regular/Lato_400Regular.ttf'),
  Lato_700Bold: () => require('@expo-google-fonts/lato/700Bold/Lato_700Bold.ttf'),
  Nunito_400Regular: () => require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
  Nunito_700Bold: () => require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  Orbitron_700Bold: () => require('@expo-google-fonts/orbitron/700Bold/Orbitron_700Bold.ttf'),
  PressStart2P_400Regular: () => require('@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf'),
  Rajdhani_500Medium: () => require('@expo-google-fonts/rajdhani/500Medium/Rajdhani_500Medium.ttf'),
  Rajdhani_700Bold: () => require('@expo-google-fonts/rajdhani/700Bold/Rajdhani_700Bold.ttf'),
  VT323_400Regular: () => require('@expo-google-fonts/vt323/400Regular/VT323_400Regular.ttf'),
  PirataOne_400Regular: () => require('@expo-google-fonts/pirata-one/400Regular/PirataOne_400Regular.ttf'),
  CormorantGaramond_500Medium: () =>
    require('@expo-google-fonts/cormorant-garamond/500Medium/CormorantGaramond_500Medium.ttf'),
  CormorantGaramond_700Bold: () =>
    require('@expo-google-fonts/cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf'),
  CormorantGaramond_700Bold_Italic: () =>
    require('@expo-google-fonts/cormorant-garamond/700Bold_Italic/CormorantGaramond_700Bold_Italic.ttf'),
  SpecialElite_400Regular: () => require('@expo-google-fonts/special-elite/400Regular/SpecialElite_400Regular.ttf'),
  Creepster_400Regular: () => require('@expo-google-fonts/creepster/400Regular/Creepster_400Regular.ttf'),
  Bangers_400Regular: () => require('@expo-google-fonts/bangers/400Regular/Bangers_400Regular.ttf'),
  PermanentMarker_400Regular: () =>
    require('@expo-google-fonts/permanent-marker/400Regular/PermanentMarker_400Regular.ttf'),
  Bungee_400Regular: () => require('@expo-google-fonts/bungee/400Regular/Bungee_400Regular.ttf'),
  BlackOpsOne_400Regular: () => require('@expo-google-fonts/black-ops-one/400Regular/BlackOpsOne_400Regular.ttf'),
  UncialAntiqua_400Regular: () => require('@expo-google-fonts/uncial-antiqua/400Regular/UncialAntiqua_400Regular.ttf'),
  ZenDots_400Regular: () => require('@expo-google-fonts/zen-dots/400Regular/ZenDots_400Regular.ttf'),
  Caveat_700Bold: () => require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
  MetalMania_400Regular: () => require('@expo-google-fonts/metal-mania/400Regular/MetalMania_400Regular.ttf'),
  RussoOne_400Regular: () => require('@expo-google-fonts/russo-one/400Regular/RussoOne_400Regular.ttf'),
  ShareTechMono_400Regular: () => require('@expo-google-fonts/share-tech-mono/400Regular/ShareTechMono_400Regular.ttf'),
  Quicksand_500Medium: () => require('@expo-google-fonts/quicksand/500Medium/Quicksand_500Medium.ttf'),
  Quicksand_700Bold: () => require('@expo-google-fonts/quicksand/700Bold/Quicksand_700Bold.ttf'),
  PlayfairDisplay_700Bold: () => require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf'),
  PlayfairDisplay_700Bold_Italic: () =>
    require('@expo-google-fonts/playfair-display/700Bold_Italic/PlayfairDisplay_700Bold_Italic.ttf'),
  Righteous_400Regular: () => require('@expo-google-fonts/righteous/400Regular/Righteous_400Regular.ttf'),
  PixelifySans_400Regular: () => require('@expo-google-fonts/pixelify-sans/400Regular/PixelifySans_400Regular.ttf'),
  PixelifySans_700Bold: () => require('@expo-google-fonts/pixelify-sans/700Bold/PixelifySans_700Bold.ttf'),
  Shojumaru_400Regular: () => require('@expo-google-fonts/shojumaru/400Regular/Shojumaru_400Regular.ttf'),
  Comfortaa_500Medium: () => require('@expo-google-fonts/comfortaa/500Medium/Comfortaa_500Medium.ttf'),
  Comfortaa_700Bold: () => require('@expo-google-fonts/comfortaa/700Bold/Comfortaa_700Bold.ttf'),
  Exo2_400Regular: () => require('@expo-google-fonts/exo-2/400Regular/Exo2_400Regular.ttf'),
  Exo2_700Bold: () => require('@expo-google-fonts/exo-2/700Bold/Exo2_700Bold.ttf'),
  IBMPlexMono_400Regular: () => require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'),
  IBMPlexMono_700Bold: () => require('@expo-google-fonts/ibm-plex-mono/700Bold/IBMPlexMono_700Bold.ttf'),
  Silkscreen_400Regular: () => require('@expo-google-fonts/silkscreen/400Regular/Silkscreen_400Regular.ttf'),
};

const loaded = new Set<string>();

export async function loadFonts(names: string[]): Promise<void> {
  const missing = names.filter((n) => !loaded.has(n) && FONT_SOURCES[n]);
  if (!missing.length) return;
  await Font.loadAsync(Object.fromEntries(missing.map((n) => [n, FONT_SOURCES[n]()])));
  missing.forEach((n) => loaded.add(n));
}

export function fontsLoaded(names: string[]): boolean {
  return names.every((n) => loaded.has(n) || !FONT_SOURCES[n]);
}

export function loadAllFonts(): Promise<void> {
  return loadFonts(Object.keys(FONT_SOURCES)).catch(() => undefined);
}
