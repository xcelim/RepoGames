import { fetchDetails, fetchSeries, searchOnline, toGameRecord } from './games';
import { saveCredentials } from './igdb';
import { saveRawgKey } from './rawg';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: async (k: string, v: string) => {
      store[k] = v;
    },
    getItemAsync: async (k: string) => store[k] ?? null,
  };
});

type Call = { url: string; body?: string };
const calls: Call[] = [];

function respond(url: string, body?: string): unknown {
  if (url.includes('id.twitch.tv')) return { access_token: 'tok', expires_in: 3600 };
  if (url.endsWith('/game_time_to_beats')) {
    return [{ game_id: 1, hastily: 36000, normally: 72000, completely: 180000 }];
  }
  if (url.endsWith('/v4/collections')) return [{ id: 5, name: 'The Legend of Zelda' }];
  if (url.endsWith('/v4/games') && body?.includes('collections = (5)')) {
    return [
      { id: 1, name: 'The Legend of Zelda', first_release_date: 509328000, cover: { image_id: 'z1' } },
      { id: 3, name: 'Zelda II', first_release_date: 537580800 },
    ];
  }
  if (url.endsWith('/v4/games') && body?.includes('search')) {
    return [
      {
        id: 1,
        name: 'Hollow Knight',
        first_release_date: 1487894400,
        total_rating: 90.4,
        cover: { image_id: 'abc' },
        platforms: [{ abbreviation: 'PC', name: 'PC' }],
        summary: 'Bichos.',
        screenshots: [{ image_id: 's1' }],
        videos: [{ video_id: 'yt1' }],
        genres: [{ name: 'Platform' }],
        involved_companies: [{ company: { name: 'Team Cherry' }, developer: true, publisher: true }],
      },
      { id: 2, name: 'Hollow Knight (edición)', version_parent: 1 },
    ];
  }
  if (url.includes('api.rawg.io/api/games?')) {
    return {
      results: [
        { id: 10, slug: 'hollow-knight', name: 'Hollow Knight', released: '2017-02-24', background_image: 'r.jpg', playtime: 20, metacritic: 87, platforms: [{ platform: { name: 'PC' } }] },
        { id: 11, slug: 'silksong', name: 'Hollow Knight: Silksong', released: '2025-09-04', background_image: 's.jpg', playtime: 30, platforms: [] },
      ],
    };
  }
  throw new Error(`URL inesperada ${url}`);
}

beforeAll(async () => {
  globalThis.fetch = jest.fn(async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    calls.push({ url, body: init?.body });
    // Simula un IGDB que aún no conoce "game_type": la app debe reintentar con "category".
    if (init?.body?.includes('game_type')) return { ok: false, status: 400, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => respond(url, init?.body) } as Response;
  }) as unknown as typeof fetch;
  await saveCredentials('id', 'secret');
  await saveRawgKey('rawg');
});

describe('búsqueda online', () => {
  it('junta IGDB y RAWG sin duplicados, con horas y portada', async () => {
    const { results, errors } = await searchOnline('hollow knight');
    expect(errors).toEqual([]);
    expect(results.map((r) => `${r.source}:${r.title}`)).toEqual([
      'igdb:Hollow Knight',
      'rawg:Hollow Knight: Silksong',
    ]);
    const hk = results[0];
    expect(hk).toMatchObject({ year: 2017, rating: 90, main: 10, extra: 20, full: 50 });
    expect(hk.coverUrl).toContain('t_cover_big/abc.jpg');

    const record = toGameRecord(hk, 'yo');
    expect(record).toMatchObject({ id: 'igdb-1', igdbId: 1, rawgId: null, source: 'igdb', main: 10 });
  });

  it('obtiene la ficha completa de un juego de IGDB', async () => {
    const record = toGameRecord((await searchOnline('hollow knight')).results[0], 'yo');
    calls.length = 0;
    const details = await fetchDetails({ ...record, igdbId: null, igdbQuery: 'Hollow Knight', id: 'x-1' });
    expect(details).toMatchObject({
      source: 'igdb',
      developers: ['Team Cherry'],
      genres: ['Platform'],
      videoIds: ['yt1'],
      releaseDate: '2017-02-24',
      timeToBeat: { main: 10, extra: 20, full: 50 },
    });
    expect(details?.screenshots[0]).toContain('t_screenshot_big/s1.jpg');
  });
});

describe('bibliotecas oficiales desde la API', () => {
  it('descarga la serie entera en orden, con portada y horas', async () => {
    const games = await fetchSeries('The Legend of Zelda');
    expect(games.map((g) => g.title)).toEqual(['The Legend of Zelda', 'Zelda II']);
    expect(games[0]).toMatchObject({ source: 'igdb', sourceId: 1, year: 1986, main: 10 });
    expect(games[0].coverUrl).toContain('z1');
    expect(calls.some((c) => c.body?.includes('category = (0,4,8,9,10)'))).toBe(true);
  });
});
