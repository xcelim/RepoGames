import type { PlayStatus } from '@/types';

// Una línea del importador: "Título | año | estado | nota" (todo menos el título es opcional
// y puede ir en cualquier orden).
export type ImportLine = {
  title: string;
  year: number | null;
  status: PlayStatus | null;
  rating: number | null;
  platform: string | null;
};

const STATUS_WORDS: [RegExp, PlayStatus][] = [
  [/^(pasado|pasados|terminado|terminados|completado|completados|beat|beaten|finished|done|acabado)$/, 'beaten'],
  [/^(completed|100|100%|100 %|al 100|al 100%|al 100 %|platino|platinum)$/, 'completed'],
  [/^(jugando|playing|en curso)$/, 'playing'],
  [/^(pausa|en pausa|pausado|paused|on hold)$/, 'paused'],
  [/^(abandonado|abandonados|dropped|dejado)$/, 'dropped'],
  [/^(pendiente|pendientes|backlog|por jugar)$/, 'backlog'],
  [/^(deseado|deseados|wishlist|lo quiero|quiero)$/, 'wishlist'],
  [/^(biblioteca|library|mis juegos|jugado|jugados|lo he jugado)$/, 'library'],
  [/^(visto|vistos|watched|lo he visto)$/, 'watched'],
];

export function parseStatus(word: string): PlayStatus | null {
  const w = word.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [re, status] of STATUS_WORDS) if (re.test(w)) return status;
  return null;
}

// Plataformas que se reconocen al importar (con sus apodos).
const PLATFORMS: [RegExp, string][] = [
  [/^(game ?boy advance|gba|gameboy advance)$/, 'Game Boy Advance'],
  [/^(game ?boy color|gbc)$/, 'Game Boy Color'],
  [/^(game ?boy|gb)$/, 'Game Boy'],
  [/^((nintendo |new )?3ds( xl)?|2ds)$/, 'Nintendo 3DS'],
  [/^((nintendo )?ds( lite)?|nds|dsi)$/, 'Nintendo DS'],
  [/^(nintendo )?switch 2$/, 'Nintendo Switch 2'],
  [/^(nintendo )?switch$/, 'Nintendo Switch'],
  [/^wii ?u$/, 'Wii U'],
  [/^wii$/, 'Wii'],
  [/^((nintendo )?gamecube|gc|ngc)$/, 'GameCube'],
  [/^(nintendo 64|n64)$/, 'Nintendo 64'],
  [/^(super nintendo|snes|super nes|super famicom)$/, 'Super Nintendo'],
  [/^(nes|nintendo nes|famicom)$/, 'NES'],
  [/^(psp|playstation portable)$/, 'PSP'],
  [/^(ps ?vita|vita)$/, 'PS Vita'],
  [/^(ps1|psx|psone|playstation 1|playstation)$/, 'PlayStation'],
  [/^(ps2|playstation 2)$/, 'PlayStation 2'],
  [/^(ps3|playstation 3)$/, 'PlayStation 3'],
  [/^(ps4|playstation 4)$/, 'PlayStation 4'],
  [/^(ps5|playstation 5)$/, 'PlayStation 5'],
  [/^(xbox series( x| s| x\/s)?|series x|series s)$/, 'Xbox Series X/S'],
  [/^(xbox one)$/, 'Xbox One'],
  [/^(xbox 360|x360)$/, 'Xbox 360'],
  [/^xbox$/, 'Xbox'],
  [/^(pc|windows|steam|ordenador)$/, 'PC'],
  [/^(mega ?drive|genesis)$/, 'Mega Drive'],
  [/^(master system)$/, 'Master System'],
  [/^(dreamcast)$/, 'Dreamcast'],
  [/^(movil|android|ios|iphone)$/, 'Móvil'],
];

export function parsePlatform(word: string): string | null {
  const w = word.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [re, name] of PLATFORMS) if (re.test(w)) return name;
  return null;
}

export function parseImportText(text: string): ImportLine[] {
  const out: ImportLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // Quita viñetas y numeración: "1. ", "- ", "• ", "3) "
    const line = raw.replace(/^\s*(?:[-*•·]|\d{1,3}[.)])\s+/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s*[|;\t]\s*/).filter(Boolean);
    const entry: ImportLine = { title: '', year: null, status: null, rating: null, platform: null };
    const titleParts: string[] = [];
    parts.forEach((part, i) => {
      if (i === 0) return titleParts.push(part);
      const status = parseStatus(part);
      if (status) return (entry.status = status);
      const platform = parsePlatform(part);
      if (platform) return (entry.platform = platform);
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
