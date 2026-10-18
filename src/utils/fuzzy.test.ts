import { fuzzyScore, rankByQuery, searchStems } from './fuzzy';

describe('búsqueda difusa', () => {
  it('aguanta erratas y nombres a medias', () => {
    expect(fuzzyScore('Minecraf', 'Minecraft')).toBeGreaterThan(0.9);
    expect(fuzzyScore('fire emblem blazing blaze', 'Fire Emblem: The Blazing Blade')).toBeGreaterThan(0.75);
    expect(fuzzyScore('zelda breath wild', 'The Legend of Zelda: Breath of the Wild')).toBeGreaterThan(0.8);
    expect(fuzzyScore('persona 5', 'Persona V')).toBeGreaterThan(0.9);
    expect(fuzzyScore('hollow nigth', 'Hollow Knight')).toBeGreaterThan(0.6);
    expect(fuzzyScore('minecraf', 'Need for Speed')).toBeLessThan(0.3);
  });

  it('ordena poniendo primero lo que más se parece', () => {
    const titles = ['Fire Emblem: Three Houses', 'Fire Emblem: The Blazing Blade', 'Fire Emblem Engage', 'Blaze Union'];
    const ranked = rankByQuery('fire emblem blazing blaze', titles, (t) => t);
    expect(ranked[0]).toBe('Fire Emblem: The Blazing Blade');
  });

  it('genera trozos de palabra para la API', () => {
    expect(searchStems('Minecraf')).toEqual(['minec']);
    expect(searchStems('fire emblem blazing blaze')).toEqual(['fire', 'embl', 'blazi', 'blaz']);
  });
});
