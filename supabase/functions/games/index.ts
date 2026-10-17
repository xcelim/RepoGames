// Supabase Edge Function: servidor intermedio para IGDB y RAWG.
// Las claves viven aquí (secretos del proyecto) y no dentro de la APK.
//
// Despliegue:
//   supabase secrets set IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... RAWG_KEY=...
//   supabase functions deploy games --no-verify-jwt
// Y compila la app con EXPO_PUBLIC_GAMES_PROXY_URL=https://<proyecto>.supabase.co/functions/v1/games
//
// Rutas: POST /igdb/<endpoint> (cuerpo Apicalypse)  ·  GET /rawg/<ruta>?<parámetros>

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
]);

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

const json = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/games/, '');
  try {
    if (path.startsWith('/igdb/') && req.method === 'POST') {
      const endpoint = path.slice('/igdb/'.length);
      if (!IGDB_ENDPOINTS.has(endpoint)) return json({ error: 'endpoint no permitido' }, 400);
      const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': Deno.env.get('IGDB_CLIENT_ID') ?? '',
          Authorization: `Bearer ${await twitchToken()}`,
          'Content-Type': 'text/plain',
        },
        body: await req.text(),
      });
      return json(await res.text(), res.status);
    }
    if (path.startsWith('/rawg/') && req.method === 'GET') {
      const params = new URLSearchParams(url.search);
      params.set('key', Deno.env.get('RAWG_KEY') ?? '');
      const res = await fetch(`https://api.rawg.io/api/${path.slice('/rawg/'.length)}?${params}`);
      return json(await res.text(), res.status);
    }
    return json({ error: 'ruta no encontrada' }, 404);
  } catch (error) {
    return json({ error: String(error) }, 502);
  }
});
