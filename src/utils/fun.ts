// Datos curiosos: tus horas de juego comparadas con cosas del día a día.

const EQUIV: { hours: number; text: (n: string) => string }[] = [
  { hours: 11.4, text: (n) => `ver la trilogía extendida de El Señor de los Anillos ${n} veces` },
  { hours: 14, text: (n) => `volar de Madrid a Tokio ${n} veces` },
  { hours: 1.75, text: (n) => `ver ${n} partidos de fútbol completos` },
  { hours: 85, text: (n) => `ver Friends entera ${n} veces` },
  { hours: 62, text: (n) => `ver Juego de Tronos entera ${n} veces` },
  { hours: 8, text: (n) => `${n} jornadas de trabajo` },
  { hours: 24 * 7, text: (n) => `${n} semanas sin parar ni para dormir` },
  { hours: 3.2, text: (n) => `escuchar ${n} veces la discografía de los Beatles` },
  { hours: 5, text: (n) => `correr ${n} maratones (a ritmo tranquilo)` },
  { hours: 0.75, text: (n) => `${n} capítulos de una serie de anime con opening incluido` },
];

const fmt = (x: number) => (x >= 10 ? Math.round(x).toLocaleString('es-ES') : x.toFixed(1).replace('.', ','));

// Una equivalencia distinta cada día (o la que pidas con `shift`).
export function funFact(hours: number, shift = 0): string | null {
  if (!hours || hours < 1) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  const usable = EQUIV.filter((e) => hours / e.hours >= 1);
  if (!usable.length) return null;
  const e = usable[(day + shift) % usable.length];
  return `Has jugado ${fmt(hours)} h: como ${e.text(fmt(hours / e.hours))}.`;
}

// Días desde una fecha AAAA-MM-DD.
export function daysSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}
