// Prueba la sincronización con una "base de datos" falsa en memoria que se comporta como Supabase.
import { useStore, persistedPart } from '@/store/useStore';

import { diffState, flush, markAllDirty, pull, startSyncEngine } from './engine';

type Row = Record<string, unknown>;
const mockDb: Record<string, Row[]> = {
  profiles: [],
  games: [],
  lists: [],
  list_items: [],
  user_games: [],
  list_follows: [],
  list_members: [],
};
const mockFail: { table?: string } = {};

const PK: Record<string, string[]> = {
  profiles: ['id'],
  games: ['id'],
  lists: ['id'],
  list_items: ['id'],
  user_games: ['profile_id', 'game_id'],
  list_follows: ['profile_id', 'list_id'],
  list_members: ['list_id', 'profile_id'],
};

function mockQuery(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let action: 'select' | 'delete' = 'select';
  const api = {
    select: () => api,
    eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), api),
    neq: (col: string, val: unknown) => (filters.push((r) => r[col] !== val), api),
    in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), api),
    order: () => api,
    limit: () => api,
    delete: () => ((action = 'delete'), api),
    maybeSingle: async () => {
      const rows = mockDb[table].filter((r) => filters.every((f) => f(r)));
      return { data: rows[0] ?? null, error: null };
    },
    upsert: async (rows: Row | Row[]) => {
      if (mockFail.table === table) return { data: null, error: { message: 'fallo simulado' } };
      for (const row of Array.isArray(rows) ? rows : [rows]) {
        const keys = PK[table];
        const i = mockDb[table].findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) mockDb[table][i] = { ...mockDb[table][i], ...row };
        else mockDb[table].push({ ...row });
      }
      return { data: null, error: null };
    },
    then: (resolve: (v: { data: Row[] | null; error: null }) => void) => {
      const matches = mockDb[table].filter((r) => filters.every((f) => f(r)));
      if (action === 'delete') {
        mockDb[table] = mockDb[table].filter((r) => !matches.includes(r));
        // Borrar una lista borra sus juegos (on delete cascade).
        if (table === 'lists') {
          const ids = matches.map((r) => r.id);
          mockDb.list_items = mockDb.list_items.filter((r) => !ids.includes(r.list_id));
        }
        resolve({ data: null, error: null });
      } else resolve({ data: matches, error: null });
    },
  };
  return api;
}

jest.mock('./supabase', () => ({
  getSupabase: () => ({
    from: mockQuery,
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: () => undefined,
  }),
  isCloudEnabled: () => true,
  cloudConfig: () => ({ url: 'x', anonKey: 'y' }),
}));
jest.mock('./net', () => {
  const { create } = jest.requireActual('zustand');
  return { useConnection: create(() => ({ online: true, checked: true })), reportNetworkFailure: () => undefined };
});
jest.mock('expo-image', () => ({ Image: { prefetch: async () => true, clearDiskCache: async () => true } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined }));

let stopEngine: (() => void) | null = null;
afterEach(() => {
  stopEngine?.();
  stopEngine = null;
});

const UID = 'u-1';
const profile = {
  id: UID,
  username: 'yeray',
  displayName: 'Yeray',
  bio: '',
  avatarColor: '#f00',
  createdAt: '2026-01-01T00:00:00.000Z',
};
const game = (id: string) => ({
  id,
  title: id,
  year: 2020,
  platforms: '',
  version: null,
  series: null,
  main: 10,
  extra: null,
  full: null,
  synopsis: null,
  note: null,
  igdbId: 1,
  rawgId: null,
  igdbQuery: null,
  coverUrl: null,
  source: 'igdb' as const,
  createdBy: null,
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  for (const t of Object.keys(mockDb)) mockDb[t] = [];
  delete mockFail.table;
  useStore.getState().clearLocalData();
  useStore.getState().adoptAccount(UID, 'y@x.com', profile);
  useStore.setState({ dirty: {} });
});

describe('detectar cambios', () => {
  it('apunta como pendiente lo tuyo y no lo de otros', () => {
    const prev = useStore.getState();
    useStore.getState().upsertGame(game('igdb-1'));
    useStore.getState().setStatus('igdb-1', 'playing');
    const id = useStore.getState().createList({ name: '2026' });
    useStore.getState().addToList(id, 'igdb-1');
    useStore.getState().toggleFollow('official-zelda');
    const keys = diffState(prev, useStore.getState(), UID);
    expect(keys).toEqual(
      expect.arrayContaining(['games|igdb-1', 'user_games|igdb-1', `lists|${id}`, 'list_follows|official-zelda']),
    );
    expect(keys.some((k) => k.startsWith('list_items|'))).toBe(true);
  });
});

