import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { BUILT_IN, proxyHeaders } from './keys';
import { rankByQuery, searchStems } from '@/utils/fuzzy';

import type { GameDetails, OnlineResult } from './types';

// IGDB (Twitch): unos 300.000 juegos con portadas, capturas, tráileres,
// compañías y tiempos para terminarlos. Necesita Client ID y Client Secret.

type Credentials = { clientId: string; secret: string };

const ID_KEY = 'igdb-client-id';
const SECRET_KEY = 'igdb-client-secret';
const CACHE_PREFIX = 'igdb:';
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';

let token: { value: string; expiresAt: number } | null = null;

export const igdbImage = (id: string, size: 't_cover_big' | 't_screenshot_big' | 't_1080p' | 't_720p') =>
  `${IMAGE_BASE}/${size}/${id}.jpg`;

// ---------- Claves ----------

export async function saveCredentials(clientId: string, secret: string): Promise<void> {
  await SecureStore.setItemAsync(ID_KEY, clientId.trim());
  await SecureStore.setItemAsync(SECRET_KEY, secret.trim());
  token = null;
}

// Claves propias guardadas en Ajustes (opcional; si no, las de la app).
export async function getSavedCredentials(): Promise<Credentials | null> {
  try {
    const clientId = await SecureStore.getItemAsync(ID_KEY);
    const secret = await SecureStore.getItemAsync(SECRET_KEY);
    return clientId && secret ? { clientId, secret } : null;
  } catch {
    // SecureStore no existe en la versión web.
    return null;
  }
}

export async function getCredentials(): Promise<Credentials | null> {
  const saved = await getSavedCredentials();
  if (saved) return saved;
  if (BUILT_IN.igdbClientId && BUILT_IN.igdbClientSecret) {
    return { clientId: BUILT_IN.igdbClientId, secret: BUILT_IN.igdbClientSecret };
  }
  return null;
}

export async function hasIgdbCredentials(): Promise<boolean> {
  return !!BUILT_IN.proxyUrl || (await getCredentials()) !== null;
}

// ---------- Token de Twitch (se guarda en el móvil: dura semanas) ----------

const TOKEN_KEY = 'igdb:token';
let tokenLoading: Promise<string> | null = null;

async function getToken({ clientId, secret }: Credentials): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  if (tokenLoading) return tokenLoading;
  tokenLoading = (async () => {
    try {
      const saved = await AsyncStorage.getItem(TOKEN_KEY);
      if (saved) {
        const t = JSON.parse(saved) as { value: string; expiresAt: number; clientId: string };
        if (t.clientId === clientId && t.expiresAt > Date.now() + 3600_000) {
          token = { value: t.value, expiresAt: t.expiresAt };
          return t.value;
        }
      }
    } catch {
      // sin token guardado
    }
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      grant_type: 'client_credentials',
    });
    const response = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
    if (!response.ok) throw new Error(`Twitch rechazó las claves (${response.status})`);
    const data: { access_token: string; expires_in: number } = await response.json();
    token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    AsyncStorage.setItem(TOKEN_KEY, JSON.stringify({ ...token, clientId })).catch(() => undefined);
    return token.value;
  })().finally(() => {
    tokenLoading = null;
  });
  return tokenLoading;
}

export async function testConnection(): Promise<void> {
  const credentials = await getCredentials();
  if (!credentials) throw new Error('Faltan las claves');
  await getToken(credentials);
}

// ---------- Cola con prioridades (IGDB admite 4 peticiones por segundo) ----------
// Lo que pides tú (buscar, abrir una ficha) pasa por delante de lo que se descarga
// en segundo plano (bibliotecas oficiales, datos que faltan, la copia sin conexión).

export type Priority = 'high' | 'normal' | 'low';
const ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const lanes: (() => void)[][] = [[], [], []];
const starts: number[] = [];
let inflight = 0;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;

function pump() {
  for (;;) {
    const now = Date.now();
    while (starts.length && now - starts[0] >= 1000) starts.shift();
    const next = lanes[0].length ? 0 : lanes[1].length ? 1 : lanes[2].length ? 2 : -1;
    if (next < 0) return;
    // Lo de segundo plano deja siempre un hueco libre para lo que pides tú.
    const limit = next === 2 ? 3 : 4;
    if (inflight >= 8 || starts.length >= limit) {
      if (!pumpTimer) {
        const wait = starts.length ? Math.max(30, 1000 - (now - starts[0])) : 60;
        pumpTimer = setTimeout(() => {
          pumpTimer = null;
          pump();
        }, wait);
      }
      return;
    }
    starts.push(now);
    inflight += 1;
    lanes[next].shift()!();
  }
}

