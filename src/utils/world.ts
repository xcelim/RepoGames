// Tu pueblo medieval: un terreno de hierba con árboles que talar, edificios separados por un hueco,
// aldeanos que trabajan y recursos. El oro sale de tus horas, la madera de tus logros sueltos y los
// diamantes de tus platinos. Lo demás lo producen tus edificios cada ciclo de trabajo.
import type { MyGame } from '@/hooks/useMyGames';
import type { CityBuilding, CityState, Res } from '@/types';

import { playedHours } from './trophies';

export const GOLD_PER_HOUR = 10;
export const VILLAGER_COST = 30;
export const START_SIZE = 10;
export const MAX_SIZE = 16;
export const HALL_POS = { x: 4, y: 4 };
export const CASTLE_BONUS = 1.25; // +25 % de producción con castillo
const TREE_CHANCE = 0.1;
const TREE_WOOD = 2;
const MAX_OFFLINE_SECONDS = 12 * 3600; // como mucho 12 h de producción de golpe

export type Cost = Partial<Record<Res, number>>;
export type Stock = Record<Res, number>;

export const RES: Record<Res, { name: string; sprite: 'coin' | 'log' | 'gem' }> = {
  gold: { name: 'Oro', sprite: 'coin' },
  wood: { name: 'Madera', sprite: 'log' },
  diamonds: { name: 'Diamantes', sprite: 'gem' },
};
export const RES_ORDER: Res[] = ['gold', 'wood', 'diamonds'];

type Requirement = { kind: string; level?: number };
export type BuildingDef = {
  name: string;
  desc: string;
  cost: Cost;
  housing: number[]; // aldeanos que caben, por nivel
  maxLevel: number;
  upgrades: Cost[]; // coste de subir al nivel 2, 3…
  maxWorkers: number;
  produce?: { res: Res; amount: number; every: number; input?: { res: Res; amount: number } };
  requires?: Requirement;
  unique?: boolean;
  hall?: boolean; // el ayuntamiento no se puede derribar
};

export const BUILDINGS: Record<string, BuildingDef> = {
  hall: {
    name: 'Ayuntamiento',
    desc: 'El corazón del pueblo. Aloja a 4 aldeanos.',
    cost: {},
    housing: [4],
    maxLevel: 1,
    upgrades: [],
    maxWorkers: 0,
    unique: true,
    hall: true,
  },
  hut: {
    name: 'Choza',
    desc: 'Donde viven tus aldeanos. Mejórala para que quepan más.',
    cost: { wood: 20 },
    housing: [2, 4, 6],
    maxLevel: 3,
    upgrades: [{ wood: 60, gold: 40 }, { wood: 150, gold: 120, diamonds: 1 }],
    maxWorkers: 0,
  },
  sawmill: {
    name: 'Serrería',
    desc: 'Tus aldeanos cortan madera: 3 de madera cada 15 s por aldeano.',
    cost: { wood: 50, gold: 30 },
    housing: [0],
    maxLevel: 1,
    upgrades: [],
    maxWorkers: 3,
    produce: { res: 'wood', amount: 3, every: 15 },
    requires: { kind: 'hut', level: 2 },
  },
  mine: {
    name: 'Mina de oro',
    desc: 'Sacan 2 de oro cada 15 s por aldeano.',
    cost: { wood: 80, gold: 60 },
    housing: [0],
    maxLevel: 1,
    upgrades: [],
    maxWorkers: 3,
    produce: { res: 'gold', amount: 2, every: 15 },
    requires: { kind: 'sawmill' },
  },
  jeweler: {
    name: 'Joyería',
    desc: 'Funde 60 de oro y talla 1 diamante cada minuto por aldeano.',
    cost: { wood: 150, gold: 200 },
    housing: [0],
    maxLevel: 1,
    upgrades: [],
    maxWorkers: 2,
    produce: { res: 'diamonds', amount: 1, every: 60, input: { res: 'gold', amount: 60 } },
    requires: { kind: 'mine' },
  },
  castle: {
    name: 'Castillo',
    desc: 'Aloja a 10 aldeanos y da +25 % de producción a todo el pueblo.',
    cost: { wood: 400, gold: 500, diamonds: 3 },
    housing: [10],
    maxLevel: 1,
    upgrades: [],
    maxWorkers: 0,
    unique: true,
    requires: { kind: 'hut', level: 3 },
  },
};
export const BUILDING_KINDS = Object.keys(BUILDINGS);

