// Importar tu colección desde una tabla (CSV o Excel) exportada de otra app: HowLongToBeat,
// Backloggd, Grouvee, Playnite, una hoja de cálculo tuya... Se adivina qué columna es cada cosa.
import { strFromU8, unzipSync } from 'fflate';

import type { PlayStatus } from '@/types';

export type Table = { headers: string[]; rows: string[][] };

export type Mapping = {
  title: number;
  status: number | null;
  rating: number | null;
  platform: number | null;
  year: number | null;
  hours: number | null;
  finished: number | null;
  review: number | null;
  statusColumns: { col: number; status: PlayStatus }[]; // columnas sí/no (HowLongToBeat)
};

export type TableEntry = {
  title: string;
  status: PlayStatus | null;
  rating: number | null; // 1-10
  platform: string | null;
  year: number | null;
  hours: number | null;
  finishedAt: string | null;
  review: string | null;
};

// ---------- CSV ----------

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---------- Excel (.xlsx: un zip con XML dentro) ----------

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const textOf = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');

const colIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// Fecha de Excel (días desde 1900) → AAAA-MM-DD.
const excelDate = (n: number) => new Date(Math.round((n - 25569) * 86_400_000)).toISOString().slice(0, 10);

export function parseXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, {
    filter: (f) => f.name.startsWith('xl/worksheets/sheet') || f.name === 'xl/sharedStrings.xml',
  });
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const sheetName = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetName) throw new Error('El Excel no tiene hojas');
  const xml = strFromU8(files[sheetName]);
  const rows: string[][] = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? '';
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1] ?? '';
      const type = attrs.match(/t="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && v != null) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (v != null) value = decodeXml(v);
      // Las fechas llegan como número con estilo de fecha; se convierten si lo parecen.
      if (!type && /s="\d+"/.test(attrs) && /^\d{5}(\.\d+)?$/.test(value)) {
        const n = Number(value);
        if (n > 20000 && n < 80000) value = excelDate(n);
      }
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push('');
      row[idx] = value;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => (c ?? '').trim() !== ''));
}

export function toTable(rows: string[][]): Table {
  const [head = [], ...rest] = rows;
  const width = Math.max(head.length, ...rest.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (head[i] ?? '').trim() || `Columna ${i + 1}`);
  return { headers, rows: rest.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim())) };
}

// ---------- Qué columna es qué ----------

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const find = (headers: string[], re: RegExp) => {
  const i = headers.findIndex((h) => re.test(fold(h)));
  return i >= 0 ? i : null;
};

// Columnas sí/no de HowLongToBeat y similares.
const FLAG_COLUMNS: [RegExp, PlayStatus][] = [
  [/^(completed|completado|terminado)$/, 'beaten'],
  [/^(playing|jugando)$/, 'playing'],
  [/^(backlog|pendiente)$/, 'backlog'],
  [/^(retired|abandonado|dropped)$/, 'dropped'],
  [/^(wishlist|deseado)$/, 'wishlist'],
];

export function guessMapping(t: Table): Mapping {
  const h = t.headers;
  const statusColumns = h
    .map((name, col) => {
      const hit = FLAG_COLUMNS.find(([re]) => re.test(fold(name)));
      return hit ? { col, status: hit[1] } : null;
    })
    .filter((x): x is { col: number; status: PlayStatus } => !!x);
  const title =
    find(h, /^(title|name|game|game name|juego|titulo|nombre|game title)$/) ??
    find(h, /(title|name|juego|titulo|nombre)/) ??
    0;
  return {
    title,
    status: find(h, /^(status|estado|completionstatus|completion status|list|shelf|shelves|lista|progress|progreso)$/),
    rating: find(h, /^(rating|score|nota|puntuacion|user ?score|my rating|review score|stars|estrellas|valoracion)$/),
    platform: find(h, /^(platforms?|plataformas?|system|console|consola|storefront)$/),
    year: find(h, /^(year|ano|release ?(date|year)|fecha de salida|released|first release date)$/),
    hours: find(h, /^(hours|horas|play ?time|playtime|time played|tiempo( jugado)?|hours played|horas jugadas)$/),
    finished: find(
      h,
      /(completion date|date finished|finished( on)?|completed( on| date)?|fecha (de )?fin|terminado el|end date|date completed)/,
    ),
    review: find(h, /^(review|resena|notes|notas|comentario|comment)$/),
    statusColumns,
  };
}

export type Preset = 'hltb' | 'backloggd' | 'grouvee' | 'playnite' | 'generic';
export const PRESET_LABEL: Record<Preset, string> = {
  hltb: 'HowLongToBeat',
  backloggd: 'Backloggd',
  grouvee: 'Grouvee',
  playnite: 'Playnite',
  generic: 'Tabla',
};

