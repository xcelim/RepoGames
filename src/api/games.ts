import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameRecord } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { normTitle as norm } from '@/utils/text';

import { hasIgdbCredentials, igdbBasics, igdbCover, igdbDetails, igdbResolve, igdbSeries, searchIgdb } from './igdb';
import { hasRawg, rawgDetails, rawgResolve, rawgSeries, searchRawg } from './rawg';
import type { GameDetails, OnlineResult } from './types';

// Punto único para hablar con las bases de datos online:
// IGDB (mejores datos: tiempos, compañías, tráileres) + RAWG (la más grande).

export async function onlineSources(): Promise<{ igdb: boolean; rawg: boolean }> {
  const [igdb, rawg] = await Promise.all([hasIgdbCredentials(), hasRawg()]);
  return { igdb, rawg };
}

export type SearchOutcome = { results: OnlineResult[]; errors: string[] };

// Junta IGDB y RAWG sin duplicados (mismo título y año) y ordena por parecido.
function mergeResults(text: string, igdb: OnlineResult[], rawg: OnlineResult[]): OnlineResult[] {
  const seen = new Map<string, OnlineResult>();
  const results: OnlineResult[] = [];
  for (const r of igdb) {
    const copy = { ...r };
    seen.set(`${norm(r.title)}|${r.year ?? ''}`, copy);
    results.push(copy);
  }
  for (const r of rawg) {
    const key = `${norm(r.title)}|${r.year ?? ''}`;
    const twin = seen.get(key);
    if (twin) {
      // Completa lo que le falte al de IGDB.
      twin.coverUrl ??= r.coverUrl;
      twin.rating ??= r.rating;
      twin.main ??= r.main;
      twin.popularity = Math.max(twin.popularity ?? 0, r.popularity ?? 0);
      continue;
    }
    seen.set(key, r);
    results.push(r);
  }
  return rankByQuery(text, results, (r) => r.title, (r) => r.popularity ?? 0);
}

// Busca en las dos a la vez. onUpdate recibe los resultados en cuanto llega cada parte,
// así la lista aparece al momento y se va completando.
export async function searchOnline(text: string, onUpdate?: (results: OnlineResult[]) => void): Promise<SearchOutcome> {
  const sources = await onlineSources();
  const errors: string[] = [];
  let igdb: OnlineResult[] = [];
  let rawg: OnlineResult[] = [];
  const emit = () => onUpdate?.(mergeResults(text, igdb, rawg));
  const tasks: Promise<void>[] = [];
  if (sources.igdb) {
    tasks.push(
      searchIgdb(text, (partial) => {
        igdb = partial;
        emit();
      })
        .then((r) => {
          igdb = r;
          emit();
        })
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Error');
        }),
    );
  }
  if (sources.rawg) {
    tasks.push(
      searchRawg(text)
        .then((r) => {
          rawg = r;
          emit();
        })
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Error');
        }),
    );
  }
  await Promise.all(tasks);
  return { results: mergeResults(text, igdb, rawg), errors };
}

export function onlineGameId(r: { source: 'igdb' | 'rawg'; sourceId: number }): string {
  return `${r.source}-${r.sourceId}`;
}

// Todos los juegos de una serie (para las bibliotecas oficiales), de IGDB o, si no, de RAWG.
export async function fetchSeries(query: string): Promise<OnlineResult[]> {
  const sources = await onlineSources();
  if (sources.igdb) {
    const games = await igdbSeries(query).catch(() => []);
    if (games.length) return games;
  }
  if (sources.rawg) return rawgSeries(query);
  if (!sources.igdb) throw new Error('La app no tiene acceso a la API de juegos');
  return [];
}

