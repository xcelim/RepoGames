import type { MyGame } from '@/hooks/useMyGames';
import type { CityState } from '@/types';

import {
  advance,
  assign,
  build,
  buyVillager,
  chop,
  demolish,
  expand,
  HALL_POS,
  hasTree,
  housingCapacity,
  newCity,
  placeError,
  type Result,
  sourcesOf,
  type Stock,
  upgrade,
  VILLAGER_COST,
} from './world';

const rich: Stock = { gold: 100000, wood: 100000, diamonds: 100 };
const none: Stock = { gold: 0, wood: 0, diamonds: 0 };

// Hace falta el estado de un resultado que sabemos que sale bien.
function must(r: Result): CityState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

// Una casilla libre donde cabe un edificio y las dos de su derecha también están libres de árboles.
function freeRun(st: CityState): { x: number; y: number } {
  for (let x = 0; x < st.size - 3; x++)
    for (let y = 0; y < st.size; y++)
      if (!hasTree(st, x, y) && !hasTree(st, x + 1, y) && !hasTree(st, x + 2, y) && placeError(st, 'hut', x, y) === null)
        return { x, y };
  throw new Error('sin hueco');
}

const game = (ug: Partial<MyGame['ug']>): MyGame =>
  ({
    ug: { status: 'beaten', hoursPlayed: null, achievements: [], achievementsTotal: 0, updatedAt: '', finishedAt: null, ...ug },
    game: { id: 'g', main: 10 },
  }) as unknown as MyGame;

// Pueblo con una choza de nivel 2 y una serrería con 2 aldeanos trabajando, con el reloj en 1000 ms.
function sawmillCity(): CityState {
  let st = newCity(7);
  const spot = freeRun(st);
  st = must(build(st, rich, 'hut', spot.x, spot.y));
  st = must(upgrade(st, rich, st.buildings[1].id));
  st = must(build(st, rich, 'sawmill', spot.x, spot.y + 2));
  for (let i = 0; i < 3; i++) st = must(buyVillager(st, rich));
  st = must(assign(st, st.buildings[2].id, 2));
  return { ...st, clock: 1000 };
}

describe('recursos de tu biblioteca', () => {
  test('oro por horas, madera por logros sueltos, diamante por platino', () => {
    const src = sourcesOf([
      { ...game({ hoursPlayed: 12, achievements: ['a', 'b'], achievementsTotal: 5 }) },
      { ...game({ hoursPlayed: 3, achievements: ['a', 'b', 'c'], achievementsTotal: 3 }) }, // platino
      { ...game({ status: 'playing', achievements: ['x'], achievementsTotal: 0 }) }, // jugando: aún no cuenta
    ]);
    expect(src.gold).toBe(150); // 12 h + 3 h = 15 h × 10
    expect(src.wood).toBe(3); // 2 sueltos + 1 (el platino no cuenta como madera)
    expect(src.diamonds).toBe(1);
  });
});

describe('terreno', () => {
  test('el mismo mapa siempre tiene los mismos árboles', () => {
    const trees = (st: CityState) => {
      const out: string[] = [];
      for (let x = 0; x < st.size; x++) for (let y = 0; y < st.size; y++) if (hasTree(st, x, y)) out.push(`${x},${y}`);
      return out;
    };
    expect(trees(newCity(42))).toEqual(trees(newCity(42)));
    expect(trees(newCity(42)).length).toBeGreaterThan(0);
  });

  test('alrededor del ayuntamiento no hay árboles', () => {
    const st = newCity(99);
    for (let x = HALL_POS.x - 1; x <= HALL_POS.x + 1; x++)
      for (let y = HALL_POS.y - 1; y <= HALL_POS.y + 1; y++) expect(hasTree(st, x, y)).toBe(false);
  });

  test('talar un árbol da madera y lo quita del mapa', () => {
    const st = newCity(3);
    let tree: { x: number; y: number } | undefined;
    for (let x = 0; x < st.size && !tree; x++) for (let y = 0; y < st.size && !tree; y++) if (hasTree(st, x, y)) tree = { x, y };
    expect(tree).toBeDefined();
    const after = must(chop(st, tree!.x, tree!.y));
    expect(after.made.wood).toBe(2);
    expect(hasTree(after, tree!.x, tree!.y)).toBe(false);
    expect(chop(st, HALL_POS.x, HALL_POS.y).ok).toBe(false);
  });
});

describe('colocar edificios', () => {
  test('no se pueden pegar: hay que dejar un hueco', () => {
    let st = newCity(7);
    const spot = freeRun(st);
    st = must(build(st, rich, 'hut', spot.x, spot.y));
    expect(placeError(st, 'hut', spot.x + 1, spot.y)).toMatch(/hueco/);
    expect(placeError(st, 'hut', spot.x + 2, spot.y)).toBeNull();
  });

  test('la serrería necesita una choza de nivel 2', () => {
    let st = newCity(7);
    const spot = freeRun(st);
    st = must(build(st, rich, 'hut', spot.x, spot.y));
    expect(placeError(st, 'sawmill', spot.x, spot.y + 2)).toMatch(/Antes necesitas/);
    st = must(upgrade(st, rich, st.buildings[1].id));
    expect(placeError(st, 'sawmill', spot.x, spot.y + 2)).toBeNull();
  });

  test('construir gasta recursos y no se puede sin ellos', () => {
    const st = newCity(7);
    const spot = freeRun(st);
    expect(build(st, none, 'hut', spot.x, spot.y).ok).toBe(false);
    const after = must(build(st, { ...none, wood: 20 }, 'hut', spot.x, spot.y));
    expect(after.spent.wood).toBe(20);
  });

  test('el ayuntamiento no se pone dos veces ni se derriba', () => {
    const st = newCity(7);
    const free = freeRun(st);
    expect(placeError(st, 'hall', free.x, free.y)).toMatch(/Ya tienes/);
    expect(demolish(st, st.buildings[0].id).ok).toBe(false);
  });
});