describe('subir y bajar', () => {
  it('sube los cambios, borra lo borrado y solo quita de pendientes lo que se guardó', async () => {
    stopEngine = startSyncEngine();
    markAllDirty(UID);
    const s = useStore.getState();
    s.upsertGame(game('igdb-1'));
    s.upsertGame(game('igdb-2'));
    s.setStatus('igdb-1', 'beaten');
    s.updateUserGame('igdb-1', { rating: 9, review: 'Genial' });
    const listId = s.createList({ name: '2026', visibility: 'public' });
    s.addToList(listId, 'igdb-1');
    s.addToList(listId, 'igdb-2');
    s.moveInList(listId, 1, 0);
    s.toggleFollow('official-zelda');
    await flush();
    expect(Object.keys(useStore.getState().dirty)).toEqual([]);
    expect(mockDb.user_games).toEqual([
      expect.objectContaining({ profile_id: UID, game_id: 'igdb-1', status: 'beaten', rating: 9 }),
    ]);
    expect(mockDb.lists.map((l) => l.name)).toContain('2026');
    expect(mockDb.list_items.sort((a, b) => Number(a.position) - Number(b.position)).map((i) => i.game_id)).toEqual([
      'igdb-2',
      'igdb-1',
    ]);
    expect(mockDb.games.map((g) => g.id).sort()).toEqual(['igdb-1', 'igdb-2']);
    expect(mockDb.games[0].created_by).toBeNull();
    expect(mockDb.list_follows).toHaveLength(1);
    expect(mockDb.profiles[0]).toMatchObject({ username: 'yeray', settings: { skin: 'neon', durationMode: 'main' } });

    // Borrar
    useStore.getState().removeFromList(listId, 'igdb-2');
    useStore.getState().removeFromLibrary('igdb-1');
    await flush();
    expect(mockDb.list_items.map((i) => i.game_id)).toEqual(['igdb-1']);
    expect(mockDb.user_games).toEqual([]);
    useStore.getState().deleteList(listId);
    await flush();
    expect(mockDb.lists.filter((l) => l.owner_id === UID)).toEqual([]);
    expect(mockDb.list_items).toEqual([]);
  });

  it('si la subida falla, lo cambiado sigue pendiente', async () => {
    stopEngine = startSyncEngine();
    useStore.getState().upsertGame(game('igdb-1'));
    useStore.getState().setStatus('igdb-1', 'playing');
    mockFail.table = 'user_games';
    await expect(flush()).rejects.toThrow('fallo simulado');
    expect(useStore.getState().dirty['user_games|igdb-1']).toBeDefined();
    delete mockFail.table;
    await flush();
    expect(useStore.getState().dirty['user_games|igdb-1']).toBeUndefined();
  });

  it('al bajar no pisa lo que está pendiente y quita lo borrado en otro móvil', async () => {
    mockDb.profiles.push({
      id: UID,
      username: 'yeray',
      display_name: 'Yeray (nube)',
      bio: '',
      avatar_color: '#0f0',
      settings: { skin: 'cozy' },
      created_at: 'x',
    });
    mockDb.games.push({ ...game('igdb-9'), igdb_id: 9, cover_url: 'c.jpg', created_by: null });
    mockDb.lists.push({
      id: 'L1',
      owner_id: UID,
      name: 'De otro móvil',
      description: '',
      visibility: 'private',
      color: '#000',
      color2: '#fff',
      icon: 'albums',
      forked_from: null,
      official: false,
      created_at: 'x',
      updated_at: 'x',
    });
    mockDb.list_items.push({ id: 'I1', list_id: 'L1', game_id: 'igdb-9', position: 0, added_at: 'x' });
    mockDb.user_games.push({
      profile_id: UID,
      game_id: 'igdb-9',
      status: 'playing',
      rating: 5,
      liked: [],
      disliked: [],
      review: '',
      owned: false,
      favorite: false,
      added_at: 'x',
      updated_at: 'x',
    });

    // En el móvil: una nota pendiente de subir para el mismo juego y una lista vieja ya borrada en la nube.
    useStore.setState({
      userGames: {
        [`${UID}:igdb-9`]: {
          id: `${UID}:igdb-9`,
          profileId: UID,
          gameId: 'igdb-9',
          status: 'beaten',
          rating: 10,
          platform: null,
          liked: [],
          disliked: [],
          review: '',
          hoursPlayed: null,
          startedAt: null,
          finishedAt: null,
          owned: false,
          favorite: false,
          addedAt: 'x',
          updatedAt: 'y',
        },
      },
      lists: {
        OLD: {
          id: 'OLD',
          ownerId: UID,
          name: 'Vieja',
          description: '',
          visibility: 'private',
          color: '',
          color2: '',
          icon: '',
          forkedFrom: null,
          official: false,
          createdAt: 'x',
          updatedAt: 'x',
        },
      },
      dirty: { 'user_games|igdb-9': 1 },
    });
    await pull();
    const s = useStore.getState();
    expect(s.userGames[`${UID}:igdb-9`].rating).toBe(10); // lo pendiente manda
    expect(s.lists.OLD).toBeUndefined(); // borrada en otro móvil
    expect(s.lists.L1.name).toBe('De otro móvil');
    expect(Object.values(s.items).filter((i) => i.listId === 'L1')).toHaveLength(1);
    expect(s.games['igdb-9'].coverUrl).toBe('c.jpg');
    expect(s.profiles[UID].displayName).toBe('Yeray (nube)');
    expect(s.skin).toBe('cozy');
  });

  it('baja las listas cooperativas y las que sigues; en las cooperativas puedes cambiar el orden', async () => {
    const L = (id: string, owner: string, visibility = 'private') => ({
      id,
      owner_id: owner,
      name: id,
      description: '',
      visibility,
      color: '#000',
      color2: '#fff',
      icon: 'albums',
      forked_from: null,
      official: false,
      created_at: 'x',
      updated_at: 'x',
    });
    mockDb.games.push(
      { ...game('igdb-1'), igdb_id: 1, created_by: null },
      { ...game('igdb-2'), igdb_id: 2, created_by: null },
    );
    mockDb.lists.push(L('COOP', 'u-2'), L('PUB', 'u-3', 'public'));
    mockDb.list_members.push({ list_id: 'COOP', profile_id: UID });
    mockDb.list_follows.push({ profile_id: UID, list_id: 'PUB' });
    mockDb.list_items.push(
      { id: 'c1', list_id: 'COOP', game_id: 'igdb-1', position: 0, added_at: 'x' },
      { id: 'c2', list_id: 'COOP', game_id: 'igdb-2', position: 1, added_at: 'x' },
      { id: 'p1', list_id: 'PUB', game_id: 'igdb-2', position: 0, added_at: 'x' },
    );
    await pull();
    let s = useStore.getState();
    expect(s.lists.COOP).toMatchObject({ ownerId: 'u-2', members: [UID] });
    expect(s.lists.PUB.ownerId).toBe('u-3');
    expect(Object.values(s.items).filter((i) => i.listId === 'PUB')).toHaveLength(1);

    // Reordenar la cooperativa se sube; la de otro (solo seguida) no.
    const prev = useStore.getState();
    s.moveInList('COOP', 1, 0);
    s = useStore.getState();
    const keys = diffState(prev, s, UID);
    expect(keys.filter((k) => k.startsWith('list_items|')).sort()).toEqual(['list_items|c1', 'list_items|c2']);
    expect(keys.some((k) => k.startsWith('lists|'))).toBe(false);

    // Si el autor cambia la lista seguida, al bajar se ve el cambio.
    mockDb.list_items.push({ id: 'p2', list_id: 'PUB', game_id: 'igdb-1', position: 1, added_at: 'x' });
    useStore.setState({ dirty: {} });
    await pull();
    expect(Object.values(useStore.getState().items).filter((i) => i.listId === 'PUB')).toHaveLength(2);

    // Si te sacan de la cooperativa, desaparece.
    mockDb.list_members = [];
    await pull();
    expect(useStore.getState().lists.COOP).toBeUndefined();
  });

  it('una cuenta nueva NO recibe copias de las bibliotecas oficiales (ni vuelven al borrar todo)', async () => {
    await pull();
    const own = Object.values(useStore.getState().lists).filter((l) => l.ownerId === UID);
    expect(own.length).toBe(0);
  });
});

describe('descarga opcional', () => {
  it('sin descarga solo se guardan ajustes y pendientes; con descarga, todo', () => {
    const s = useStore.getState();
    s.upsertGame(game('igdb-1'));
    s.upsertGame(game('igdb-2'));
    s.setStatus('igdb-1', 'playing');
    s.setStatus('igdb-2', 'playing');
    useStore.setState({ dirty: { 'user_games|igdb-2': 1 } });
    const light = persistedPart(useStore.getState());
    expect(Object.keys(light.userGames ?? {})).toEqual([`${UID}:igdb-2`]);
    expect(Object.keys(light.games ?? {})).toEqual(['igdb-2']);
    expect(light.cloudUserId).toBe(UID);
    useStore.getState().setOffline(true, 'now');
    const full = persistedPart(useStore.getState());
    expect(Object.keys(full.userGames ?? {})).toHaveLength(2);
  });
});

afterAll(async () => {
  await wait(1500);
});
