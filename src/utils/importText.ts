import type { PlayStatus } from '@/types';

// Una línea del importador: "Título | año | estado | nota" (todo menos el título es opcional
// y puede ir en cualquier orden).
export type ImportLine = {
  title: string;
  year: number | null;
  status: PlayStatus | null;
  rating: number | null;
};

const STATUS_WORDS: [RegExp, PlayStatus][] = [
  [/^(pasado|pasados|terminado|terminados|beat|beaten|finished|done|acabado)$/, 'beaten'],
  [/^(completado|completed|100|100%|100 %|platino|platinum)$/, 'completed'],
  [/^(jugando|playing|en curso)$/, 'playing'],
  [/^(pausa|en pausa|pausado|paused|on hold)$/, 'paused'],
  [/^(abandonado|abandonados|dropped|dejado)$/, 'dropped'],
  [/^(pendiente|pendientes|backlog|por jugar)$/, 'backlog'],
  [/^(deseado|deseados|wishlist|lo quiero|quiero)$/, 'wishlist'],
  [/^(biblioteca|library|mis juegos)$/, 'library'],
];

export function parseStatus(word: string): PlayStatus | null {
  const w = word.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [re, status] of STATUS_WORDS) if (re.test(w)) return status;
  return null;
}

export function parseImportText(text: string): ImportLine[] {
  const out: ImportLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // Quita viñetas y numeración: "1. ", "- ", "• ", "3) "
    const line = raw.replace(/^\s*(?:[-*•·]|\d{1,3}[.)])\s+/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s*[|;\t]\s*/).filter(Boolean);
    const entry: ImportLine = { title: '', year: null, status: null, rating: null };
    const titleParts: string[] = [];
    parts.forEach((part, i) => {
      if (i === 0) return titleParts.push(part);
      const status = parseStatus(part);
      if (status) return (entry.status = status);
      const num = part.match(/^(\d{1,4})(?:\s*\/\s*10)?$/);
      if (num) {
        const n = Number(num[1]);
        if (n >= 1950 && n <= 2100) return (entry.year = n);
        if (n >= 1 && n <= 10) return (entry.rating = n);
      }
      titleParts.push(part);
    });
    // "Hades (2020)" → año entre paréntesis al final del título
    let title = titleParts.join(' ').trim();
    const y = title.match(/\s*\((\d{4})\)\s*$/);
    if (y && !entry.year) {
      entry.year = Number(y[1]);
      title = title.slice(0, y.index).trim();
    }
    entry.title = title;
    if (entry.title) out.push(entry);
  }
  return out;
}
