import { eloUpdate } from './elo';

describe('eloUpdate', () => {
  it('reparte 16 puntos entre iguales', () => {
    expect(eloUpdate(1200, 1200)).toEqual([1216, 1184]);
  });
  it('da pocos puntos al favorito y muchos a la sorpresa', () => {
    const [fav] = eloUpdate(1600, 1200);
    const [under] = eloUpdate(1200, 1600);
    expect(fav - 1600).toBeLessThan(5);
    expect(under - 1200).toBeGreaterThan(27);
  });
});
