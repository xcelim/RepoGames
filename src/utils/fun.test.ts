import { daysSince, funFact } from './fun';

test('equivalencias y días', () => {
  expect(funFact(0)).toBeNull();
  expect(funFact(120)).toMatch(/^Has jugado 120 h: como /);
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  expect(daysSince(iso)).toBe(0);
});
