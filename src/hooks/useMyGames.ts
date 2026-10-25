import { useMemo } from 'react';

import { useStore } from '@/store/useStore';
import type { GameRecord, UserGame } from '@/types';

export type MyGame = { ug: UserGame; game: GameRecord };

// Tus juegos (con su ficha), calculado una vez por cambio de la biblioteca.
export function useMyGames(): MyGame[] {
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  return useMemo(() => {
    const out: MyGame[] = [];
    for (const ug of Object.values(userGames)) {
      if (ug.profileId !== profileId) continue;
      const game = games[ug.gameId];
      if (game) out.push({ ug, game });
    }
    return out;
  }, [userGames, games, profileId]);
}

// Día (AAAA-MM-DD) en que terminaste un juego: la fecha que apuntaste o, si no, la última edición.
export function finishedDay(ug: UserGame): string | null {
  if (ug.status !== 'beaten' && ug.status !== 'completed') return null;
  return ug.finishedAt ?? ug.updatedAt?.slice(0, 10) ?? null;
}

export function hueOf(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export const DAY = 86_400_000;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00`) - Date.parse(`${a.slice(0, 10)}T12:00:00`)) / DAY);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const MONTHS_LONG = [
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

export function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function longDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} de ${MONTHS_LONG[m - 1]}`;
}

// «Quedan 6 días» / «Sale mañana» / «Sale hoy».
export function untilLabel(date: string): string {
  const days = daysBetween(todayIso(), date);
  if (days < 0) return 'Ya disponible';
  if (days === 0) return 'Sale hoy';
  if (days === 1) return 'Sale mañana';
  return `Quedan ${days} días`;
}

export function fullDate(iso: string): string {
  return `${longDate(iso)} de ${iso.slice(0, 4)}`;
}
