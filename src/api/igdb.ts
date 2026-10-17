import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type IgdbInfo = {
  coverUrl: string | null;
  screenshotUrl: string | null;
  videoId: string | null;
  summary: string | null;
  rating: number | null;
};

// Forma de la respuesta de IGDB (solo los campos que pedimos).
type IgdbGame = {
  name: string;
  summary?: string;
  total_rating?: number;
  cover?: { image_id: string };
  screenshots?: { image_id: string }[];
  videos?: { video_id: string }[];
};

type Credentials = { clientId: string; secret: string };

const ID_KEY = 'igdb-client-id';
const SECRET_KEY = 'igdb-client-secret';
const CACHE_PREFIX = 'igdb:';
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';

let token: { value: string; expiresAt: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();

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

// ---------- Datos de un juego ----------

export async function fetchGameInfo(query: string): Promise<IgdbInfo | null> {
  if (!query) return null;

  const cached = await AsyncStorage.getItem(CACHE_PREFIX + query);
  if (cached) return JSON.parse(cached) as IgdbInfo;

  const credentials = await getCredentials();
  if (!credentials) return null;

  return enqueue(async () => {
    const accessToken = await getToken(credentials);
    // "id:1234" busca un juego concreto de IGDB; cualquier otro texto, por nombre.
    const byId = /^id:(\d+)$/.exec(query);
    const body =
      (byId ? `where id = ${byId[1]}; ` : `search "${query.replace(/"/g, '')}"; `) +
      'fields name,summary,total_rating,cover.image_id,screenshots.image_id,videos.video_id; ' +
      'limit 5;';

    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': credentials.clientId,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`IGDB respondió ${response.status}`);
    }

    const results: IgdbGame[] = await response.json();
    const hit = results.find((game) => game.cover) ?? results[0];

    const info: IgdbInfo = {
      coverUrl: hit?.cover ? `${IMAGE_BASE}/t_cover_big/${hit.cover.image_id}.jpg` : null,
      screenshotUrl: hit?.screenshots?.[0]
        ? `${IMAGE_BASE}/t_screenshot_big/${hit.screenshots[0].image_id}.jpg`
        : null,
      videoId: hit?.videos?.[0]?.video_id ?? null,
      summary: hit?.summary ?? null,
      rating: hit?.total_rating ? Math.round(hit.total_rating) : null,
    };

    await AsyncStorage.setItem(CACHE_PREFIX + query, JSON.stringify(info));
    return info;
  });
}

// ---------- Buscar juegos (para añadir cualquier juego) ----------

export type IgdbSearchResult = {
  igdbId: number;
  title: string;
  year: number | null;
  platforms: string;
  coverUrl: string | null;
  summary: string | null;
};

type IgdbSearchGame = {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  cover?: { image_id: string };
  platforms?: { abbreviation?: string; name: string }[];
};

export async function hasIgdbCredentials(): Promise<boolean> {
  return (await getCredentials()) !== null;
}

export async function searchGames(query: string): Promise<IgdbSearchResult[]> {
  const text = query.trim().replace(/"/g, '');
  if (text.length < 2) return [];
  const credentials = await getCredentials();
  if (!credentials) throw new Error('Configura tus claves de IGDB en Ajustes para buscar cualquier juego.');

  return enqueue(async () => {
    const accessToken = await getToken(credentials);
    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': credentials.clientId,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
      },
      body:
        `search "${text}"; ` +
        'fields name,summary,first_release_date,cover.image_id,platforms.name,platforms.abbreviation; ' +
        'limit 25;',
    });
    if (!response.ok) {
      throw new Error(`IGDB respondió ${response.status}`);
    }
    const results: IgdbSearchGame[] = await response.json();
    return results.map((game) => ({
      igdbId: game.id,
      title: game.name,
      year: game.first_release_date
        ? new Date(game.first_release_date * 1000).getUTCFullYear()
        : null,
      platforms: (game.platforms ?? []).map((p) => p.abbreviation ?? p.name).join(', '),
      coverUrl: game.cover ? `${IMAGE_BASE}/t_cover_big/${game.cover.image_id}.jpg` : null,
      summary: game.summary ?? null,
    }));
  });
}

export async function clearIgdbCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(CACHE_PREFIX)));
}