// Busca en la API una lista concreta de juegos (nombre + año). Si IGDB no encuentra
// alguno, lo intenta en RAWG. Devuelve null en los que no aparezcan en ninguna.
export async function resolveGames(
  entries: { q: string; year: number; alt?: string[] }[],
): Promise<(OnlineResult | null)[]> {
  const sources = await onlineSources();
  if (!sources.igdb && !sources.rawg) throw new Error('La app no tiene acceso a la API de juegos');
  let results: (OnlineResult | null)[] = entries.map(() => null);
  if (sources.igdb) results = await igdbResolve(entries);
  const missing = entries.map((e, i) => ({ e, i })).filter(({ i }) => !results[i]);
  if (missing.length && sources.rawg) {
    const extra = await rawgResolve(missing.map(({ e }) => e));
    missing.forEach(({ i }, k) => {
      results[i] = extra[k];
    });
  }
  return results;
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
    developer: r.developer ?? null,
    releaseDate: r.releaseDate ?? null,
    criticRating: r.rating,
    source: r.source,
    createdBy: profileId,
  };
}

// ---------- Ficha completa (con caché en el móvil) ----------

const DETAILS_PREFIX = 'details:v2:';

export async function fetchDetails(game: GameRecord, priority: 'high' | 'low' = 'high'): Promise<GameDetails | null> {
  const cacheKey = DETAILS_PREFIX + game.id;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as GameDetails;

  const sources = await onlineSources();
  const title = game.igdbQuery ?? game.title;
  let details: GameDetails | null = null;
  if (game.igdbId && sources.igdb) details = await igdbDetails({ id: game.igdbId }, priority);
  else if (game.rawgId && sources.rawg) details = await rawgDetails({ id: game.rawgId });
  else if (sources.igdb) details = await igdbDetails({ title, year: game.year }, priority);
  else if (sources.rawg) details = await rawgDetails({ title, year: game.year });

  // RAWG no tiene tiempos fiables: si hay IGDB, se los pedimos a IGDB.
  if (details?.source === 'rawg' && sources.igdb) {
    const extra = await igdbDetails({ title: details.name, year: game.year }, priority).catch(() => null);
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
  // "none:<fecha>" = no se encontró; se vuelve a intentar al cabo de un día.
  if (cached !== null && !cached.startsWith('none:')) return cached || null;
  if (cached?.startsWith('none:') && Date.now() - Number(cached.slice(5)) < 86_400_000) return null;
  const details = await AsyncStorage.getItem(DETAILS_PREFIX + game.id);
  if (details) return (JSON.parse(details) as GameDetails).coverUrl;

  const sources = await onlineSources();
  let url: string | null = null;
  const title = game.igdbQuery ?? game.title;
  if (sources.igdb) url = await igdbCover(game.igdbId ? { id: game.igdbId } : { title, year: game.year });
  if (!url && sources.rawg) {
    const results = await searchRawg(title, true).catch(() => []);
    url = (results.find((r) => r.year === game.year) ?? results[0])?.coverUrl ?? null;
  }
  // Sin fuentes no guardamos nada, para volver a intentarlo cuando las configures.
  if (sources.igdb || sources.rawg) await AsyncStorage.setItem(cacheKey, url ?? `none:${Date.now()}`);
  return url;
}

export async function clearOnlineCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter((k) => k.startsWith(DETAILS_PREFIX) || k.startsWith(COVER_PREFIX) || k.startsWith('igdb:')),
  );
}

// Completa desarrolladora / fecha / nota de la crítica de los juegos de IGDB que no la tengan.
const basicsAsked = new Set<string>();
export async function fillBasics(games: GameRecord[]): Promise<(Partial<GameRecord> & { id: string })[]> {
  const missing = games.filter((g) => g.igdbId && g.developer === undefined && !basicsAsked.has(g.id));
  if (!missing.length || !(await hasIgdbCredentials())) return [];
  missing.forEach((g) => basicsAsked.add(g.id));
  const rows = await igdbBasics(missing.map((g) => g.igdbId!)).catch(() => []);
  const byId = new Map(rows.map((r) => [r.sourceId, r]));
  return missing.map((g) => {
    const r = byId.get(g.igdbId!);
    return {
      id: g.id,
      developer: r?.developer ?? null,
      releaseDate: r?.releaseDate ?? null,
      criticRating: r?.rating ?? null,
      coverUrl: g.coverUrl ?? r?.coverUrl ?? null,
    };
  });
}
