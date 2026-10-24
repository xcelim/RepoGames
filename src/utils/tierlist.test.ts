import { locate, moveTo, newTierList, removeGame } from './tierlist';

describe('tier lists', () => {
  it('mueve juegos entre tiers sin duplicarlos', () => {
    let t = newTierList();
    t = moveTo(t, 'a', -1);
    t = moveTo(t, 'b', -1);
    expect(locate(t, 'a')).toBe(-1);
    t = moveTo(t, 'a', 0);
    expect(locate(t, 'a')).toBe(0);
    expect(t.pool).toEqual(['b']);
    t = moveTo(t, 'b', 0, 0);
    expect(t.tiers[0].gameIds).toEqual(['b', 'a']);
    t = removeGame(t, 'b');
    expect(locate(t, 'b')).toBeNull();
  });
});
