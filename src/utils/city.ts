// Tu mundo gamer: una ciudad isométrica con un edificio por cada juego terminado.
// Las horas que juegas son monedas (1 hora = 10 monedas) para mejorar edificios, decorar,
// ampliar el terreno y cambiar el cielo.
import type { MyGame } from '@/hooks/useMyGames';
import type { CityItem, CityState } from '@/types';

import { playedHours } from './trophies';

export const COINS_PER_HOUR = 10;
export const MAX_LEVEL = 3;

export const DEFAULT_CITY: CityState = { spent: 0, size: 8, items: [], upgrades: {}, sky: 'day', skies: ['day'] };

export function cityOf(c: CityState | undefined): CityState {
  return {
    ...DEFAULT_CITY,
    ...(c ?? {}),
    items: c?.items ?? [],
    upgrades: c?.upgrades ?? {},
    skies: c?.skies?.length ? c.skies : ['day'],
  };
}

// Monedas ganadas: siempre con la duración de la historia, para que no cambien con los ajustes.
export function coinsEarned(mine: MyGame[]): number {
  return Math.floor(playedHours(mine, 'main') * COINS_PER_HOUR);
}

export type DecorKind =
  'tree' | 'pine' | 'flowers' | 'bench' | 'lamp' | 'pond' | 'fountain' | 'neon' | 'arcade' | 'statue' | 'monument';

export const DECOR: Record<DecorKind, { name: string; price: number; icon: string }> = {
  flowers: { name: 'Flores', price: 10, icon: '🌷' },
  bench: { name: 'Banco', price: 15, icon: '🪑' },
  tree: { name: 'Árbol', price: 20, icon: '🌳' },
  pine: { name: 'Pino', price: 25, icon: '🌲' },
  lamp: { name: 'Farola', price: 30, icon: '💡' },
  pond: { name: 'Estanque', price: 120, icon: '🦆' },
  fountain: { name: 'Fuente', price: 150, icon: '⛲' },
  neon: { name: 'Cartel de neón', price: 180, icon: '🌈' },
  arcade: { name: 'Recreativa', price: 220, icon: '🕹️' },
  statue: { name: 'Estatua dorada', price: 300, icon: '🗽' },
  monument: { name: 'Monumento al trofeo', price: 500, icon: '🏆' },
};
export const DECOR_KINDS = Object.keys(DECOR) as DecorKind[];

export const SKIES: Record<string, { name: string; price: number; colors: [string, string]; night: boolean }> = {
  day: { name: 'Día', price: 0, colors: ['#7cc8ff', '#dff3ff'], night: false },
  sunset: { name: 'Atardecer', price: 200, colors: ['#ff7e5f', '#feb47b'], night: false },
  night: { name: 'Noche estrellada', price: 300, colors: ['#0b1026', '#2b3a67'], night: true },
  aurora: { name: 'Aurora boreal', price: 500, colors: ['#081a33', '#11a37f'], night: true },
  synth: { name: 'Synthwave', price: 650, colors: ['#2b1055', '#d53369'], night: true },
};

// Ampliar el terreno: de 8×8 hasta 20×20.
export const SIZES = [8, 10, 12, 14, 16, 18, 20];
export function expandCost(size: number): number | null {
  const i = SIZES.indexOf(size);
  if (i < 0 || i === SIZES.length - 1) return null;
  return [250, 500, 900, 1400, 2000, 2800][i];
}

export const upgradeCost = (level: number) => [100, 250, 500][level] ?? null;

// Color de cada saga (los juegos de la misma saga forman un barrio del mismo color).
export function hueOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

export type Building = {
  game: MyGame;
  x: number;
  y: number;
  level: number;
  floors: number;
  hue: number;
  construction: boolean; // lo estás jugando: en obras
  gold: boolean; // completado al 100 %
};

// Casillas desde el centro hacia fuera (los primeros edificios ocupan el centro).
function spiral(size: number): { x: number; y: number }[] {
  const c = (size - 1) / 2;
  const out: { x: number; y: number; d: number; a: number }[] = [];
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      out.push({ x, y, d: Math.max(Math.abs(x - c), Math.abs(y - c)), a: Math.atan2(y - c, x - c) });
  return out.sort((p, q) => p.d - q.d || p.a - q.a);
}

export function layoutCity(mine: MyGame[], city: CityState): { buildings: Building[]; homeless: number } {
  const taken = new Set(city.items.map((i) => `${i.x},${i.y}`));
  const finished = mine.filter((m) => m.ug.status === 'beaten' || m.ug.status === 'completed');
  const playing = mine.filter((m) => m.ug.status === 'playing');
  // Barrios: los de la misma saga juntos; dentro, por fecha en que los terminaste.
  const sorted = [...finished].sort(
    (a, b) =>
      (a.game.series ?? '~').localeCompare(b.game.series ?? '~') ||
      (a.ug.finishedAt ?? a.ug.updatedAt).localeCompare(b.ug.finishedAt ?? b.ug.updatedAt),
  );
  const all = [...sorted, ...playing];
  const free = spiral(city.size).filter((p) => !taken.has(`${p.x},${p.y}`));
  const buildings: Building[] = [];
  all.forEach((m, i) => {
    const spot = free[i];
    if (!spot) return;
    const hours = m.ug.hoursPlayed ?? m.game.main ?? 10;
    const level = Math.min(MAX_LEVEL, city.upgrades[m.game.id] ?? 0);
    buildings.push({
      game: m,
      x: spot.x,
      y: spot.y,
      level,
      floors: Math.max(1, Math.min(9, Math.round(Math.sqrt(hours) * 1.2))) + level,
      hue: hueOf(m.game.series ?? m.game.developer ?? m.game.id),
      construction: m.ug.status === 'playing',
      gold: m.ug.status === 'completed',
    });
  });
  return { buildings, homeless: Math.max(0, all.length - free.length) };
}

export function itemAt(city: CityState, x: number, y: number): CityItem | undefined {
  return city.items.find((i) => i.x === x && i.y === y);
}
