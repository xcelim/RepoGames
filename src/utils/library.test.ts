import { OFFICIAL_LISTS, OFFICIAL_SERIES } from '../data/catalog';
import type { GameRecord, ListItem, UserGame } from '../types';
import { buildEntries, entryStats, filterEntries, itemsOfList, moveItem, sortEntries, userGameKey } from './library';

function game(id: string, title: string, year: number, main: number): GameRecord {
  return {
    id,
    title,
    year,
    platforms: 'Switch',
    version: null,
    series: null,
    main,
    extra: main * 2,
    full: main * 3,
    synopsis: null,
    note: null,
    igdbId: null,
    rawgId: null,
    igdbQuery: null,
    coverUrl: null,
    source: 'custom',
    createdBy: 'yo',
  };
}

function userGame(gameId: string, patch: Partial<UserGame>): UserGame {
  return {
    id: userGameKey('yo', gameId),
    profileId: 'yo',
    gameId,
    status: 'backlog',
    rating: null,
    platform: null,
    liked: [],
    disliked: [],
    review: '',
    hoursPlayed: null,
    startedAt: null,
    finishedAt: null,
    owned: false,
    favorite: false,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

const games = {
  a: game('a', 'Alfa', 2020, 30),
  b: game('b', 'Beta', 1998, 10),
  c: game('c', 'Gamma', 2010, 20),
};
const items: ListItem[] = ['a', 'b', 'c'].map((id, position) => ({
  id: `i-${id}`,
  listId: 'mi-lista',
  gameId: id,
  position,
  addedAt: `2026-01-0${position + 1}T00:00:00.000Z`,
}));
const userGames = {
  [userGameKey('yo', 'a')]: userGame('a', { status: 'beaten', rating: 7, platform: 'PS5' }),
  [userGameKey('yo', 'b')]: userGame('b', { status: 'playing', rating: 9, platform: 'Switch' }),
};
const entries = buildEntries(items, games, userGames, 'yo');

describe('bibliotecas oficiales', () => {
  it('solo definen la serie: los juegos vienen de la API', () => {
    expect(OFFICIAL_SERIES.map((s) => s.id)).toEqual([
      'persona',
      'fe',
      'ff',
      'zelda',
      'kirby',
      'mario',
      'xeno',
      'metroid',
    ]);
    expect(OFFICIAL_LISTS.every((l) => l.official && l.visibility === 'public')).toBe(true);
    expect(itemsOfList({}, 'official-zelda')).toEqual([]);
  });
});

describe('sortEntries', () => {
  it('respeta el orden manual', () => {
    expect(sortEntries(entries, 'manual', 'main').map((e) => e.game.id)).toEqual(['a', 'b', 'c']);
  });

  it('ordena por nota y deja los que no tienen nota al final (en los dos sentidos)', () => {
    expect(sortEntries(entries, 'mine-high', 'main').map((e) => e.game.id)).toEqual(['b', 'a', 'c']);
    expect(sortEntries(entries, 'mine-low', 'main').map((e) => e.game.id)).toEqual(['a', 'b', 'c']);
  });

  it('ordena por lanzamiento, duración y alfabeto como IGN', () => {
    expect(sortEntries(entries, 'release-old', 'main').map((e) => e.game.id)).toEqual(['b', 'c', 'a']);
    expect(sortEntries(entries, 'release-new', 'main').map((e) => e.game.id)).toEqual(['a', 'c', 'b']);
    expect(sortEntries(entries, 'hltb-long', 'full').map((e) => e.game.id)).toEqual(['a', 'c', 'b']);
    expect(sortEntries(entries, 'za', 'main').map((e) => e.game.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('filterEntries', () => {
  it('filtra por estado, plataforma y texto', () => {
    const base = { statuses: [], includeUntracked: true, platform: null, query: '' };
    expect(filterEntries(entries, { ...base, statuses: ['playing'], includeUntracked: false })).toHaveLength(1);
    expect(filterEntries(entries, { ...base, statuses: ['playing'] })).toHaveLength(2);
    expect(filterEntries(entries, { ...base, platform: 'PS5' })[0].game.id).toBe('a');
    expect(filterEntries(entries, { ...base, query: 'gam' })[0].game.id).toBe('c');
  });
});

describe('entryStats', () => {
  it('cuenta terminados, media y horas pendientes', () => {
    const stats = entryStats(entries, 'main');
    expect(stats.games).toBe(3);
    expect(stats.finished).toBe(1);
    expect(stats.averageRating).toBe(8);
    expect(stats.totalHours).toBe(60);
    expect(stats.hoursLeft).toBe(30);
  });
});

describe('moveItem', () => {
  it('mueve un elemento y mantiene el resto en orden', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
  });
});
