import { levelFromXp, showcaseSlots, stepFor } from './level';

test('niveles', () => {
  expect(levelFromXp(0)).toEqual({ level: 0, into: 0, need: stepFor(0) });
  expect(levelFromXp(stepFor(0)).level).toBe(1);
  expect(levelFromXp(stepFor(0) + stepFor(1) + 5)).toEqual({ level: 2, into: 5, need: stepFor(2) });
  expect(showcaseSlots(0)).toBe(1);
  expect(showcaseSlots(5)).toBe(2);
  expect(showcaseSlots(99)).toBe(5);
});
