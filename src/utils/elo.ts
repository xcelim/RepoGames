// Sistema Elo de los duelos: el ganador sube más cuanto menos se esperaba que ganara.
export const ELO_START = 1200;
const K = 32;

export function eloUpdate(winner: number, loser: number): [number, number] {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  const delta = Math.round(K * (1 - expected));
  return [winner + delta, loser - delta];
}
