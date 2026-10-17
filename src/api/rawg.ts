import * as SecureStore from 'expo-secure-store';

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

export async function getRawgKey(): Promise<string | null> {
  if (memoryKey) return memoryKey;
  try {
    memoryKey = await SecureStore.getItemAsync(KEY_NAME);
  } catch {
    memoryKey = null;
  }
  return memoryKey || null;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = await getRawgKey();
  if (!key) throw new Error('Configura RAWG en Ajustes');
  const search = new URLSearchParams({ key, ...params });
  const response = await fetch(`${BASE}${path}?${search}`);
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
  platforms?: { platform: { name: string } }[] | null;
  genres?: { name: string }[];
  short_screenshots?: { image: string }[];
};

type RawgDetail = RawgGame & {
  description_raw?: string;
  background_image_additional?: string | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  ratings_count?: number;
  website?: string;
};

const yearOf = (date?: string | null) => (date ? parseInt(date.slice(0, 4), 10) || null : null);

function score(game: RawgGame): number | null {
  if (game.metacritic) return game.metacritic;
  return game.rating ? Math.round((game.rating / 5) * 100) : null;
}

export async function searchRawg(text: string): Promise<OnlineResult[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const data = await get<{ results: RawgGame[] }>('/games', {
    search: q,
    search_precise: 'true',
    page_size: '30',
  });
  return data.results.map((game) => ({
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
  }));
}

export async function rawgDetails(by: { id?: number; title?: string; year?: number | null }): Promise<GameDetails | null> {
  let id = by.id;
  if (!id && by.title) {
    const results = await searchRawg(by.title);
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
    timeToBeat: game.playtime ? { main: game.playtime, extra: null, full: null } : null,
    url: `https://rawg.io/games/${game.slug}`,
  };
}