export function detectPreset(t: Table): Preset {
  const h = new Set(t.headers.map(fold));
  if (h.has('main story') || h.has('main + extras') || h.has('completionist')) return 'hltb';
  if (h.has('shelves') && h.has('giantbomb_id')) return 'grouvee';
  if (h.has('shelves')) return 'grouvee';
  if (h.has('completionstatus') || h.has('completion status')) return 'playnite';
  if (h.has('backloggd') || (h.has('status') && h.has('rating') && h.has('platform') && h.has('played on')))
    return 'backloggd';
  return 'generic';
}

// Estados de cualquier app, en español o en inglés.
const STATUS_HINTS: [RegExp, PlayStatus][] = [
  [/(100 ?%|completionist|platin|mastered|completado|completed 100)/, 'completed'],
  [/(not played|no jugado|sin jugar|plan to play|planned|por jugar|backlog|pendiente|unplayed|to play)/, 'backlog'],
  [/(wish|deseado|lo quiero|want)/, 'wishlist'],
  [/(abandon|retired|dropped|abandonado|dejado|quit)/, 'dropped'],
  [/(on hold|paused|pausa|shelved)/, 'paused'],
  [/(playing|jugando|in progress|en curso|currently)/, 'playing'],
  [/(beaten|completed|finished|played|terminado|pasado|acabado|done|beat)/, 'beaten'],
  [/(owned|library|biblioteca|coleccion|collection)/, 'library'],
];

export function statusFromText(text: string): PlayStatus | null {
  const t = fold(text);
  if (!t) return null;
  for (const [re, s] of STATUS_HINTS) if (re.test(t)) return s;
  return null;
}

const truthy = (v: string) =>
  /^(x|1|yes|si|sí|true|verdadero|✓|✔)$/i.test(v.trim()) || /^\d{4}-\d{2}-\d{2}/.test(v.trim());

function parseDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    // Día/mes/año (España) salvo que el primer número no pueda ser día.
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
    return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) && s.length > 5 ? new Date(t).toISOString().slice(0, 10) : null;
}

// Hora: "12.5", "12,5", "12:30", "750 min", "45000" (segundos de Playnite).
function parseHours(v: string, preset: Preset): number | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const hm = s.match(/^(\d+):(\d{2})(?::\d{2})?$/);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  const hhmm = s.match(/(\d+)\s*h(?:ours?|oras?)?\s*(?:(\d+)\s*m)?/);
  if (hhmm) return Number(hhmm[1]) + Number(hhmm[2] ?? 0) / 60;
  const min = s.match(/^(\d+(?:[.,]\d+)?)\s*(m|min|mins|minutes|minutos)$/);
  if (min) return Number(min[1].replace(',', '.')) / 60;
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (preset === 'playnite') return n / 3600; // Playnite guarda segundos
  return n;
}

export function readEntries(t: Table, m: Mapping, preset: Preset): TableEntry[] {
  // Escala de las notas: si la máxima es 5 son estrellas, si pasa de 10 es sobre 100.
  const ratings =
    m.rating != null ? t.rows.map((r) => Number((r[m.rating!] ?? '').replace(',', '.'))).filter((n) => n > 0) : [];
  const max = ratings.length ? Math.max(...ratings) : 10;
  const scale = max <= 5 ? 2 : max > 10 ? 0.1 : 1;
  const out: TableEntry[] = [];
  for (const r of t.rows) {
    const title = (r[m.title] ?? '').trim();
    if (!title) continue;
    let status = m.status != null ? statusFromText(r[m.status] ?? '') : null;
    if (!status) for (const sc of m.statusColumns) if (truthy(r[sc.col] ?? '')) status = sc.status;
    const rawRating = m.rating != null ? Number((r[m.rating] ?? '').replace(',', '.')) : NaN;
    const rating = rawRating > 0 ? Math.max(1, Math.min(10, Math.round(rawRating * scale))) : null;
    const yearText = m.year != null ? (r[m.year] ?? '') : '';
    const year = Number(yearText.match(/(19[5-9]\d|20\d{2})/)?.[1] ?? NaN);
    const hours = m.hours != null ? parseHours(r[m.hours] ?? '', preset) : null;
    let finishedAt = m.finished != null ? parseDate(r[m.finished] ?? '') : null;
    // HowLongToBeat pone la fecha dentro de la columna «Completed».
    if (!finishedAt) {
      const flag = m.statusColumns.find((sc) => sc.status === 'beaten');
      if (flag) finishedAt = parseDate(r[flag.col] ?? '');
    }
    if (finishedAt && !status) status = 'beaten';
    out.push({
      title: title.replace(/\s*\((\d{4})\)\s*$/, ''),
      status,
      rating,
      platform: m.platform != null ? (r[m.platform] ?? '').split(/[,;]/)[0].trim() || null : null,
      year: Number.isFinite(year) ? year : Number(title.match(/\((\d{4})\)\s*$/)?.[1] ?? NaN) || null,
      hours: hours != null ? Math.round(hours * 10) / 10 : null,
      finishedAt,
      review: m.review != null ? (r[m.review] ?? '').trim() || null : null,
    });
  }
  return out;
}
