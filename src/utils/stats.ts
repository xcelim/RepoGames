import type { MyGame } from '@/hooks/useMyGames';
import { finishedDay } from '@/hooks/useMyGames';
import type { DurationMode } from '@/types';
import { gameHours } from '@/utils/library';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Actividad por día: añadir, empezar, terminar o tocar un juego cuenta (una vez por juego y día).
export function activityByDay(mine: MyGame[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const { ug } of mine) {
    const days = new Set(
      [ug.addedAt?.slice(0, 10), ug.startedAt, finishedDay(ug), ug.updatedAt?.slice(0, 10)].filter(
        (d): d is string => !!d,
      ),
    );
    for (const d of days) out.set(d, (out.get(d) ?? 0) + 1);
  }
  return out;
}

// Rejilla de las últimas `weeks` semanas (columnas) × 7 días (filas, lunes arriba).
export function heatmapGrid(activity: Map<string, number>, weeks = 26, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = (end.getDay() + 6) % 7; // 0 = lunes
  const start = new Date(end);
  start.setDate(end.getDate() - dow - (weeks - 1) * 7);
  const cols: { day: string; count: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const day = iso(date);
      col.push({ day, count: activity.get(day) ?? 0, future: date > end });
    }
    cols.push(col);
  }
  return cols;
}

// Rachas de días seguidos con actividad.
export function streaks(activity: Map<string, number>, today = new Date()): { current: number; best: number } {
  const days = [...activity.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00`);
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  let current = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Si hoy aún no has hecho nada, la racha cuenta hasta ayer.
  if (!activity.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activity.has(iso(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best };
}

export type Archetype = { name: string; emoji: string; description: string };

// Tu perfil de jugador según cómo juegas.
export function archetype(mine: MyGame[], mode: DurationMode): Archetype {
  const owned = mine.filter((m) => m.ug.status !== 'wishlist');
  const finished = owned.filter((m) => m.ug.status === 'beaten' || m.ug.status === 'completed');
  const completed = owned.filter((m) => m.ug.status === 'completed');
  const dropped = owned.filter((m) => m.ug.status === 'dropped');
  const pending = owned.filter((m) => m.ug.status === 'backlog' || m.ug.status === 'library');
  const avgLen = finished.length ? finished.reduce((a, m) => a + gameHours(m.game, mode), 0) / finished.length : 0;
  const physical = owned.filter((m) => m.ug.owned).length;
  const old = owned.filter((m) => (m.game.year ?? 3000) < 2005).length;
  const rate = owned.length ? finished.length / owned.length : 0;

  if (owned.length < 5)
    return { name: 'Recién llegado', emoji: '🌱', description: 'Tu historia acaba de empezar. Añade juegos y verás.' };
  if (completed.length >= 5 && completed.length / Math.max(1, finished.length) > 0.4)
    return { name: 'Completista', emoji: '🏆', description: 'No te basta con acabarlo: lo quieres al 100 %.' };
  if (physical / owned.length > 0.5)
    return { name: 'Coleccionista', emoji: '📀', description: 'Tus estanterías dan envidia: casi todo en físico.' };
  if (old / owned.length > 0.4)
    return { name: 'Arqueólogo retro', emoji: '🕹️', description: 'Lo bueno nunca pasa de moda, y tú lo sabes.' };
  if (avgLen > 45)
    return { name: 'Maratoniano', emoji: '🏔️', description: 'Te van las aventuras eternas de 50 horas o más.' };
  if (avgLen && avgLen < 12 && finished.length >= 5)
    return { name: 'Velocista', emoji: '⚡', description: 'Juegos cortos e intensos, uno detrás de otro.' };
  if (pending.length > finished.length * 2)
    return { name: 'Acumulador', emoji: '📚', description: 'Tu pila de pendientes tiene vida propia.' };
  if (dropped.length / owned.length > 0.25)
    return { name: 'Catador', emoji: '🍷', description: 'Pruebas mucho y solo te quedas con lo que te engancha.' };
  if (rate > 0.6) return { name: 'Rematador', emoji: '🎯', description: 'Lo que empiezas, lo terminas.' };
  return { name: 'Explorador', emoji: '🧭', description: 'Un poco de todo: curiosidad sin límites.' };
}

// Cuándo lo terminarás a tu ritmo (horas apuntadas ÷ días desde que lo empezaste).
// Sin horas apuntadas, se calcula a una hora al día.
export function finishEta(
  ug: { status: string; startedAt: string | null; hoursPlayed: number | null },
  totalHours: number | null,
  today = new Date(),
): { date: string; perWeek: number; assumed: boolean; left: number } | null {
  if (ug.status !== 'playing' || !totalHours) return null;
  const start = ug.startedAt ? Date.parse(`${ug.startedAt}T12:00:00`) : NaN;
  const days = Number.isNaN(start) ? 0 : Math.max(1, Math.round((today.getTime() - start) / 86_400_000));
  const played = ug.hoursPlayed ?? 0;
  const assumed = !(played > 0 && days > 0);
  const perDay = assumed ? 1 : played / days;
  const left = Math.max(0, totalHours - played);
  if (left === 0) return null;
  const eta = new Date(today.getTime() + Math.ceil(left / Math.max(perDay, 0.05)) * 86_400_000);
  if (eta.getFullYear() - today.getFullYear() > 5) return null;
  return { date: iso(eta), perWeek: Math.round(perDay * 7 * 10) / 10, assumed, left };
}
