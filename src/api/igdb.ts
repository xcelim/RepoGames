import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { GameDetails, OnlineResult } from './types';

// IGDB (Twitch): unos 300.000 juegos con portadas, capturas, tráileres,
// compañías y tiempos para terminarlos. Necesita Client ID y Client Secret.

type Credentials = { clientId: string; secret: string };

const ID_KEY = 'igdb-client-id';
const SECRET_KEY = 'igdb-client-secret';
const CACHE_PREFIX = 'igdb:';
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';

let token: { value: string; expiresAt: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();

export const igdbImage = (id: string, size: 't_cover_big' | 't_screenshot_big' | 't_1080p' | 't_720p') =>
  `${IMAGE_BASE}/${size}/${id}.jpg`;

// ---------- Claves ----------

export async function saveCredentials(clientId: string, secret: string): Promise<void> {
  await SecureStore.setItemAsync(ID_KEY, clientId.trim());
  await SecureStore.setItemAsync(SECRET_KEY, secret.trim());
  token = null;
}

export async function getCredentials(): Promise<Credentials | null> {
  try {
    const clientId = await SecureStore.getItemAsync(ID_KEY);
    const secret = await SecureStore.getItemAsync(SECRET_KEY);
    return clientId && secret ? { clientId, secret } : null;
  } catch {
    // SecureStore no existe en la versión web: la app sigue sin IGDB.
    return null;
  }
}

export async function hasIgdbCredentials(): Promise<boolean> {
  return (await getCredentials()) !== null;
}

// ---------- Token de Twitch ----------

async function getToken({ clientId, secret }: Credentials): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) {
    return token.value;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    grant_type: 'client_credentials',
  });
  const response = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Twitch rechazó las claves (${response.status})`);
  }
  const data: { access_token: string; expires_in: number } = await response.json();
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

export async function testConnection(): Promise<void> {
  const credentials = await getCredentials();
  if (!credentials) throw new Error('Faltan las claves');
  await getToken(credentials);
}

// ---------- Cola: como mucho 4 peticiones por segundo ----------

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, 260)));
  return run;
}

// Hace una consulta a un endpoint de IGDB (dentro de la cola).
async function query<T>(endpoint: string, body: string): Promise<T> {
  const credentials = await getCredentials();
  if (!credentials) throw new Error('Configura IGDB en Ajustes');
  return enqueue(async () => {
    const accessToken = await getToken(credentials);
    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': credentials.clientId,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });
    if (!response.ok) throw new Error(`IGDB respondió ${response.status}`);
    return (await response.json()) as T;
  });
}

const clean = (text: string) => text.replace(/"/g, '').trim();

const toHours = (seconds?: number) =>
  seconds && seconds > 0 ? Math.max(0.5, Math.round((seconds / 3600) * 2) / 2) : null;

type IgdbTimeToBeat = { game_id: number; hastily?: number; normally?: number; completely?: number };

async function timesToBeat(ids: number[]): Promise<Record<number, IgdbTimeToBeat>> {
  if (ids.length === 0) return {};
  try {
    const rows = await query<IgdbTimeToBeat[]>(
      'game_time_to_beats',
      `fields game_id,hastily,normally,completely; where game_id = (${ids.join(',')}); limit 500;`,
    );
    return Object.fromEntries(rows.map((row) => [row.game_id, row]));
  } catch {
    return {};
  }
}

// ---------- Búsqueda ----------

type IgdbSearchGame = {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  total_rating?: number;
  cover?: { image_id: string };
  platforms?: { abbreviation?: string; name: string }[];
  version_parent?: number;
};

export async function searchIgdb(text: string): Promise<OnlineResult[]> {
  const q = clean(text);
  if (q.length < 2) return [];
  const games = await query<IgdbSearchGame[]>(
    'games',
    `search "${q}"; fields name,summary,first_release_date,total_rating,cover.image_id,platforms.name,platforms.abbreviation,version_parent; limit 30;`,
  );
  const main = games.filter((g) => !g.version_parent);
  const times = await timesToBeat(main.map((g) => g.id));
  return main.map((game) => {
    const t = times[game.id];
    return {
      source: 'igdb' as const,
      sourceId: game.id,
      title: game.name,
      year: game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : null,
      platforms: (game.platforms ?? []).map((p) => p.abbreviation ?? p.name).join(', '),
      coverUrl: game.cover ? igdbImage(game.cover.image_id, 't_cover_big') : null,
      summary: game.summary ?? null,
      rating: game.total_rating ? Math.round(game.total_rating) : null,
      main: toHours(t?.hastily),
      extra: toHours(t?.normally),
      full: toHours(t?.completely),
    };
  });
}

// ---------- Ficha completa ----------

type IgdbDetailGame = IgdbSearchGame & {
  storyline?: string;
  total_rating_count?: number;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  videos?: { video_id: string; name?: string }[];
  genres?: { name: string }[];
  involved_companies?: { company?: { name: string }; developer?: boolean; publisher?: boolean }[];
  franchises?: { name: string }[];
  collections?: { name: string }[];
  url?: string;
};

const DETAIL_FIELDS =
  'fields name,summary,storyline,first_release_date,total_rating,total_rating_count,cover.image_id,' +
  'artworks.image_id,screenshots.image_id,videos.video_id,videos.name,platforms.name,platforms.abbreviation,' +
  'genres.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,' +
  'franchises.name,collections.name,url,version_parent;';

function toDetails(game: IgdbDetailGame, t?: IgdbTimeToBeat): GameDetails {
  const companies = game.involved_companies ?? [];
  const hero = game.artworks?.[0] ?? game.screenshots?.[0];
  return {
    source: 'igdb',
    sourceId: game.id,
    name: game.name,
    coverUrl: game.cover ? igdbImage(game.cover.image_id, 't_cover_big') : null,
    heroUrl: hero ? igdbImage(hero.image_id, 't_1080p') : null,
    screenshots: (game.screenshots ?? []).slice(0, 12).map((s) => igdbImage(s.image_id, 't_screenshot_big')),
    videoIds: (game.videos ?? []).map((v) => v.video_id),
    summary: game.summary ?? null,
    storyline: game.storyline ?? null,
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    platforms: (game.platforms ?? []).map((p) => p.name),
    genres: (game.genres ?? []).map((g) => g.name),
    developers: companies.filter((c) => c.developer && c.company).map((c) => c.company!.name),
    publishers: companies.filter((c) => c.publisher && c.company).map((c) => c.company!.name),
    franchise: game.franchises?.[0]?.name ?? game.collections?.[0]?.name ?? null,
    rating: game.total_rating ? Math.round(game.total_rating) : null,
    ratingCount: game.total_rating_count ?? null,
    ratingLabel: 'IGDB',
    timeToBeat: t
      ? { main: toHours(t.hastily), extra: toHours(t.normally), full: toHours(t.completely) }
      : null,
    url: game.url ?? null,
  };
}

// Busca la ficha por id de IGDB o por nombre (se queda con el mejor resultado).
export async function igdbDetails(by: { id?: number; title?: string; year?: number | null }): Promise<GameDetails | null> {
  let games: IgdbDetailGame[];
  if (by.id) {
    games = await query<IgdbDetailGame[]>('games', `${DETAIL_FIELDS} where id = ${by.id};`);
  } else if (by.title) {
    games = await query<IgdbDetailGame[]>('games', `search "${clean(by.title)}"; ${DETAIL_FIELDS} limit 10;`);
    games = games.filter((g) => !g.version_parent);
    if (by.year) {
      const sameYear = games.filter(
        (g) => g.first_release_date && new Date(g.first_release_date * 1000).getUTCFullYear() === by.year,
      );
      if (sameYear.length) games = sameYear;
    }
    const withCover = games.find((g) => g.cover);
    games = withCover ? [withCover] : games;
  } else {
    return null;
  }
  const game = games[0];
  if (!game) return null;
  const times = await timesToBeat([game.id]);
  return toDetails(game, times[game.id]);
}

export async function clearIgdbCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith('details:')));
}

// Solo la portada (para las listas): una consulta ligera.
export async function igdbCover(by: { id?: number; title?: string; year?: number | null }): Promise<string | null> {
  type Row = { cover?: { image_id: string }; first_release_date?: number; version_parent?: number };
  const fields = 'fields cover.image_id,first_release_date,version_parent;';
  const rows = by.id
    ? await query<Row[]>('games', `${fields} where id = ${by.id};`)
    : await query<Row[]>('games', `search "${clean(by.title ?? '')}"; ${fields} limit 10;`);
  const candidates = rows.filter((r) => r.cover && !r.version_parent);
  const sameYear = candidates.find(
    (r) => by.year && r.first_release_date && new Date(r.first_release_date * 1000).getUTCFullYear() === by.year,
  );
  const hit = sameYear ?? candidates[0] ?? rows.find((r) => r.cover);
  return hit?.cover ? igdbImage(hit.cover.image_id, 't_cover_big') : null;
}
