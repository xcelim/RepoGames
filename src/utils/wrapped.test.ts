import type { GameRecord, UserGame } from '@/types';

import { buildWrapped, wrappedYears } from './wrapped';

const g = (id: string): GameRecord => ({
  id,
  title: id,
  year: 2020,
  platforms: '',
  version: null,
  series: null,
  main: 10,
  extra: 20,
  full: 40,
  synopsis: null,
  note: null,
  igdbId: 1,
  rawgId: null,
  igdbQuery: null,
  coverUrl: null,
  source: 'igdb',
  createdBy: null,
});
const u = (
  gameId: string,
  status: UserGame['status'],
  finishedAt: string | null,
  rating: number | null = null,
): UserGame =>
  ({
    id: gameId,
    profileId: 'p',
    gameId,
    status,
    rating,
    platform: 'Switch',
    liked: [],
    disliked: [],
    review: '',
    hoursPlayed: null,
    startedAt: null,
    finishedAt,
    owned: false,
    favorite: false,
    addedAt: '2026-01-01',
    updatedAt: '2026-05-01',
  }) as UserGame;

test('wrapped', () => {
  const ugs = [
    u('a', 'beaten', '2026-03-02', 8),
    u('b', 'completed', '2026-03-20', 10),
    u('c', 'beaten', '2025-07-01'),
    u('d', 'playing', null),
  ];
  const games = { a: g('a'), b: g('b'), c: g('c'), d: g('d') };
  expect(wrappedYears(ugs)).toEqual([2026, 2025]);
  const w = buildWrapped(2026, ugs, games, 'main', () => 0);
  expect(w.finished.map((f) => f.game.id)).toEqual(['a', 'b']);
  expect(w.bestMonth).toBe(2);
  expect(w.hours).toBe(10 + 40);
  expect(w.topRated?.game.id).toBe('b');
  expect(w.platform).toEqual({ name: 'Switch', count: 2 });
});