export const DECOR: Record<string, { name: string; cost: Cost }> = {
  flowers: { name: 'Flores', cost: { gold: 5 } },
  torch: { name: 'Antorcha', cost: { gold: 15 } },
  well: { name: 'Pozo', cost: { gold: 40 } },
  banner: { name: 'Estandarte', cost: { gold: 60 } },
};

// Ampliar el terreno (de 10 a 16 por lado).
export const EXPAND_COST: Record<number, Cost> = {
  10: { wood: 100, gold: 100 },
  12: { wood: 300, gold: 300 },
  14: { wood: 600, gold: 600 },
};

// Recursos que te da tu biblioteca.
export function sourcesOf(mine: MyGame[]): Stock {
  let wood = 0;
  let diamonds = 0;
  for (const m of mine) {
    const earned = m.ug.achievements?.length ?? 0;
    const total = m.ug.achievementsTotal ?? 0;
    if (total > 0 && earned >= total) diamonds += 1; // platino: un diamante, y sus logros no son madera
    else wood += earned;
  }
  return { gold: Math.floor(playedHours(mine, 'main') * GOLD_PER_HOUR), wood, diamonds };
}

export function newCity(seed: number = Math.floor(Math.random() * 2 ** 31)): CityState {
  return {
    v: 2,
    seed,
    size: START_SIZE,
    buildings: [{ id: 'hall', kind: 'hall', ...HALL_POS, level: 1, workers: 0, progress: 0 }],
    items: [],
    chopped: [],
    made: {},
    spent: {},
    villagers: 0,
    clock: 0,
  };
}

export function cityOf(c: CityState | undefined): CityState | null {
  return c && c.v === 2 ? c : null;
}

export const available = (st: CityState, src: Stock, res: Res): number =>
  src[res] + (st.made[res] ?? 0) - (st.spent[res] ?? 0);

export function canAfford(st: CityState, src: Stock, cost: Cost): boolean {
  return RES_ORDER.every((r) => available(st, src, r) >= (cost[r] ?? 0));
}

function withSpent(st: CityState, cost: Cost, sign = 1): CityState {
  const spent = { ...st.spent };
  for (const r of RES_ORDER) if (cost[r]) spent[r] = Math.max(0, (spent[r] ?? 0) + sign * cost[r]!);
  return { ...st, spent };
}

// --- Terreno ---

// Número pseudoaleatorio estable (0..1) para una casilla: el mismo mapa siempre.
export function hash01(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const inHallZone = (x: number, y: number) => Math.abs(x - HALL_POS.x) <= 1 && Math.abs(y - HALL_POS.y) <= 1;

export function inside(st: CityState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < st.size && y < st.size;
}

export function hasTree(st: CityState, x: number, y: number): boolean {
  if (!inside(st, x, y) || inHallZone(x, y)) return false;
  if (st.chopped.includes(`${x},${y}`)) return false;
  return hash01(st.seed, x, y) < TREE_CHANCE;
}

export const buildingAt = (st: CityState, x: number, y: number) => st.buildings.find((b) => b.x === x && b.y === y);
export const decorAt = (st: CityState, x: number, y: number) => st.items.find((i) => i.x === x && i.y === y);

// --- Edificios ---

export function requirementMet(st: CityState, req: Requirement): boolean {
  return st.buildings.some((b) => b.kind === req.kind && b.level >= (req.level ?? 1));
}

export function requirementText(req: Requirement): string {
  return `${BUILDINGS[req.kind]?.name ?? req.kind}${req.level && req.level > 1 ? ` de nivel ${req.level}` : ''}`;
}

// Motivo por el que no puedes poner un edificio aquí (null si puedes).
export function placeError(st: CityState, kind: string, x: number, y: number): string | null {
  const def = BUILDINGS[kind];
  if (!def) return 'Edificio desconocido';
  if (!inside(st, x, y)) return 'Fuera del terreno';
  if (buildingAt(st, x, y) || decorAt(st, x, y)) return 'Casilla ocupada';
  if (hasTree(st, x, y)) return 'Hay un árbol: tálalo primero';
  if (st.buildings.some((b) => Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) <= 1))
    return 'Deja un hueco entre edificios';
  if (def.unique && st.buildings.some((b) => b.kind === kind)) return `Ya tienes un ${def.name.toLowerCase()}`;
  if (def.requires && !requirementMet(st, def.requires)) return `Antes necesitas: ${requirementText(def.requires)}`;
  return null;
}