function enqueue<T>(task: () => Promise<T>, priority: Priority = 'normal'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    lanes[ORDER[priority]].push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          inflight -= 1;
          pump();
        });
    });
    pump();
  });
}

class RateLimited extends Error {}

// Hace una consulta a un endpoint de IGDB (dentro de la cola). Si IGDB pide calma (429), reintenta.
async function query<T>(endpoint: string, body: string, priority: Priority = 'normal', attempt = 0): Promise<T> {
  try {
    return await rawQuery<T>(endpoint, body, priority);
  } catch (error) {
    if (error instanceof RateLimited && attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      return query<T>(endpoint, body, priority, attempt + 1);
    }
    throw error;
  }
}

async function rawQuery<T>(endpoint: string, body: string, priority: Priority): Promise<T> {
  const credentials = await getCredentials();
  if (!credentials && BUILT_IN.proxyUrl) {
    // Servidor intermedio: él pone las claves.
    return enqueue(async () => {
      const response = await fetch(`${BUILT_IN.proxyUrl}/igdb/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', ...proxyHeaders() },
        body,
      });
      if (response.status === 429) throw new RateLimited('IGDB 429');
      if (!response.ok) throw new Error(`IGDB respondió ${response.status}`);
      return (await response.json()) as T;
    }, priority);
  }
  if (!credentials) throw new Error('La app no tiene acceso a IGDB');
  const accessToken = await getToken(credentials);
  return enqueue(async () => {
    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': credentials.clientId,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });
    if (response.status === 429) throw new RateLimited('IGDB 429');
    if (response.status === 401) {
      token = null;
      AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
    }
    if (!response.ok) throw new Error(`IGDB respondió ${response.status}`);
    return (await response.json()) as T;
  }, priority);
}

const clean = (text: string) => text.replace(/"/g, '').trim();

const toHours = (seconds?: number) =>
  seconds && seconds > 0 ? Math.max(0.5, Math.round((seconds / 3600) * 2) / 2) : null;

type IgdbTimeToBeat = { game_id: number; hastily?: number; normally?: number; completely?: number };

async function timesToBeat(ids: number[], priority: Priority = 'low'): Promise<Record<number, IgdbTimeToBeat>> {
  if (ids.length === 0) return {};
  try {
    const rows = await query<IgdbTimeToBeat[]>(
      'game_time_to_beats',
      `fields game_id,hastily,normally,completely; where game_id = (${ids.join(',')}); limit 500;`,
      priority,
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
  total_rating_count?: number;
  cover?: { image_id: string };
  platforms?: { abbreviation?: string; name: string }[];
  involved_companies?: { company?: { name: string }; developer?: boolean; publisher?: boolean }[];
  version_parent?: number;
  game_type?: number;
};

const LIST_FIELDS =
  'fields name,summary,first_release_date,total_rating,total_rating_count,cover.image_id,' +
  'platforms.name,platforms.abbreviation,involved_companies.company.name,involved_companies.developer,version_parent;';

function toResult(game: IgdbSearchGame, t?: IgdbTimeToBeat): OnlineResult {
  const dev = (game.involved_companies ?? []).find((c) => c.developer && c.company)?.company?.name ?? null;
  return {
    source: 'igdb' as const,
    sourceId: game.id,
    title: game.name,
    year: game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : null,
    platforms: (game.platforms ?? []).map((p) => p.name).join(', '),
    coverUrl: game.cover ? igdbImage(game.cover.image_id, 't_cover_big') : null,
    summary: game.summary ?? null,
    rating: game.total_rating ? Math.round(game.total_rating) : null,
    main: toHours(t?.hastily),
    extra: toHours(t?.normally),
    full: toHours(t?.completely),
    developer: dev,
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null,
    popularity: game.total_rating_count ?? 0,
  };
}

async function withTimes(games: IgdbSearchGame[]): Promise<OnlineResult[]> {
  const times = await timesToBeat(games.map((g) => g.id));
  return games.map((g) => toResult(g, times[g.id]));
}

const stemWhere = (stems: string[]) => stems.map((s) => `name ~ *"${s}"*`).join(' & ');

// Busca de varias maneras a la vez para aguantar erratas y nombres a medias:
// 1) el buscador de IGDB, 2) "contiene" con el principio de cada palabra,
// 3) lo mismo quitando la última palabra (por si está mal escrita).
const searchCache = new Map<string, OnlineResult[]>();

// Busca de varias maneras a la vez para aguantar erratas y nombres a medias:
// el buscador de IGDB y "contiene" con el principio de cada palabra (y sin la última,
// por si está mal escrita). Va por delante de todo lo demás y avisa en cuanto
// llega cada parte (onPartial), así los resultados salen al momento.
export async function searchIgdb(text: string, onPartial?: (results: OnlineResult[]) => void): Promise<OnlineResult[]> {
  const q = clean(text);
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  const stems = searchStems(q);
  const bodies = [`search "${q}"; ${LIST_FIELDS} where version_parent = null; limit 30;`];
  const containsTail = 'version_parent = null; sort total_rating_count desc; limit 30;';
  if (stems.length) bodies.push(`${LIST_FIELDS} where ${stemWhere(stems)} & ${containsTail}`);
  if (stems.length >= 3) bodies.push(`${LIST_FIELDS} where ${stemWhere(stems.slice(0, -1))} & ${containsTail}`);

  const seen = new Set<number>();
  const games: IgdbSearchGame[] = [];
  const rank = () =>
    rankByQuery(
      q,
      games,
      (g) => g.name,
      (g) => g.total_rating_count ?? 0,
    )
      .slice(0, 30)
      .map((g) => toResult(g));
  let failures = 0;
  await Promise.all(
    bodies.map((body) =>
      query<IgdbSearchGame[]>('games', body, 'high')
        .then((batch) => {
          for (const g of batch) {
            if (g.version_parent || seen.has(g.id)) continue;
            seen.add(g.id);
            games.push(g);
          }
          onPartial?.(rank());
        })
        .catch(() => {
          failures += 1;
        }),
    ),
  );
  if (failures === bodies.length) throw new Error('IGDB no respondió');
  const results = rank();
  searchCache.set(key, results);
  if (searchCache.size > 60) searchCache.delete(searchCache.keys().next().value!);
  return results;
}

// ---------- Descubrir ----------

// Mejor valorados de un año (con un mínimo de votos para que sea fiable).
export async function igdbBestOfYear(year: number, limit = 20): Promise<OnlineResult[]> {
  const from = Date.UTC(year, 0, 1) / 1000;
  const to = Date.UTC(year + 1, 0, 1) / 1000;
  const games = await query<IgdbSearchGame[]>(
    'games',
    `${LIST_FIELDS} where first_release_date >= ${from} & first_release_date < ${to} & total_rating_count >= 5 & version_parent = null & cover != null; sort total_rating desc; limit ${limit};`,
  );
  return withTimes(games);
}

// Lo más esperado / reciente: salidos en los últimos meses, por popularidad.
export async function igdbRecentPopular(limit = 10): Promise<OnlineResult[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 120 * 24 * 3600;
  const games = await query<IgdbSearchGame[]>(
    'games',
    `${LIST_FIELDS} where first_release_date >= ${from} & first_release_date <= ${now} & version_parent = null & cover != null & (hypes > 0 | total_rating_count > 0); sort hypes desc; limit ${limit};`,
  );
  return withTimes(games);
}

// Próximos lanzamientos.
export async function igdbUpcoming(limit = 10): Promise<OnlineResult[]> {
  const now = Math.floor(Date.now() / 1000);
  const games = await query<IgdbSearchGame[]>(
    'games',
    `${LIST_FIELDS} where first_release_date > ${now} & version_parent = null & cover != null & hypes > 0; sort hypes desc; limit ${limit};`,
  );
  return withTimes(games);
}

// Calendario de lanzamientos amplio: lo más esperado en general y en cada plataforma
// (si no, los de Nintendo, por ejemplo, se quedan fuera de los 20 primeros).
export const UPCOMING_PLATFORMS: { id: string; label: string; igdb: number[]; match: RegExp }[] = [
  { id: 'nintendo', label: 'Nintendo', igdb: [130, 508], match: /nintendo|switch/i },
  { id: 'playstation', label: 'PlayStation', igdb: [167, 48], match: /playstation|ps[45]/i },
  { id: 'xbox', label: 'Xbox', igdb: [169, 49], match: /xbox/i },
  { id: 'pc', label: 'PC', igdb: [6], match: /\bpc\b|windows/i },
];

export async function igdbUpcomingWide(): Promise<OnlineResult[]> {
  const now = Math.floor(Date.now() / 1000);
  const base = `where first_release_date > ${now} & version_parent = null & cover != null & hypes > 2`;
  const queries = [
    `${LIST_FIELDS} ${base}; sort hypes desc; limit 60;`,
    ...UPCOMING_PLATFORMS.map(
      (p) => `${LIST_FIELDS} ${base} & platforms = (${p.igdb.join(',')}); sort hypes desc; limit 40;`,
    ),
  ];
  const batches = await Promise.all(queries.map((q) => query<IgdbSearchGame[]>('games', q).catch(() => [])));
  const seen = new Set<number>();
  const games = batches.flat().filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  return games.map((g) => toResult(g)); // aún no han salido: no hay duraciones
}

// ---------- Ficha completa ----------

type IgdbDetailGame = IgdbSearchGame & {
  storyline?: string;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  themes?: { name: string }[];
  game_modes?: { name: string }[];
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
  'franchises.name,collections.name,url,version_parent,aggregated_rating,aggregated_rating_count,rating,rating_count,' +
  'themes.name,game_modes.name;';

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
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null,
    platforms: (game.platforms ?? []).map((p) => p.name),
    genres: (game.genres ?? []).map((g) => g.name),
    developers: companies.filter((c) => c.developer && c.company).map((c) => c.company!.name),
    publishers: companies.filter((c) => c.publisher && c.company).map((c) => c.company!.name),
    franchise: game.franchises?.[0]?.name ?? game.collections?.[0]?.name ?? null,
    rating: game.total_rating ? Math.round(game.total_rating) : null,
    ratingCount: game.total_rating_count ?? null,
    ratingLabel: 'IGDB',
    criticRating: game.aggregated_rating ? Math.round(game.aggregated_rating) : null,
    criticCount: game.aggregated_rating_count ?? null,
    userRating: game.rating ? Math.round(game.rating) : null,
    userCount: game.rating_count ?? null,
    themes: (game.themes ?? []).map((t) => t.name),
    modes: (game.game_modes ?? []).map((m) => m.name),
    timeToBeat: t ? { main: toHours(t.hastily), extra: toHours(t.normally), full: toHours(t.completely) } : null,
    url: game.url ?? null,
  };
}

// Busca la ficha por id de IGDB o por nombre (se queda con el mejor resultado).
export async function igdbDetails(
  by: { id?: number; title?: string; year?: number | null },
  priority: Priority = 'high',
): Promise<GameDetails | null> {
  let games: IgdbDetailGame[];
  if (by.id) {
    games = await query<IgdbDetailGame[]>('games', `${DETAIL_FIELDS} where id = ${by.id};`, priority);
  } else if (by.title) {
    games = await query<IgdbDetailGame[]>('games', `search "${clean(by.title)}"; ${DETAIL_FIELDS} limit 10;`, priority);
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
  const times = await timesToBeat([game.id], priority);
  return toDetails(game, times[game.id]);
}

export async function clearIgdbCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith('details:')));
}

// Solo la portada (para las listas): una consulta ligera.
// Portadas por id: se juntan las que se piden a la vez y van en UNA sola consulta.
let coverBatch: Map<number, ((url: string | null) => void)[]> | null = null;
function coverById(id: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!coverBatch) {
      const batch: Map<number, ((url: string | null) => void)[]> = new Map();
      coverBatch = batch;
      setTimeout(() => {
        coverBatch = null;
        const ids = [...batch.keys()];
        query<{ id: number; cover?: { image_id: string } }[]>(
          'games',
          `fields cover.image_id; where id = (${ids.join(',')}); limit ${ids.length};`,
        )
          .then((rows) => {
            const byId = new Map(rows.map((r) => [r.id, r.cover ? igdbImage(r.cover.image_id, 't_cover_big') : null]));
            for (const [gid, cbs] of batch) cbs.forEach((cb) => cb(byId.get(gid) ?? null));
          })
          .catch(() => {
            for (const cbs of batch.values()) cbs.forEach((cb) => cb(null));
          });
      }, 40);
    }
    const list = coverBatch.get(id) ?? [];
    list.push(resolve);
    coverBatch.set(id, list);
  });
}

export async function igdbCover(by: { id?: number; title?: string; year?: number | null }): Promise<string | null> {
  type Row = { cover?: { image_id: string }; first_release_date?: number; version_parent?: number };
  const fields = 'fields cover.image_id,first_release_date,version_parent;';
  if (by.id) return coverById(by.id);
  const rows = await query<Row[]>('games', `search "${clean(by.title ?? '')}"; ${fields} limit 10;`);
  const candidates = rows.filter((r) => r.cover && !r.version_parent);
  const sameYear = candidates.find(
    (r) => by.year && r.first_release_date && new Date(r.first_release_date * 1000).getUTCFullYear() === by.year,
  );
  const hit = sameYear ?? candidates[0] ?? rows.find((r) => r.cover);
  return hit?.cover ? igdbImage(hit.cover.image_id, 't_cover_big') : null;
}

// ---------- Series (para las bibliotecas oficiales) ----------

type IgdbSeriesGame = IgdbSearchGame & { franchises?: number[]; collections?: number[] };

const SERIES_FIELDS = LIST_FIELDS;

// Tipos de juego que cuentan: principal, expansión independiente, remake, remaster y edición ampliada.
const TYPE_FILTERS = ['game_type = (0,4,8,9,10)', 'category = (0,4,8,9,10)', ''];

async function seriesGames(field: 'collections' | 'franchises', id: number): Promise<IgdbSeriesGame[]> {
  for (const typeFilter of TYPE_FILTERS) {
    try {
      const where = [`${field} = (${id})`, 'version_parent = null', typeFilter].filter(Boolean).join(' & ');
      return await query<IgdbSeriesGame[]>(
        'games',
        `${SERIES_FIELDS} where ${where}; sort first_release_date asc; limit 200;`,
        'low',
      );
    } catch {
      // Prueba con el siguiente filtro (los nombres de campo han cambiado entre versiones de IGDB).
    }
  }
  return [];
}

async function findGroup(endpoint: 'collections' | 'franchises', name: string): Promise<number | null> {
  const wanted = name.toLowerCase();
  const exact = await query<{ id: number; name: string }[]>(
    endpoint,
    `fields name; where name ~ "${clean(name)}"; limit 5;`,
    'low',
  ).catch(() => []);
  if (exact.length) return exact[0].id;
  const found = await query<{ id: number; name: string }[]>(
    endpoint,
    `search "${clean(name)}"; fields name; limit 10;`,
    'low',
  ).catch(() => []);
  return (found.find((g) => g.name.toLowerCase() === wanted) ?? found[0])?.id ?? null;
}

export async function igdbSeries(name: string): Promise<OnlineResult[]> {
  let games: IgdbSeriesGame[] = [];
  const collection = await findGroup('collections', name);
  if (collection) games = await seriesGames('collections', collection);
  if (games.length < 3) {
    const franchise = await findGroup('franchises', name);
    if (franchise) {
      const more = await seriesGames('franchises', franchise);
      if (more.length > games.length) games = more;
    }
  }
  const unique = games.filter((g, i) => !g.version_parent && games.findIndex((x) => x.id === g.id) === i);
  return withTimes(unique);
}

// ---------- Resolver una lista de juegos concretos (bibliotecas oficiales) ----------

type Candidate = IgdbSearchGame;

const normName = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function scoreCandidate(game: Candidate, wanted: string, year: number): number {
  const name = normName(game.name);
  const target = normName(wanted);
  let score = 0;
  if (name === target) score += 100;
  else if (name.includes(target) || target.includes(name)) score += 25;
  const gameYear = game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : null;
  if (gameYear === year) score += 40;
  else if (gameYear && Math.abs(gameYear - year) <= 1) score += 20;
  if (game.cover) score += 5;
  // Mejor el juego principal que un DLC, un pack, un mod o una versión regional.
  // (game_type de IGDB: 1 DLC, 3 pack, 5 mod, 6 episodio, 7 temporada, 13 pack, 14 actualización)
  if (game.game_type != null && [1, 3, 5, 6, 7, 13, 14].includes(game.game_type)) score -= 40;
  if (game.version_parent) score -= 30;
  score += Math.min(game.total_rating_count ?? 0, 500) / 100; // desempate por popularidad
  return score;
}

async function findOne(entry: { q: string; year: number; alt?: string[] }): Promise<Candidate | null> {
  let best: { game: Candidate; score: number } | null = null;
  for (const name of [entry.q, ...(entry.alt ?? [])]) {
    // Pedimos también game_type (para descartar DLC y packs); si esta API no lo conoce, sin él.
    const body = `search "${clean(name)}"; ${LIST_FIELDS} limit 15;`;
    const found = await query<Candidate[]>('games', body.replace('version_parent;', 'version_parent,game_type;'), 'low')
      .catch(() => query<Candidate[]>('games', body, 'low'))
      .catch(() => [] as Candidate[]);
    for (const game of found) {
      const score = scoreCandidate(game, name, entry.year);
      if (!best || score > best.score) best = { game, score };
    }
    if (best && best.score >= 125) break; // nombre exacto y año correcto: no hace falta seguir
  }
  return best && best.score >= 25 ? best.game : null;
}

export async function igdbResolve(
  entries: { q: string; year: number; alt?: string[] }[],
): Promise<(OnlineResult | null)[]> {
  const found: (Candidate | null)[] = [];
  for (const entry of entries) found.push(await findOne(entry));
  const ids = found.filter((g): g is Candidate => !!g).map((g) => g.id);
  const times = await timesToBeat(ids);
  return found.map((game) => (game ? toResult(game, times[game.id]) : null));
}

// Datos básicos (desarrolladora, fecha, nota, portada) de varios juegos a la vez.
export async function igdbBasics(ids: number[]): Promise<OnlineResult[]> {
  if (!ids.length) return [];
  const out: OnlineResult[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const games = await query<IgdbSearchGame[]>(
      'games',
      `${LIST_FIELDS} where id = (${chunk.join(',')}); limit 200;`,
      'low',
    );
    out.push(...games.map((g) => toResult(g)));
  }
  return out;
}

// Id de Steam (appid) de un juego de IGDB, para pedir sus logros a Steam.
export async function igdbSteamAppId(igdbId: number): Promise<number | null> {
  const rows = await query<{ uid?: string; url?: string; category?: number; external_game_source?: number }[]>(
    'external_games',
    `fields uid,url,category,external_game_source; where game = ${igdbId}; limit 50;`,
    'normal',
  ).catch(() => []);
  for (const r of rows) {
    const fromUrl = r.url?.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1];
    if (fromUrl) return Number(fromUrl);
    if ((r.category === 1 || r.external_game_source === 1) && r.uid && /^\d+$/.test(r.uid)) return Number(r.uid);
  }
  return null;
}

// Juegos de IGDB a partir de sus appid de Steam (para importar tu biblioteca de Steam).
export async function igdbBySteamAppIds(appIds: number[]): Promise<Map<number, OnlineResult>> {
  const out = new Map<number, OnlineResult>();
  const gameOf = new Map<number, number>(); // igdb id -> appid
  for (let i = 0; i < appIds.length; i += 200) {
    const chunk = appIds.slice(i, i + 200);
    const uids = chunk.map((a) => `"${a}"`).join(',');
    const rows = await query<{ game?: number; uid?: string }[]>(
      'external_games',
      `fields game,uid; where external_game_source = 1 & uid = (${uids}); limit 500;`,
      'normal',
    ).catch(() =>
      query<{ game?: number; uid?: string }[]>(
        'external_games',
        `fields game,uid; where category = 1 & uid = (${uids}); limit 500;`,
        'normal',
      ).catch(() => []),
    );
    for (const r of rows) if (r.game && r.uid && !gameOf.has(r.game)) gameOf.set(r.game, Number(r.uid));
  }
  const ids = [...gameOf.keys()];
  const basics = await igdbBasics(ids).catch(() => []);
  const times = await timesToBeat(ids).catch(() => ({}) as Record<number, IgdbTimeToBeat>);
  for (const r of basics) {
    const appid = gameOf.get(r.sourceId);
    if (!appid) continue;
    const t = (times as Record<number, IgdbTimeToBeat>)[r.sourceId];
    out.set(appid, { ...r, main: toHours(t?.hastily), extra: toHours(t?.normally), full: toHours(t?.completely) });
  }
  return out;
}
