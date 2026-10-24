import type { TierList } from '@/types';

export const DEFAULT_TIERS: TierList['tiers'] = [
  { label: 'S', color: '#ff4d6d', gameIds: [] },
  { label: 'A', color: '#ff9f43', gameIds: [] },
  { label: 'B', color: '#ffd43b', gameIds: [] },
  { label: 'C', color: '#51cf66', gameIds: [] },
  { label: 'D', color: '#4dabf7', gameIds: [] },
  { label: 'F', color: '#9775fa', gameIds: [] },
];

export function newTierList(title = 'Mi tier list'): TierList {
  return {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title,
    tiers: DEFAULT_TIERS.map((t) => ({ ...t, gameIds: [] })),
    pool: [],
    updatedAt: new Date().toISOString(),
  };
}

// Dónde está un juego: índice del tier o -1 si está sin colocar (null si no está).
export function locate(t: TierList, gameId: string): number | null {
  const i = t.tiers.findIndex((x) => x.gameIds.includes(gameId));
  if (i >= 0) return i;
  return (t.pool ?? []).includes(gameId) ? -1 : null;
}

// Mueve un juego a un tier (o al montón sin colocar con -1), al final o en una posición.
export function moveTo(t: TierList, gameId: string, tier: number, index?: number): TierList {
  const strip = (ids: string[]) => ids.filter((id) => id !== gameId);
  const insert = (ids: string[]) => {
    const out = strip(ids);
    out.splice(index === undefined ? out.length : Math.max(0, Math.min(index, out.length)), 0, gameId);
    return out;
  };
  return {
    ...t,
    tiers: t.tiers.map((x, i) => ({ ...x, gameIds: i === tier ? insert(x.gameIds) : strip(x.gameIds) })),
    pool: tier === -1 ? insert(t.pool ?? []) : strip(t.pool ?? []),
    updatedAt: new Date().toISOString(),
  };
}

export function removeGame(t: TierList, gameId: string): TierList {
  const strip = (ids: string[]) => ids.filter((id) => id !== gameId);
  return {
    ...t,
    tiers: t.tiers.map((x) => ({ ...x, gameIds: strip(x.gameIds) })),
    pool: strip(t.pool ?? []),
    updatedAt: new Date().toISOString(),
  };
}
