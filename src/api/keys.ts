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
