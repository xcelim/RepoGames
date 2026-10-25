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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/games/, '');
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
      let res = await send();
      if (res.status === 401) {
        token = null; // el token caducó: se pide otro y se reintenta
        res = await send();
      }
      return json(await res.text(), res.status, 3600);
    }
    if (path.startsWith('/rawg/') && req.method === 'GET') {
      const params = new URLSearchParams(url.search);
      params.set('key', Deno.env.get('RAWG_KEY') ?? '');
      const res = await fetch(`https://api.rawg.io/api/${path.slice('/rawg/'.length)}?${params}`);
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
