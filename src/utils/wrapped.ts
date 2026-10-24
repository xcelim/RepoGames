import type { DurationMode, GameRecord, UserGame } from '@/types';

// Los datos del "Wrapped": tu año en juegos.
export type WrappedData = {
  year: number;
  finished: { ug: UserGame; game: GameRecord }[];
  hours: number;
  byMonth: number[]; // terminados por mes
  bestMonth: number | null;
  topRated: { ug: UserGame; game: GameRecord } | null;
  platform: { name: string; count: number } | null;
  started: number;
  dropped: number;
  replays: number;
  persona: { name: string; text: string; emoji: string };
};

const yearOf = (ug: UserGame) => {
  const d = ug.finishedAt ?? (ug.status === 'beaten' || ug.status === 'completed' ? ug.updatedAt : null);
  return d ? Number(d.slice(0, 4)) : null;
};
const monthOf = (ug: UserGame) => Number((ug.finishedAt ?? ug.updatedAt).slice(5, 7)) - 1;

export function wrappedYears(userGames: UserGame[]): number[] {
  const ys = new Set<number>();
  for (const u of userGames) {
    const y = yearOf(u);
    if (y && (u.status === 'beaten' || u.status === 'completed')) ys.add(y);
  }
  return [...ys].sort((a, b) => b - a);
}

export function buildWrapped(
  year: number,
  userGames: UserGame[],
  games: Record<string, GameRecord>,
  mode: DurationMode,
  replaysOf: (gameId: string) => number,
): WrappedData {
  const finished = userGames
    .filter((u) => (u.status === 'beaten' || u.status === 'completed') && yearOf(u) === year && games[u.gameId])
    .map((ug) => ({ ug, game: games[ug.gameId] }))
    .sort((a, b) => (a.ug.finishedAt ?? a.ug.updatedAt).localeCompare(b.ug.finishedAt ?? b.ug.updatedAt));
  const byMonth = Array<number>(12).fill(0);
  for (const f of finished) byMonth[monthOf(f.ug)] += 1;
  const max = Math.max(...byMonth);
  const hours = finished.reduce(
    (a, f) =>
      a + (f.ug.hoursPlayed ?? (f.ug.status === 'completed' ? (f.game.full ?? f.game[mode]) : f.game[mode]) ?? 0),
    0,
  );
  const rated = finished.filter((f) => f.ug.rating).sort((a, b) => (b.ug.rating ?? 0) - (a.ug.rating ?? 0));
  const plats: Record<string, number> = {};
  for (const f of finished) if (f.ug.platform) plats[f.ug.platform] = (plats[f.ug.platform] ?? 0) + 1;
  const topPlat = Object.entries(plats).sort((a, b) => b[1] - a[1])[0];
  const started = userGames.filter((u) => u.startedAt?.startsWith(String(year))).length;
  const dropped = userGames.filter((u) => u.status === 'dropped' && u.updatedAt.startsWith(String(year))).length;
  const replays = finished.reduce((a, f) => a + replaysOf(f.game.id), 0);
  const completed = finished.filter((f) => f.ug.status === 'completed').length;
  const physical = finished.filter((f) => f.ug.owned).length;

  let persona = { name: 'Aventurero', emoji: '🗺️', text: 'Vas de un mundo a otro sin miedo a nada.' };
  if (completed >= Math.max(3, finished.length / 3))
    persona = { name: 'Completista', emoji: '🏆', text: 'No dejas un juego hasta sacarle el 100 %.' };
  else if (replays >= 3) persona = { name: 'Fiel', emoji: '🔁', text: 'Cuando algo te gusta, vuelves una y otra vez.' };
  else if (hours >= 300)
    persona = { name: 'Maratoniano', emoji: '⏱️', text: 'Las horas te dan igual: tú juegas y juegas.' };
  else if (physical >= Math.max(3, finished.length / 2))
    persona = { name: 'Coleccionista', emoji: '📀', text: 'Tu estantería es tu orgullo.' };
  else if (finished.length >= 25)
    persona = { name: 'Devorador', emoji: '🍿', text: 'Terminas juegos a una velocidad de vértigo.' };
  else if (finished.length <= 3) persona = { name: 'Sibarita', emoji: '🍷', text: 'Pocos, pero bien elegidos.' };

  return {
    year,
    finished,
    hours,
    byMonth,
    bestMonth: max > 0 ? byMonth.indexOf(max) : null,
    topRated: rated[0] ?? null,
    platform: topPlat ? { name: topPlat[0], count: topPlat[1] } : null,
    started,
    dropped,
    replays,
    persona,
  };
}

export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
