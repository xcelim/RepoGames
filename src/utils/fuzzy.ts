import { stripAccents } from './text';

// Búsqueda tolerante: encuentra "Minecraft" escribiendo "minecraf" o
// "Fire Emblem: The Blazing Blade" escribiendo "fire emblem blazing blaze".

const STOP = new Set(['the', 'of', 'a', 'an', 'and', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'to', 'in']);

const ROMAN: Record<string, string> = {
  i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
  xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15', xvi: '16',
};

export function tokens(text: string): string[] {
  return stripAccents(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((t) => ROMAN[t] ?? t);
}

// Palabras que importan para buscar (sin artículos).
export function keyTokens(text: string): string[] {
  const all = tokens(text);
  const useful = all.filter((t) => !STOP.has(t));
  return useful.length ? useful : all;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Distancia con transposiciones ("nigth" -> "night" cuenta como 1).
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      }
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// Cuánto se parece una palabra escrita a una palabra del título (0..1).
function wordScore(typed: string, word: string): number {
  if (typed === word) return 1;
  if (word.startsWith(typed)) return typed.length >= 3 || typed.length === word.length ? 0.95 : 0.6;
  if (/^\d+$/.test(typed) || /^\d+$/.test(word)) return 0;
  // Compara con el principio de la palabra del mismo largo (escribir a medias + una errata).
  const head = word.slice(0, Math.max(typed.length, 1));
  const dHead = levenshtein(typed, head);
  const dFull = levenshtein(typed, word);
  const d = Math.min(dHead, dFull);
  const len = Math.max(typed.length, 1);
  const allowed = len <= 3 ? 0 : len === 4 ? 1 : len <= 9 ? 2 : 3;
  if (d > allowed) return 0;
  return 0.9 - (d / len) * 0.6;
}

// Parecido entre lo buscado y un título (0..1). 1 = todas las palabras encajan.
export function fuzzyScore(query: string, title: string): number {
  const q = keyTokens(query);
  if (!q.length) return 0;
  const t = tokens(title);
  if (!t.length) return 0;
  const joinedQ = q.join('');
  const joinedT = t.join('');
  if (joinedQ === joinedT) return 1.2;
  let total = 0;
  for (const typed of q) {
    let best = 0;
    for (const word of t) best = Math.max(best, wordScore(typed, word));
    // Palabras pegadas: "zeldabotw", "supermario".
    if (best < 0.6 && typed.length >= 4 && joinedT.includes(typed)) best = 0.7;
    total += best;
  }
  let score = total / q.length;
  // Bonus si el título empieza igual y si no sobran muchas palabras.
  if (joinedT.startsWith(joinedQ)) score += 0.1;
  const extra = keyTokens(title).length - q.length;
  if (extra > 0) score -= Math.min(0.15, extra * 0.02);
  return score;
}

// Trozos de cada palabra para pedirle a la API "contiene" (aguanta erratas al final).
export function searchStems(query: string): string[] {
  return keyTokens(query)
    .filter((t) => t.length >= 2)
    .map((t) => (t.length <= 4 ? t : t.slice(0, Math.max(4, Math.ceil(t.length * 0.6)))));
}

// Ordena por parecido y quita lo que no se parece nada.
export function rankByQuery<T>(query: string, items: T[], title: (item: T) => string, popularity?: (item: T) => number): T[] {
  const scored = items.map((item, index) => {
    const base = fuzzyScore(query, title(item));
    const pop = popularity ? Math.min(0.08, Math.log10(1 + Math.max(0, popularity(item))) * 0.025) : 0;
    return { item, index, base, score: base + pop };
  });
  const good = scored.filter((s) => s.base >= 0.55);
  const pool = good.length ? good : scored.filter((s) => s.base >= 0.35);
  return pool.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.item);
}
