import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameRecord } from '@/types';

import { igdbSteamAppId } from './igdb';
import { BUILT_IN, proxyHeaders, steamUrl } from './keys';
import { hasRawg, rawgGet, rawgResolve } from './rawg';

// Logros de un juego.
// 1) Steam (la lista completa, con los ocultos y en español): necesita la clave de Steam.
// 2) Si no hay clave o el juego no está en Steam: RAWG (no trae los ocultos).

export type Achievement = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  percent: number | null; // % de jugadores que lo tienen
  hidden?: boolean; // logro oculto (spoiler)
};

export type AchievementSet = { source: 'steam' | 'rawg'; list: Achievement[] };

const PREFIX = 'ach:v2:';
const WEEK = 7 * 86_400_000;

async function getJson<T>(url: string | null): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, BUILT_IN.steamKey ? undefined : { headers: proxyHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type RawgStore = { url?: string; store_id?: number };

async function steamAppId(game: GameRecord): Promise<number | null> {
  if (game.igdbId) {
    const id = await igdbSteamAppId(game.igdbId);
    if (id) return id;
  }
  // RAWG también sabe en qué tiendas está el juego.
  if (game.rawgId && (await hasRawg())) {
    const stores = await rawgGet<{ results: RawgStore[] }>(`/games/${game.rawgId}/stores`).catch(() => null);
    const url = stores?.results?.find((s) => s.url?.includes('store.steampowered.com/app/'))?.url;
    const m = url?.match(/\/app\/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

type SteamSchema = {
  game?: {
    availableGameStats?: {
      achievements?: { name: string; displayName: string; hidden: number; description?: string; icon?: string }[];
    };
  };
};
type SteamPercents = { achievementpercentages?: { achievements?: { name: string; percent: number | string }[] } };

async function fromSteam(appId: number): Promise<Achievement[] | null> {
  if (!BUILT_IN.steamKey && !BUILT_IN.proxyUrl) return null;
  const [schema, pct] = await Promise.all([
    getJson<SteamSchema>(steamUrl('ISteamUserStats/GetSchemaForGame/v2', { appid: String(appId), l: 'spanish' })),
    getJson<SteamPercents>(steamUrl('ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2', { gameid: String(appId) })),
  ]);
  const list = schema?.game?.availableGameStats?.achievements;
  if (!list?.length) return null;
  const percent = new Map((pct?.achievementpercentages?.achievements ?? []).map((a) => [a.name, Number(a.percent)]));
  return list.map((a) => ({
    id: `steam:${a.name}`,
    name: a.displayName,
    description: a.description ?? '',
    image: a.icon ?? null,
    percent: percent.has(a.name) && Number.isFinite(percent.get(a.name)) ? percent.get(a.name)! : null,
    hidden: a.hidden === 1,
  }));
}

type RawgAchievement = {
  id: number;
  name: string;
  description?: string;
  image?: string | null;
  percent?: string | number;
};
type Page = { count: number; next: string | null; results: RawgAchievement[] };

async function fromRawg(game: GameRecord): Promise<Achievement[]> {
  if (!(await hasRawg())) return [];
  const id = game.rawgId ?? (await rawgResolve([{ q: game.title, year: game.year ?? 0 }]))[0]?.sourceId ?? null;
  if (!id) return [];
  const list: Achievement[] = [];
  for (let page = 1; page <= 15; page++) {
    const data = await rawgGet<Page>(`/games/${id}/achievements`, { page: String(page), page_size: '40' });
    for (const a of data.results ?? []) {
      const pct = a.percent == null ? null : Number(a.percent);
      list.push({
        id: String(a.id),
        name: a.name,
        description: a.description ?? '',
        image: a.image ?? null,
        percent: Number.isFinite(pct) ? pct : null,
      });
    }
    if (!data.next) break;
  }
  return list;
}

export async function fetchAchievements(game: GameRecord): Promise<AchievementSet> {
  const key = PREFIX + game.id;
  const cached = await AsyncStorage.getItem(key).catch(() => null);
  if (cached) {
    const { at, set } = JSON.parse(cached) as { at: number; set: AchievementSet };
    if (Date.now() - at < WEEK) return set;
  }
  let set: AchievementSet | null = null;
  const appId = BUILT_IN.steamKey || BUILT_IN.proxyUrl ? await steamAppId(game) : null;
  if (appId) {
    const steam = await fromSteam(appId);
    if (steam) set = { source: 'steam', list: steam };
  }
  set ??= { source: 'rawg', list: await fromRawg(game) };
  // Del más fácil al más raro, como en Steam.
  set.list.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), set })).catch(() => undefined);
  return set;
}
