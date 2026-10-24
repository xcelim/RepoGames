// Claves de la app: se ponen al compilar (secretos de GitHub Actions o un .env),
// así nadie tiene que configurar nada. Expo sustituye estas variables al empaquetar.
//
//   EXPO_PUBLIC_IGDB_CLIENT_ID / EXPO_PUBLIC_IGDB_CLIENT_SECRET  -> IGDB (Twitch)
//   EXPO_PUBLIC_RAWG_KEY                                         -> RAWG
//   EXPO_PUBLIC_STEAM_KEY                                        -> Steam (logros completos)
//   EXPO_PUBLIC_GAMES_PROXY_URL                                  -> servidor intermedio opcional
//
// Con EXPO_PUBLIC_GAMES_PROXY_URL las claves viven en el servidor (supabase/functions/games)
// y no van dentro de la APK: es lo recomendable si publicas la app.

export const BUILT_IN = {
  igdbClientId: process.env.EXPO_PUBLIC_IGDB_CLIENT_ID ?? '',
  igdbClientSecret: process.env.EXPO_PUBLIC_IGDB_CLIENT_SECRET ?? '',
  rawgKey: process.env.EXPO_PUBLIC_RAWG_KEY ?? '',
  steamKey: process.env.EXPO_PUBLIC_STEAM_KEY ?? '',
  proxyUrl: (process.env.EXPO_PUBLIC_GAMES_PROXY_URL ?? '').replace(/\/+$/, ''),
};

// Cabeceras para el servidor intermedio de Supabase (por si tiene activada la verificación).
export function proxyHeaders(): Record<string, string> {
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return anon && BUILT_IN.proxyUrl.includes('supabase.co') ? { apikey: anon, Authorization: `Bearer ${anon}` } : {};
}

// Dirección para una llamada a Steam: directa con la clave de la app, o por el servidor intermedio (web).
export function steamUrl(method: string, params: Record<string, string>): string | null {
  const qs = new URLSearchParams(params);
  if (BUILT_IN.steamKey) {
    qs.set('key', BUILT_IN.steamKey);
    return `https://api.steampowered.com/${method}/?${qs}`;
  }
  if (BUILT_IN.proxyUrl) return `${BUILT_IN.proxyUrl}/steam/${method}/?${qs}`;
  return null;
}
