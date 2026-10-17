import AsyncStorage from '@react-native-async-storage/async-storage';

import { stripAccents } from '@/data/catalog';
import type { GameRecord } from '@/types';

import { hasIgdbCredentials, igdbCover, igdbDetails, searchIgdb } from './igdb';
import { getRawgKey, rawgDetails, searchRawg } from './rawg';
import type { GameDetails, OnlineResult } from './types';

// Punto único para hablar con las bases de datos online:
// IGDB (mejores datos: tiempos, compañías, tráileres) + RAWG (la más grande).

export async function onlineSources(): Promise<{ igdb: boolean; rawg: boolean }> {
  const [igdb, rawgKey] = await Promise.all([hasIgdbCredentials(), getRawgKey()]);
  return { igdb, rawg: !!rawgKey };
}

const norm = (text: string) =>
  stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export type SearchOutcome = { results: OnlineResult[]; errors: string[] };

// Busca en las dos a la vez y quita duplicados (mismo título y año).
export async function searchOnline(text: string): Promise<SearchOutcome> {
  const sources = await onlineSources();
  const errors: string[] = [];
  const run = async (enabled: boolean, fn: (t: string) => Promise<OnlineResult[]>) => {
    if (!enabled) return [];
    try {
      return await fn(text);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Error');
      return [];
    }
  };
  const [igdb, rawg] = await Promise.all([run(sources.igdb, searchIgdb), run(sources.rawg, searchRawg)]);
  const seen = new Map<string, OnlineResult>();
  for (const r of igdb) seen.set(`${norm(r.title)}|${r.year ?? ''}`, r);
  const results = [...igdb];
  for (const r of rawg) {
    const key = `${norm(r.title)}|${r.year ?? ''}`;
    const twin = seen.get(key);
    if (twin) {
      // Completa lo que le falte al de IGDB.
      twin.coverUrl ??= r.coverUrl;
      twin.rating ??= r.rating;
      twin.main ??= r.main;
      continue;
    }
    seen.set(key, r);
    results.push(r);
  }
  return { results, errors };
}

export function onlineGameId(r: { source: 'igdb' | 'rawg'; sourceId: number }): string {
  return `${r.source}-${r.sourceId}`;
}

export function toGameRecord(r: OnlineResult, profileId: string | null): GameRecord {
  return {
    id: onlineGameId(r),
    title: r.title,
    year: r.year,
    platforms: r.platforms,
    version: null,
    series: null,
    main: r.main,
    extra: r.extra,
    full: r.full,
    synopsis: r.summary,
    note: null,
    igdbId: r.source === 'igdb' ? r.sourceId : null,
    rawgId: r.source === 'rawg' ? r.sourceId : null,
    igdbQuery: null,
    coverUrl: r.coverUrl,
    source: r.source,
    createdBy: profileId,
  };
}

// ---------- Ficha completa (con caché en el móvil) ----------

const DETAILS_PREFIX = 'details:v1:';

export async function fetchDetails(game: GameRecord): Promise<GameDetails | null> {
  const cacheKey = DETAILS_PREFIX + game.id;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as GameDetails;

  const sources = await onlineSources();
  const title = game.igdbQuery ?? game.title;
  let details: GameDetails | null = null;
  if (game.igdbId && sources.igdb) details = await igdbDetails({ id: game.igdbId });
  else if (game.rawgId && sources.rawg) details = await rawgDetails({ id: game.rawgId });
  else if (sources.igdb) details = await igdbDetails({ title, year: game.year });
  else if (sources.rawg) details = await rawgDetails({ title, year: game.year });

  // RAWG no tiene tiempos fiables: si hay IGDB, se los pedimos a IGDB.
  if (details?.source === 'rawg' && sources.igdb) {
    const extra = await igdbDetails({ title: details.name, year: game.year }).catch(() => null);
    if (extra) {
      details.timeToBeat = extra.timeToBeat ?? details.timeToBeat;
      details.videoIds = extra.videoIds;
      details.coverUrl = extra.coverUrl ?? details.coverUrl;
      details.franchise = extra.franchise;
      details.storyline = extra.storyline;
    }
  }
  if (details) await AsyncStorage.setItem(cacheKey, JSON.stringify(details));
  return details;
}

// ---------- Solo la portada (para las filas de las listas) ----------

const COVER_PREFIX = 'cover:v1:';

export async function fetchCover(game: GameRecord): Promise<string | null> {
  if (game.coverUrl) return game.coverUrl;
  const cacheKey = COVER_PREFIX + game.id;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached !== null) return cached || null;
  const details = await AsyncStorage.getItem(DETAILS_PREFIX + game.id);
  if (details) return (JSON.parse(details) as GameDetails).coverUrl;

  const sources = await onlineSources();
  let url: string | null = null;
  const title = game.igdbQuery ?? game.title;
  if (sources.igdb) url = await igdbCover(game.igdbId ? { id: game.igdbId } : { title, year: game.year });
  if (!url && sources.rawg) {
    const results = await searchRawg(title).catch(() => []);
    url = (results.find((r) => r.year === game.year) ?? results[0])?.coverUrl ?? null;
  }
  // Sin fuentes no guardamos nada, para volver a intentarlo cuando las configures.
  if (sources.igdb || sources.rawg) await AsyncStorage.setItem(cacheKey, url ?? '');
  return url;
}

export async function clearOnlineCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter((k) => k.startsWith(DETAILS_PREFIX) || k.startsWith(COVER_PREFIX) || k.startsWith('igdb:')),
  );
}