export type Result = { ok: true; state: CityState } | { ok: false; error: string };

export function build(st: CityState, src: Stock, kind: string, x: number, y: number): Result {
  const def = BUILDINGS[kind];
  const err = placeError(st, kind, x, y);
  if (err) return { ok: false, error: err };
  if (!canAfford(st, src, def.cost)) return { ok: false, error: 'No tienes recursos suficientes' };
  const id = `${kind}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const next = withSpent(st, def.cost);
  const b: CityBuilding = { id, kind, x, y, level: 1, workers: 0, progress: 0 };
  return { ok: true, state: { ...next, buildings: [...next.buildings, b] } };
}

export function upgrade(st: CityState, src: Stock, id: string): Result {
  const b = st.buildings.find((o) => o.id === id);
  if (!b) return { ok: false, error: 'Ese edificio ya no existe' };
  const def = BUILDINGS[b.kind];
  if (b.level >= def.maxLevel) return { ok: false, error: 'Ya está al máximo' };
  const cost = def.upgrades[b.level - 1] ?? {};
  if (!canAfford(st, src, cost)) return { ok: false, error: 'No tienes recursos suficientes' };
  const next = withSpent(st, cost);
  return {
    ok: true,
    state: { ...next, buildings: next.buildings.map((o) => (o.id === id ? { ...o, level: o.level + 1 } : o)) },
  };
}

// Derriba un edificio y te devuelve la mitad de lo gastado en construirlo.
export function demolish(st: CityState, id: string): Result {
  const b = st.buildings.find((o) => o.id === id);
  if (!b) return { ok: false, error: 'Ese edificio ya no existe' };
  const def = BUILDINGS[b.kind];
  if (def.hall) return { ok: false, error: 'El ayuntamiento no se derriba' };
  const refund: Cost = {};
  for (const r of RES_ORDER) if (def.cost[r]) refund[r] = Math.floor(def.cost[r]! / 2);
  const next = withSpent(st, refund, -1);
  return { ok: true, state: { ...next, buildings: next.buildings.filter((o) => o.id !== id) } };
}

// --- Aldeanos ---

export function housingCapacity(st: CityState): number {
  return st.buildings.reduce((a, b) => a + (BUILDINGS[b.kind]?.housing[b.level - 1] ?? 0), 0);
}

export const workersTotal = (st: CityState) => st.buildings.reduce((a, b) => a + b.workers, 0);
export const freeVillagers = (st: CityState) => st.villagers - workersTotal(st);

export function buyVillager(st: CityState, src: Stock): Result {
  if (st.villagers >= housingCapacity(st)) return { ok: false, error: 'No cabe nadie más: construye o mejora una choza' };
  if (!canAfford(st, src, { gold: VILLAGER_COST })) return { ok: false, error: 'No tienes oro para un aldeano' };
  return { ok: true, state: { ...withSpent(st, { gold: VILLAGER_COST }), villagers: st.villagers + 1 } };
}

export function assign(st: CityState, id: string, delta: number): Result {
  const b = st.buildings.find((o) => o.id === id);
  if (!b) return { ok: false, error: 'Ese edificio ya no existe' };
  const def = BUILDINGS[b.kind];
  if (!def.maxWorkers) return { ok: false, error: 'Aquí no se trabaja' };
  if (delta > 0 && freeVillagers(st) <= 0) return { ok: false, error: 'No tienes aldeanos libres' };
  const workers = Math.max(0, Math.min(def.maxWorkers, b.workers + delta));
  return { ok: true, state: { ...st, buildings: st.buildings.map((o) => (o.id === id ? { ...o, workers } : o)) } };
}

// --- Árboles y decoración ---

export function chop(st: CityState, x: number, y: number): Result {
  if (!hasTree(st, x, y)) return { ok: false, error: 'No hay ningún árbol aquí' };
  const made = { ...st.made, wood: (st.made.wood ?? 0) + TREE_WOOD };
  return { ok: true, state: { ...st, made, chopped: [...st.chopped, `${x},${y}`] } };
}

export function addDecor(st: CityState, src: Stock, kind: string, x: number, y: number): Result {
  const def = DECOR[kind];
  if (!def) return { ok: false, error: 'Decoración desconocida' };
  if (!inside(st, x, y)) return { ok: false, error: 'Fuera del terreno' };
  if (buildingAt(st, x, y) || decorAt(st, x, y)) return { ok: false, error: 'Casilla ocupada' };
  if (hasTree(st, x, y)) return { ok: false, error: 'Hay un árbol: tálalo primero' };
  if (!canAfford(st, src, def.cost)) return { ok: false, error: 'No tienes oro suficiente' };
  const next = withSpent(st, def.cost);
  const item = { id: `${kind}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, kind, x, y };
  return { ok: true, state: { ...next, items: [...next.items, item] } };
}

