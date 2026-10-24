import type { UserGame } from '@/types';

import { compatibility } from './compat';

const ug = (gameId: string, rating: number | null): UserGame =>
  ({ id: gameId, profileId: 'p', gameId, status: 'beaten', rating, platform: null, liked: [], disliked: [], review: '', hoursPlayed: null, startedAt: null, finishedAt: null, owned: false, favorite: false, addedAt: '', updatedAt: '' }) as UserGame;

test('compatibilidad', () => {
  const a = [ug('1', 9), ug('2', 8), ug('3', 5), ug('4', 7)];
  const b = [ug('1', 9), ug('2', 9), ug('3', 6), ug('9', 10)];
  const c = compatibility(a, b);
  expect(c.shared).toEqual(['1', '2', '3']);
  expect(c.bothLoved).toEqual(['1', '2']);
  expect(c.forYou).toEqual(['9']);
  expect(c.score).toBeGreaterThan(80);
  expect(compatibility(a, [ug('7', 2)]).score).toBe(0);
});
