// Steam: tu biblioteca (juegos y horas) y tus logros, con tu perfil público de Steam.
import { BUILT_IN } from './keys';

const BASE = 'https://api.steampowered.com';

export type SteamGame = {
  appid: number;
  name: string;
  minutes: number;
  lastPlayed: number | null;
  icon: string | null;
};

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 403 || res.status === 401) throw new Error('Steam rechazó la consulta (¿perfil privado?)');
  if (!res.ok) throw new Error(`Steam respondió ${res.status}`);
  return (await res.json()) as T;
}

export const hasSteam = () => !!BUILT_IN.steamKey;

// Acepta el ID de 17 cifras, la URL del perfil o el nombre personalizado.
export async function resolveSteamId(input: string): Promise<string> {
  const text = input.trim();
  const fromProfiles = text.match(/profiles\/(\d{17})/);
  if (fromProfiles) return fromProfiles[1];
  if (/^\d{17}$/.test(text)) return text;
  const vanity = text.match(/\/id\/([^/?#]+)/)?.[1] ?? text.replace(/^@/, '');
  if (!vanity) throw new Error('Escribe tu ID o la dirección de tu perfil de Steam');
  const data = await get<{ response: { success: number; steamid?: string } }>(
    `${BASE}/ISteamUser/ResolveVanityURL/v1/?key=${BUILT_IN.steamKey}&vanityurl=${encodeURIComponent(vanity)}`,
  );
  if (data.response.success !== 1 || !data.response.steamid) throw new Error('No encuentro ese perfil de Steam');
  return data.response.steamid;
}

export async function steamProfile(
  steamId: string,
): Promise<{ name: string; avatar: string | null; visible: boolean } | null> {
  const data = await get<{
    response: { players: { personaname: string; avatarfull?: string; communityvisibilitystate: number }[] };
  }>(`${BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${BUILT_IN.steamKey}&steamids=${steamId}`);
  const p = data.response.players[0];
  return p ? { name: p.personaname, avatar: p.avatarfull ?? null, visible: p.communityvisibilitystate === 3 } : null;
}

export async function steamOwnedGames(steamId: string): Promise<SteamGame[]> {
  const data = await get<{
    response: {
      games?: {
        appid: number;
        name: string;
        playtime_forever: number;
        rtime_last_played?: number;
        img_icon_url?: string;
      }[];
    };
  }>(
    `${BASE}/IPlayerService/GetOwnedGames/v1/?key=${BUILT_IN.steamKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`,
  );
  const games = data.response.games;
  if (!games)
    throw new Error(
      'Tu biblioteca de Steam es privada: en Steam → Perfil → Privacidad, pon «Detalles del juego» en Público',
    );
  return games.map((g) => ({
    appid: g.appid,
    name: g.name,
    minutes: g.playtime_forever,
    lastPlayed: g.rtime_last_played || null,
    icon: g.img_icon_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
      : null,
  }));
}

// Logros conseguidos en un juego (ids "steam:<nombre>", los mismos que usa la app).
export async function steamPlayerAchievements(
  steamId: string,
  appid: number,
): Promise<{ ids: string[]; total: number } | null> {
  try {
    const data = await get<{
      playerstats: { success: boolean; achievements?: { apiname: string; achieved: number }[] };
    }>(`${BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${BUILT_IN.steamKey}&steamid=${steamId}&appid=${appid}`);
    const list = data.playerstats.achievements;
    if (!data.playerstats.success || !list) return null;
    return { ids: list.filter((a) => a.achieved === 1).map((a) => `steam:${a.apiname}`), total: list.length };
  } catch {
    return null;
  }
}
