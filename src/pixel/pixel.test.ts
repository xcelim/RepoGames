// Comprueba que los sprites se generan bien. Con SPRITE_PREVIEW=<carpeta> vuelca los trazos
// para revisarlos como imagen.
import { writeFileSync } from 'fs';
import { BUILDING_ART_KINDS } from './buildings';
import { buildingArt, decorArt, grassArt, iconArt, treeArt, villagerArt } from './index';

test('todos los edificios se dibujan con trazos, a cada nivel y tamaño', () => {
  for (const kind of BUILDING_ART_KINDS)
    for (const lvl of [1, 2, 3, 4]) {
      const a = buildingArt(kind, lvl, 1);
      expect(a.strokes.length).toBeGreaterThan(3);
      expect(a.w).toBe(32);
    }
  expect(buildingArt('castle', 1, 3).w).toBe(96);
});

test('árboles, decoración, aldeanos e iconos tienen trazos', () => {
  expect(treeArt(0).strokes.length).toBeGreaterThan(3);
  expect(decorArt('well').strokes.length).toBeGreaterThan(3);
  expect(villagerArt('#2f5fb8').strokes.length).toBeGreaterThan(3);
  expect(iconArt('gold').strokes.length).toBeGreaterThan(1);
  expect(grassArt().strokes.length).toBeGreaterThan(3);
});

test('vista previa (solo con SPRITE_PREVIEW)', () => {
  const dir = process.env.SPRITE_PREVIEW;
  if (!dir) return;
  const out: Record<string, unknown> = {};
  for (const kind of BUILDING_ART_KINDS)
    for (const lvl of [1, 2, 3, 4]) out[`${kind}-${lvl}`] = { ...buildingArt(kind, lvl, 1), size: 1 };
  out['castle-3'] = { ...buildingArt('castle', 3, 3), size: 3 };
  out['hall-2'] = { ...buildingArt('hall', 2, 2), size: 2 };
  out['tree-0'] = { ...treeArt(0), size: 1 };
  out['tree-1'] = { ...treeArt(1), size: 1 };
  for (const d of ['flowers', 'torch', 'well', 'banner', 'statue', 'fountain', 'bench', 'bush'])
    out[`deco-${d}`] = { ...decorArt(d), size: 1 };
  out['villager'] = { ...villagerArt('#2f5fb8'), size: 1 };
  writeFileSync(`${dir}/art.json`, JSON.stringify(out));
});
