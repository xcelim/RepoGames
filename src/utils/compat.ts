import type { UserGame } from '@/types';

// Compatibilidad de gustos entre dos jugadores (0-100).
export type Compat = {
  score: number;
  shared: string[]; // juegos en común
  bothLoved: string[]; // os encantan a los dos (nota 8+)
  forYou: string[]; // a él le encantan y tú no los tienes
  clash: { gameId: string; mine: number; theirs: number }[]; // donde más discrepáis
};

export function compatibility(mine: UserGame[], theirs: UserGame[]): Compat {
  const m = new Map(mine.map((u) => [u.gameId, u]));
  const t = new Map(theirs.map((u) => [u.gameId, u]));
  const shared = [...m.keys()].filter((id) => t.has(id));
  const overlap = mine.length && theirs.length ? shared.length / Math.min(mine.length, theirs.length) : 0;
  const pairs = shared
    .map((id) => ({ gameId: id, mine: m.get(id)!.rating ?? 0, theirs: t.get(id)!.rating ?? 0 }))
    .filter((p) => p.mine && p.theirs);
  const agreement = pairs.length
    ? 1 - pairs.reduce((a, p) => a + Math.abs(p.mine - p.theirs), 0) / pairs.length / 9
    : 0;
  const base = Math.sqrt(Math.min(1, overlap * 1.5));
  const score = pairs.length >= 3 ? 0.45 * base + 0.55 * agreement : base * 0.85;
  return {
    score: Math.round(Math.max(0, Math.min(1, score)) * 100),
    shared,
    bothLoved: pairs.filter((p) => p.mine >= 8 && p.theirs >= 8).map((p) => p.gameId),
    forYou: theirs
      .filter((u) => (u.rating ?? 0) >= 8 && !m.has(u.gameId))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((u) => u.gameId)
      .slice(0, 8),
    clash: [...pairs]
      .sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs))
      .filter((p) => Math.abs(p.mine - p.theirs) >= 3)
      .slice(0, 3),
  };
}