describe('aldeanos', () => {
  test('la capacidad sale de las casas que tienes', () => {
    expect(housingCapacity(newCity(7))).toBe(4);
  });

  test('no puedes comprar más aldeanos de los que caben', () => {
    let st = newCity(7);
    for (let i = 0; i < 4; i++) st = must(buyVillager(st, rich));
    const r = buyVillager(st, rich);
    expect(r.ok).toBe(false);
  });

  test('cuestan oro', () => {
    const st = must(buyVillager(newCity(7), { ...none, gold: VILLAGER_COST }));
    expect(st.villagers).toBe(1);
    expect(st.spent.gold).toBe(VILLAGER_COST);
    expect(buyVillager(newCity(7), none).ok).toBe(false);
  });

  test('asignar exige aldeanos libres y respeta el máximo del edificio', () => {
    const st = sawmillCity();
    expect(st.villagers).toBe(3);
    // Ya hay 2 trabajando: queda 1 libre, y la serrería admite 3.
    const one = must(assign(st, st.buildings[2].id, 1));
    expect(one.buildings[2].workers).toBe(3);
    expect(assign(one, one.buildings[2].id, 1).ok).toBe(false);
    expect(assign(st, st.buildings[0].id, 1).ok).toBe(false); // el ayuntamiento no tiene trabajo
  });
});

describe('producción', () => {
  test('2 aldeanos producen 3 de madera cada 15 s cada uno', () => {
    const st = sawmillCity();
    // 30 s × 2 aldeanos = 60 s de trabajo = 4 ciclos de 15 s × 3 de madera.
    expect(advance(st, rich, 1000 + 30_000).made.wood).toBe(12);
  });

  test('lo que pasa mientras no estás también cuenta, pero se limita a 12 h', () => {
    const st = sawmillCity();
    const a = advance(st, rich, 1000 + 999 * 3600_000);
    const b = advance(st, rich, 1000 + 12 * 3600_000);
    expect(a.made.wood).toBe(b.made.wood);
    expect(a.made.wood).toBeGreaterThan(0);
  });

  test('el castillo da +25 % de producción', () => {
    const st = sawmillCity();
    const castled: CityState = {
      ...st,
      buildings: [...st.buildings, { id: 'c', kind: 'castle', x: 0, y: 9, level: 1, workers: 0, progress: 0 }],
    };
    // 15 s × 2 aldeanos = 2 ciclos. Sin castillo: 3 por ciclo. Con él: round(3 × 1.25) = 4.
    expect(advance(st, rich, 1000 + 15_000).made.wood).toBe(6);
    expect(advance(castled, rich, 1000 + 15_000).made.wood).toBe(8);
  });

  test('sin aldeanos no hay producción, y el reloj avanza igualmente', () => {
    const st = { ...newCity(7), clock: 1000 };
    const after = advance(st, rich, 1000 + 60_000);
    expect(after.made).toEqual({});
    expect(after.clock).toBe(61_000);
  });

  test('la joyería se para sin oro y funde 60 de oro por diamante', () => {
    const st = sawmillCity();
    const withJeweler: CityState = {
      ...st,
      buildings: [...st.buildings, { id: 'j', kind: 'jeweler', x: 0, y: 9, level: 1, workers: 2, progress: 0 }],
    };
    expect(advance(withJeweler, none, 1000 + 600_000).made.diamonds ?? 0).toBe(0);
    // Oro disponible = lo que ya gastaste + 180 (la partida de prueba ya ha gastado en otras cosas).
    const gold = (st.spent.gold ?? 0) + 180;
    const out = advance(withJeweler, { ...none, gold }, 1000 + 600_000);
    // 2 aldeanos × 10 min = 20 ciclos posibles, pero solo hay oro para 3 diamantes (180 / 60).
    expect(out.made.diamonds).toBe(3);
    expect(out.spent.gold).toBe((st.spent.gold ?? 0) + 180);
  });
});

describe('demoler, ampliar y mejorar', () => {
  test('derribar devuelve la mitad de lo gastado', () => {
    let st = newCity(7);
    const spot = freeRun(st);
    st = must(build(st, { ...none, wood: 20 }, 'hut', spot.x, spot.y));
    const after = must(demolish(st, st.buildings[1].id));
    expect(after.spent.wood ?? 0).toBe(10);
    expect(after.buildings.length).toBe(1);
  });

  test('ampliar sube de 10 a 12 y se para en 16', () => {
    let st = must(expand(newCity(7), rich));
    expect(st.size).toBe(12);
    st = must(expand(st, rich));
    st = must(expand(st, rich));
    expect(st.size).toBe(16);
    expect(expand(st, rich).ok).toBe(false);
  });

  test('mejorar la choza sube su capacidad', () => {
    let st = newCity(7);
    const spot = freeRun(st);
    st = must(build(st, rich, 'hut', spot.x, spot.y));
    const before = housingCapacity(st);
    st = must(upgrade(st, rich, st.buildings[1].id));
    expect(housingCapacity(st)).toBe(before + 2);
  });
});