export function removeDecor(st: CityState, id: string): CityState {
  const item = st.items.find((i) => i.id === id);
  if (!item) return st;
  const refund: Cost = {};
  for (const r of RES_ORDER) if (DECOR[item.kind]?.cost[r]) refund[r] = Math.floor(DECOR[item.kind].cost[r]! / 2);
  return { ...withSpent(st, refund, -1), items: st.items.filter((i) => i.id !== id) };
}

export function expand(st: CityState, src: Stock): Result {
  if (st.size >= MAX_SIZE) return { ok: false, error: 'Tu terreno ya está al máximo' };
  const cost = EXPAND_COST[st.size];
  if (!cost) return { ok: false, error: 'No se puede ampliar más' };
  if (!canAfford(st, src, cost)) return { ok: false, error: 'No tienes recursos suficientes' };
  return { ok: true, state: { ...withSpent(st, cost), size: st.size + 2 } };
}

// --- Producción ---

// Avanza el reloj: cada 15 s de trabajo de un aldeano (o cada minuto en la joyería) produce.
// Si la joyería se queda sin oro, se para. Lo que pasó mientras no estabas se cuenta, hasta 12 h.
export function advance(st: CityState, src: Stock, now: number): CityState {
  if (!st.clock) return { ...st, clock: now };
  const elapsed = Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (now - st.clock) / 1000));
  if (elapsed === 0) return st;
  const castle = st.buildings.some((b) => b.kind === 'castle');
  let cur: CityState = { ...st, buildings: st.buildings.map((b) => ({ ...b })) };
  for (const b of cur.buildings) {
    const prod = BUILDINGS[b.kind]?.produce;
    if (!prod || b.workers <= 0) continue;
    const seconds = b.progress + elapsed * b.workers;
    let cycles = Math.floor(seconds / prod.every);
    let progress = seconds - cycles * prod.every;
    if (prod.input) {
      const affordable = Math.floor(available(cur, src, prod.input.res) / prod.input.amount);
      if (cycles > affordable) {
        cycles = affordable;
        progress = 0;
      }
      if (cycles > 0) {
        const spent = { ...cur.spent, [prod.input.res]: (cur.spent[prod.input.res] ?? 0) + cycles * prod.input.amount };
        cur = { ...cur, spent };
      }
    }
    b.progress = progress;
    if (cycles > 0) {
      const units = Math.round(prod.amount * (castle ? CASTLE_BONUS : 1)) * cycles;
      cur = { ...cur, made: { ...cur.made, [prod.res]: (cur.made[prod.res] ?? 0) + units } };
    }
  }
  return { ...cur, clock: now };
}

// Texto corto para explicar lo que produce un edificio.
export function productionText(kind: string): string | null {
  const p = BUILDINGS[kind]?.produce;
  if (!p) return null;
  const what = `${p.amount} de ${RES[p.res].name.toLowerCase()} cada ${p.every} s`;
  return p.input ? `${what}, gastando ${p.input.amount} de ${RES[p.input.res].name.toLowerCase()}` : what;
}
