import { PALETTE, SPRITES, spriteStrokes, type SpriteName } from './sprites';

test('todos los sprites son de 16×16 y solo usan colores de la paleta', () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    expect({ name, rows: rows.length }).toEqual({ name, rows: 16 });
    rows.forEach((row, y) => {
      expect({ name, y, len: row.length }).toEqual({ name, y, len: 16 });
      for (const ch of row) if (ch !== '.') expect({ name, ch: PALETTE[ch] ? ch : `?${ch}` }).toEqual({ name, ch });
    });
  }
});

test('genera trazos', () => {
  for (const name of Object.keys(SPRITES) as SpriteName[]) expect(spriteStrokes(name).length).toBeGreaterThan(0);
});

