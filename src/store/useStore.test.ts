import { OFFICIAL_LISTS } from '../data/catalog';
import { itemsOfList, userGameKey } from '../utils/library';
import type { GameRecord } from '../types';
import { useStore } from './useStore';

const game = (id: string, title: string): GameRecord => ({
  id,
  title,
  year: null,
  platforms: '',
  version: null,
  series: 'zelda',
  main: null,
  extra: null,
  full: null,
  synopsis: null,
  note: null,
  igdbId: Number(id.split('-')[1]),
  rawgId: null,
  igdbQuery: null,
  coverUrl: null,
  source: 'igdb',
  createdBy: null,
});

const get = () => useStore.getState();

beforeEach(() => {
  get().resetAll();
});

describe('perfiles', () => {
  it('al crear un perfil copia las bibliotecas oficiales y las rellena al descargarlas', () => {
    const id = get().createProfile({ displayName: 'Yeray', username: 'yeray', avatarColor: '#f00' });
    expect(get().currentProfileId).toBe(id);
    const mine = Object.values(get().lists).filter((l) => l.ownerId === id);
    expect(mine).toHaveLength(OFFICIAL_LISTS.length);
    const zelda = mine.find((l) => l.forkedFrom === 'official-zelda')!;
    expect(get().pendingSeeds).toContain(zelda.id);

    get().setOfficialList('official-zelda', [game('igdb-1', 'The Legend of Zelda'), game('igdb-2', 'Zelda II')]);
    expect(itemsOfList(get().items, 'official-zelda').map((i) => i.gameId)).toEqual(['igdb-1', 'igdb-2']);
    expect(itemsOfList(get().items, zelda.id).map((i) => i.gameId)).toEqual(['igdb-1', 'igdb-2']);
    expect(get().pendingSeeds).not.toContain(zelda.id);
    expect(get().games['igdb-1'].title).toBe('The Legend of Zelda');

    // Al actualizar no se pierden datos que ya teníamos.
    get().upsertGame({ ...get().games['igdb-1'], main: 12 });
    get().setOfficialList('official-zelda', [game('igdb-1', 'The Legend of Zelda')]);
    expect(get().games['igdb-1'].main).toBe(12);
    expect(itemsOfList(get().items, zelda.id)).toHaveLength(2);
  });

  it('cada perfil tiene sus propios datos', () => {
    const a = get().createProfile({ displayName: 'A', username: 'a', avatarColor: '#f00' });
    get().setStatus('zelda-echoes-of-wisdom', 'playing');
    const b = get().createProfile({ displayName: 'B', username: 'b', avatarColor: '#0f0' });
    expect(get().userGames[userGameKey(a, 'zelda-echoes-of-wisdom')]?.status).toBe('playing');
    expect(get().userGames[userGameKey(b, 'zelda-echoes-of-wisdom')]).toBeUndefined();
    get().deleteProfile(a);
    expect(Object.values(get().lists).some((l) => l.ownerId === a)).toBe(false);
  });
});

describe('listas', () => {
  it('crea, añade, ordena y quita juegos', () => {
    get().createProfile({ displayName: 'Yo', username: 'yo', avatarColor: '#f00' });
    const id = get().createList({ name: '2026', visibility: 'public' });
    expect(get().addToList(id, 'mario-super-mario-odyssey')).toBe(true);
    expect(get().addToList(id, 'mario-super-mario-odyssey')).toBe(false);
    get().addToList(id, 'kirby-kirby-star-allies');
    get().addToList(id, 'persona-persona-5-royal');
    get().moveInList(id, 2, 0);
    expect(itemsOfList(get().items, id).map((i) => i.gameId)).toEqual([
      'persona-persona-5-royal',
      'mario-super-mario-odyssey',
      'kirby-kirby-star-allies',
    ]);
    get().removeFromList(id, 'mario-super-mario-odyssey');
    expect(itemsOfList(get().items, id).map((i) => i.position)).toEqual([0, 1]);
  });

  it('copiar una lista pública crea una carpeta privada en tu perfil', () => {
    const me = get().createProfile({ displayName: 'Yo', username: 'yo', avatarColor: '#f00' });
    const copy = get().forkList('official-mario')!;
    expect(get().lists[copy]).toMatchObject({ ownerId: me, visibility: 'private', forkedFrom: 'official-mario' });
  });

  it('una nota guarda el juego como terminado y pone fecha al terminarlo', () => {
    get().createProfile({ displayName: 'Yo', username: 'yo', avatarColor: '#f00' });
    get().setStatus('ff-final-fantasy-vii-remake', 'completed');
    const ug = Object.values(get().userGames)[0];
    expect(ug.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    get().updateUserGame('ff-final-fantasy-vii-remake', { rating: 10, platform: 'PS5' });
    expect(Object.values(get().userGames)[0]).toMatchObject({ rating: 10, platform: 'PS5' });
  });
});
