// Supabase Edge Function «games»: servidor intermedio para IGDB, RAWG y Steam.
// Lo usa la versión web (los navegadores no pueden llamar a esas APIs directamente)
// y así las claves viven aquí, como secretos del proyecto, y no dentro de la web.
//
// Despliegue desde el panel de Supabase:
//   Edge Functions → Deploy a new function → Via Editor → nombre «games» → pega este archivo → Deploy.
//   En la función, desactiva «Verify JWT» (solo devuelve datos públicos de juegos).
//   Edge Functions → Secrets: IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, RAWG_KEY y STEAM_API_KEY.
//
// Rutas:
//   POST /igdb/<endpoint>      (cuerpo Apicalypse)
//   GET  /rawg/<ruta>?<parámetros>
//   GET  /steam/<Interfaz>/<Método>/<versión>/?<parámetros>
//   GET  /price/steam/appdetails?appids=…&cc=es      (precio en la tienda de Steam)
//   GET  /price/cheapshark/games?…                    (mejores ofertas de PC)

/* eslint-disable */
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const IGDB_ENDPOINTS = new Set([
  'games',
  'game_time_to_beats',
  'collections',
  'franchises',
  'covers',
  'screenshots',
  'external_games',
]);

// Solo estos métodos de Steam (los que usa la app).
const STEAM_METHODS = new Set([
  'ISteamUser/ResolveVanityURL/v1',
  'ISteamUser/GetPlayerSummaries/v2',
  'IPlayerService/GetOwnedGames/v1',
  'ISteamUserStats/GetPlayerAchievements/v1',
  'ISteamUserStats/GetSchemaForGame/v2',
  'ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2',
]);

// Solo la web de Saga Quest puede usarlo desde un navegador (la app del móvil no manda «Origin»).
// Se pueden añadir más con el secreto ALLOWED_ORIGINS (separados por comas).
const ALLOWED = new Set(
  ['https://xcelim.github.io', 'http://localhost:8081', 'http://localhost:8099']
    .concat((Deno.env.get('ALLOWED_ORIGINS') ?? '').split(','))
    .map((o) => o.trim())
    .filter(Boolean),
);

// Límite de peticiones por IP (por instancia): de sobra para usar la app, poco para abusar.
const LIMIT = 240; // por minuto
const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    if (hits.size > 20_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  h.n += 1;
  return h.n > LIMIT;
}

const RAWG_PATH = /^games(\/\d+(\/(screenshots|achievements|stores|game-series))?)?$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

let token: { value: string; expiresAt: number } | null = null;

async function twitchToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const params = new URLSearchParams({
    client_id: Deno.env.get('IGDB_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('IGDB_CLIENT_SECRET') ?? '',
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch ${res.status}`);
  const data = await res.json();
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

const json = (body: unknown, status = 200, cache = 0) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      ...(cache && status === 200 ? { 'Cache-Control': `public, max-age=${cache}` } : {}),
    },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED.has(origin)) return new Response('origen no permitido', { status: 403 });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconocida';
  if (limited(ip)) return json({ error: 'demasiadas peticiones, espera un momento' }, 429);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/games(?=\/|$)/, ''); // lo que va detrás de /functions/v1/games
  try {
    if (path.startsWith('/igdb/') && req.method === 'POST') {
      const endpoint = path.slice('/igdb/'.length);
      if (!IGDB_ENDPOINTS.has(endpoint)) return json({ error: 'endpoint no permitido' }, 400);
      const send = async () =>
        fetch(`https://api.igdb.com/v4/${endpoint}`, {
          method: 'POST',
          headers: {
            'Client-ID': Deno.env.get('IGDB_CLIENT_ID') ?? '',
            Authorization: `Bearer ${await twitchToken()}`,
            'Content-Type': 'text/plain',
          },
          body,
        });
      const body = await req.text();
      if (body.length > 4000) return json({ error: 'consulta demasiado larga' }, 400);
      let res = await send();
      if (res.status === 401) {
        token = null; // el token caducó: se pide otro y se reintenta
        res = await send();
      }
      return json(await res.text(), res.status, 3600);
    }
    if (path.startsWith('/rawg/') && req.method === 'GET') {
      const rawgPath = path.slice('/rawg/'.length).replace(/\/+$/, '');
      if (!RAWG_PATH.test(rawgPath)) return json({ error: 'ruta no permitida' }, 400);
      const params = new URLSearchParams(url.search);
      params.set('key', Deno.env.get('RAWG_KEY') ?? '');
      const res = await fetch(`https://api.rawg.io/api/${rawgPath}?${params}`);
      return json(await res.text(), res.status, 3600);
    }
    if (path.startsWith('/steam/') && req.method === 'GET') {
      const method = path.slice('/steam/'.length).replace(/\/+$/, '');
      if (!STEAM_METHODS.has(method)) return json({ error: 'método no permitido' }, 400);
      const params = new URLSearchParams(url.search);
      params.set('key', Deno.env.get('STEAM_API_KEY') ?? '');
      const res = await fetch(`https://api.steampowered.com/${method}/?${params}`);
      return json(await res.text(), res.status, method.startsWith('ISteamUserStats/GetSchema') ? 86400 : 0);
    }
    if (path === '/price/steam/appdetails' && req.method === 'GET') {
      const appids = url.searchParams.get('appids') ?? '';
      if (!/^\d{1,10}$/.test(appids)) return json({ error: 'appid no válido' }, 400);
      const params = new URLSearchParams({ appids, cc: 'es', l: 'spanish' });
      const res = await fetch(`https://store.steampowered.com/api/appdetails?${params}`);
      return json(await res.text(), res.status, 3600);
    }
    if (path === '/price/cheapshark/games' && req.method === 'GET') {
      const params = new URLSearchParams();
      for (const k of ['id', 'steamAppID', 'title', 'limit']) {
        const v = url.searchParams.get(k);
        if (v) params.set(k, v.slice(0, 120));
      }
      const res = await fetch(`https://www.cheapshark.com/api/1.0/games?${params}`, {
        headers: { 'User-Agent': 'SagaQuest/2 (games proxy)' },
      });
      return json(await res.text(), res.status, 3600);
    }
    return json({ error: 'ruta no encontrada' }, 404);
  } catch (error) {
    return json({ error: String(error) }, 502);
  }
});
