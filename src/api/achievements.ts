import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameRecord } from '@/types';

import { hasRawg, rawgGet, rawgResolve } from './rawg';

// Logros de un juego (los de Steam / Xbox / PlayStation que recoge RAWG).
// IGDB no tiene logros, así que se busca el juego en RAWG y se piden allí.

export type Achievement = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  percent: number | null; // % de jugadores que lo tienen
};

type RawgAchievement = { id: number; name: string; description?: string; image?: string | null; percent?: string | number };
type Page = { count: number; next: string | null; results: RawgAchievement[] };

const PREFIX = 'ach:v1:';
const WEEK = 7 * 86_400_000;

async function rawgIdOf(game: GameRecord): Promise<number | null> {
  if (game.rawgId) return game.rawgId;
  const [found] = await rawgResolve([{ q: game.title, year: game.year ?? 0 }]);
  return found?.sourceId ?? null;
}

export async function fetchAchievements(game: GameRecord): Promise<Achievement[]> {
  const key = PREFIX + game.id;
  const cached = await AsyncStorage.getItem(key).catch(() => null);
  if (cached) {
    const { at, list } = JSON.parse(cached) as { at: number; list: Achievement[] };
    if (Date.now() - at < WEEK) return list;
  }
  if (!(await hasRawg())) throw new Error('Esta versión de la app no tiene acceso a RAWG');
  const id = await rawgIdOf(game);
  const list: Achievement[] = [];
  if (id) {
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
  }
  // Del más fácil al más raro, como en Steam.
  list.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), list })).catch(() => undefined);
  return list;
}
