import * as SecureStore from 'expo-secure-store';

import { rankByQuery } from '@/utils/fuzzy';

import { BUILT_IN } from './keys';
import type { GameDetails, OnlineResult } from './types';

// RAWG: la base de datos abierta más grande (más de 500.000 juegos).
// Clave gratuita en https://rawg.io/apidocs. Exige enlazar a RAWG donde se usan sus datos.

const KEY_NAME = 'rawg-api-key';
const BASE = 'https://api.rawg.io/api';

let memoryKey: string | null = null;

export async function saveRawgKey(key: string): Promise<void> {
  memoryKey = key.trim();
  try {
    await SecureStore.setItemAsync(KEY_NAME, memoryKey);
  } catch {
    // web: solo en memoria
  }
}

// Clave propia guardada en Ajustes (opcional).
export async function getSavedRawgKey(): Promise<string | null> {
  if (memoryKey) return memoryKey;
  try {
    memoryKey = await SecureStore.getItemAsync(KEY_NAME);
  } catch {
    memoryKey = null;
  }
  return memoryKey || null;
}

export async function getRawgKey(): Promise<string | null> {
  return (await getSavedRawgKey()) || BUILT_IN.rawgKey || null;
}

export async function hasRawg(): Promise<boolean> {
  return !!BUILT_IN.proxyUrl || !!(await getRawgKey());
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = await getRawgKey();
  let url: string;
  if (key) {
    url = `${BASE}${path}?${new URLSearchParams({ key, ...params })}`;
  } else if (BUILT_IN.proxyUrl) {
    url = `${BUILT_IN.proxyUrl}/rawg${path}?${new URLSearchParams(params)}`;
  } else {
    throw new Error('La app no tiene acceso a RAWG');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'RAWG rechazó la clave' : `RAWG respondió ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function testRawg(): Promise<void> {
  await get('/games', { page_size: '1' });
}

type RawgGame = {
  id: number;
  slug: string;
  name: string;
  released?: string | null;
  background_image?: string | null;
  rating?: number;
  metacritic?: number | null;
  playtime?: number;
  added?: number;
  ratings_count?: number;
  platforms?: { platform: { name: string } }[] | null;
  genres?: { name: string }[];
  short_screenshots?: { image: string }[];
};

type RawgDetail = RawgGame & {
  description_raw?: string;
  background_image_additional?: string | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  website?: string;
};

const yearOf = (date?: string | null) => (date ? parseInt(date.slice(0, 4), 10) || null : null);

function score(game: RawgGame): number | null {
  if (game.metacritic) return game.metacritic;
  return game.rating ? Math.round((game.rating / 5) * 100) : null;
}

function toResult(game: RawgGame): OnlineResult {
  return {
    source: 'rawg' as const,
    sourceId: game.id,
    title: game.name,
    year: yearOf(game.released),
    platforms: (game.platforms ?? []).map((p) => p.platform.name).join(', '),
    coverUrl: game.background_image ?? null,
    summary: null,
    rating: score(game),
    main: game.playtime ? game.playtime : null,
    extra: null,
    full: null,
    developer: null,
    releaseDate: game.released ?? null,
    popularity: game.added ?? game.ratings_count ?? 0,
  };
}

// precise = false: el buscador "difuso" de RAWG, que aguanta erratas.
export async function searchRawg(text: string, precise = false): Promise<OnlineResult[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const params: Record<string, string> = { search: q, page_size: '40' };
  if (precise) params.search_precise = 'true';
  const data = await get<{ results: RawgGame[] }>('/games', params);
  const results = data.results.map(toResult);
  return precise ? results : rankByQuery(q, results, (r) => r.title, (r) => r.popularity ?? 0);
}

export async function rawgDetails(by: { id?: number; title?: string; year?: number | null }): Promise<GameDetails | null> {
  let id = by.id;
  if (!id && by.title) {
    const results = await searchRawg(by.title, true);
    const match =
      results.find((r) => by.year && r.year === by.year) ??
      results.find((r) => r.title.toLowerCase() === by.title!.toLowerCase()) ??
      results[0];
    id = match?.sourceId;
  }
  if (!id) return null;
  const game = await get<RawgDetail>(`/games/${id}`);
  let screenshots: string[] = [];
  try {
    const shots = await get<{ results: { image: string }[] }>(`/games/${id}/screenshots`);
    screenshots = shots.results.map((s) => s.image);
  } catch {
    screenshots = (game.short_screenshots ?? []).map((s) => s.image);
  }
  return {
    source: 'rawg',
    sourceId: game.id,
    name: game.name,
    coverUrl: game.background_image ?? null,
    heroUrl: game.background_image_additional ?? game.background_image ?? null,
    screenshots: screenshots.slice(0, 12),
    videoIds: [],
    summary: game.description_raw || null,
    storyline: null,
    releaseDate: game.released ?? null,
    platforms: (game.platforms ?? []).map((p) => p.platform.name),
    genres: (game.genres ?? []).map((g) => g.name),
    developers: (game.developers ?? []).map((d) => d.name),
    publishers: (game.publishers ?? []).map((p) => p.name),
    franchise: null,
    rating: score(game),
    ratingCount: game.ratings_count ?? null,
    ratingLabel: game.metacritic ? 'Metacritic' : 'RAWG',
    criticRating: game.metacritic ?? null,
    criticCount: null,
    userRating: game.rating ? Math.round((game.rating / 5) * 100) : null,
    userCount: game.ratings_count ?? null,
    timeToBeat: game.playtime ? { main: game.playtime, extra: null, full: null } : null,
    url: `https://rawg.io/games/${game.slug}`,
  };
}

// Todos los juegos de una serie: busca el primero y pide su "game-series".
export async function rawgSeries(name: string): Promise<OnlineResult[]> {
  const results = await searchRawg(name, true);
  const anchor = results[0];
  if (!anchor) return [];
  const data = await get<{ results: RawgGame[] }>(`/games/${anchor.sourceId}/game-series`, { page_size: '40' });
  const all = [
    anchor,
    ...data.results.map(toResult),
  ];
  return all.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

// Busca un juego concreto (nombre + año) para las bibliotecas oficiales.
export async function rawgResolve(
  entries: { q: string; year: number; alt?: string[] }[],
): Promise<(OnlineResult | null)[]> {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const out: (OnlineResult | null)[] = [];
  for (const entry of entries) {
    let best: { r: OnlineResult; score: number } | null = null;
    for (const name of [entry.q, ...(entry.alt ?? [])]) {
      const results = await searchRawg(name, true).catch(() => [] as OnlineResult[]);
      for (const r of results) {
        let score = norm(r.title) === norm(name) ? 100 : norm(r.title).includes(norm(name)) ? 25 : 0;
        if (r.year === entry.year) score += 40;
        else if (r.year && Math.abs(r.year - entry.year) <= 1) score += 20;
        if (!best || score > best.score) best = { r, score };
      }
      if (best && best.score >= 125) break;
    }
    out.push(best && best.score >= 25 ? best.r : null);
  }
  return out;
}
