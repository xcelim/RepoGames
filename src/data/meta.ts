import type { ListSort, PlayStatus } from '@/types';

export type StatusMeta = { label: string; short: string; caption: string; icon: string; color: string };

// Orden de los estados en la biblioteca (igual que IGN Playlist).
export const STATUS_ORDER: PlayStatus[] = [
  'library',
  'wishlist',
  'backlog',
  'playing',
  'paused',
  'beaten',
  'completed',
  'dropped',
];

// Los que se ofrecen al elegir estado (el "100 %" se marca desde Más detalles).
export const STATUS_CHOICES: PlayStatus[] = [
  'library',
  'wishlist',
  'backlog',
  'playing',
  'beaten',
  'paused',
  'dropped',
];

export const STATUS_META: Record<PlayStatus, StatusMeta> = {
  library: {
    label: 'Mis juegos',
    short: 'En biblioteca',
    caption: 'JUEGOS EN TU BIBLIOTECA',
    icon: 'library',
    color: '#6b7080',
  },
  wishlist: { label: 'Deseados', short: 'Deseado', caption: 'LO QUIERO', icon: 'star', color: '#8f95a8' },
  backlog: { label: 'Pendientes', short: 'Pendiente', caption: 'PIENSO JUGARLO', icon: 'albums', color: '#7b5cf0' },
  playing: {
    label: 'Jugando',
    short: 'Jugando',
    caption: 'EMPEZADO O EN CURSO',
    icon: 'game-controller',
    color: '#17b4d4',
  },
  paused: {
    label: 'En pausa',
    short: 'En pausa',
    caption: 'ME ESTOY TOMANDO UN DESCANSO',
    icon: 'pause',
    color: '#f59e0b',
  },
  beaten: { label: 'Terminados', short: 'Terminado', caption: 'LO HE COMPLETADO', icon: 'checkmark', color: '#6aa834' },
  completed: { label: 'Al 100 %', short: '100 %', caption: 'LO HE SACADO TODO', icon: 'trophy', color: '#c9a227' },
  dropped: { label: 'Abandonados', short: 'Abandonado', caption: 'NO VOLVERÉ', icon: 'stop', color: '#e5484d' },
};

// Filas de la tarjeta de la Biblioteca. "all" = todos los juegos.
export type LibraryRow = PlayStatus | 'all';
export const LIBRARY_ROWS: LibraryRow[] = ['all', 'wishlist', 'backlog', 'playing', 'paused', 'beaten', 'dropped'];

export const LIBRARY_ROW_META: Record<LibraryRow, StatusMeta> = {
  ...STATUS_META,
  all: { ...STATUS_META.library },
};

// Qué estados entran en cada fila (los "al 100 %" cuentan como terminados).
export function statusesOfRow(row: LibraryRow): PlayStatus[] | null {
  if (row === 'all') return null;
  if (row === 'beaten') return ['beaten', 'completed'];
  return [row];
}

// Etiqueta de una nota del 1 al 10 (escala de IGN).
export const SCORE_LABEL: Record<number, string> = {
  1: 'Insufrible',
  2: 'Doloroso',
  3: 'Horrible',
  4: 'Malo',
  5: 'Mediocre',
  6: 'Correcto',
  7: 'Bueno',
  8: 'Genial',
  9: 'Increíble',
  10: 'Obra maestra',
};

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#9aa0ad';
  if (score >= 7.5) return '#6aa834';
  if (score >= 5) return '#e0a020';
  return '#d6403a';
}

export const FINISHED: PlayStatus[] = ['beaten', 'completed'];

export const PLATFORMS = [
  'Switch 2',
  'Switch',
  'PS5',
  'PS4',
  'PS3',
  'PS2',
  'PS1',
  'PS Vita',
  'PSP',
  'Xbox Series',
  'Xbox One',
  'Xbox 360',
  'PC',
  'Steam Deck',
  '3DS',
  'DS',
  'Wii U',
  'Wii',
  'GameCube',
  'N64',
  'SNES',
  'NES',
  'GBA',
  'Game Boy',
  'Móvil',
  'Emulador',
];

// Lo que te gustó o no de un juego (como las etiquetas de reseña de IGN).
export const LIKE_TAGS = [
  'Accesibilidad',
  'Estilo artístico',
  'Atmósfera',
  'Equilibrio',
  'Personajes',
  'Alegre',
  'Cooperativo',
  'Coleccionables',
  'Combate',
  'Controles',
  'Dificultad',
  'Diseño de niveles',
  'Duración',
  'Exploración',
  'Final',
  'Gráficos',
  'Historia',
  'Humor',
  'Jugabilidad',
  'Multijugador',
  'Mundo',
  'Música',
  'Personalización',
  'Precio',
  'Progresión',
  'Puzles',
  'Rejugabilidad',
  'Rendimiento',
  'Ritmo',
  'Sonido',
];

// Las ordenaciones de una lista (las mismas que IGN Playlist).
export const SORT_OPTIONS: { id: ListSort; label: string }[] = [
  { id: 'manual', label: 'Orden del autor' },
  { id: 'updated-new', label: 'Actualizados recientemente' },
  { id: 'updated-old', label: 'Actualizados hace más tiempo' },
  { id: 'az', label: 'A-Z alfabético' },
  { id: 'za', label: 'Z-A alfabético' },
  { id: 'critic-high', label: 'Nota de la crítica: más alta' },
  { id: 'critic-low', label: 'Nota de la crítica: más baja' },
  { id: 'release-new', label: 'Lanzamiento: más reciente' },
  { id: 'release-old', label: 'Lanzamiento: más antiguo' },
  { id: 'hltb-long', label: 'Duración: de larga a corta' },
  { id: 'hltb-short', label: 'Duración: de corta a larga' },
  { id: 'mine-high', label: 'Mis notas: más alta' },
  { id: 'mine-low', label: 'Mis notas: más baja' },
];

export const SORT_LABEL = Object.fromEntries(SORT_OPTIONS.map((o) => [o.id, o.label])) as Record<ListSort, string>;
SORT_LABEL.status = 'Estado';

// Chapitas de plataforma (como los iconos de IGN).
export function platformBadge(name: string): { label: string; color: string } {
  const n = name.toLowerCase();
  if (/switch 2/.test(n)) return { label: 'NS2', color: '#e60012' };
  if (/switch/.test(n)) return { label: 'NS', color: '#e60012' };
  if (/series x|series s|xbox series/.test(n)) return { label: 'XS', color: '#107c10' };
  if (/xbox one/.test(n)) return { label: 'XB1', color: '#107c10' };
  if (/xbox 360|x360/.test(n)) return { label: '360', color: '#107c10' };
  if (/xbox/.test(n)) return { label: 'XB', color: '#107c10' };
  if (/playstation 5|ps5/.test(n)) return { label: 'PS5', color: '#1f4bb8' };
  if (/playstation 4|ps4/.test(n)) return { label: 'PS4', color: '#1f4bb8' };
  if (/playstation 3|ps3/.test(n)) return { label: 'PS3', color: '#1f4bb8' };
  if (/playstation 2|ps2/.test(n)) return { label: 'PS2', color: '#1f4bb8' };
  if (/vita/.test(n)) return { label: 'VITA', color: '#1f4bb8' };
  if (/portable|psp/.test(n)) return { label: 'PSP', color: '#1f4bb8' };
  if (/playstation|ps1|psx/.test(n)) return { label: 'PS1', color: '#1f4bb8' };
  if (/pc|windows|mac|linux|steam/.test(n)) return { label: n.includes('deck') ? 'DECK' : 'PC', color: '#4a4f5c' };
  if (/new nintendo 3ds|3ds/.test(n)) return { label: '3DS', color: '#c8102e' };
  if (/nintendo ds|^ds$|nds/.test(n)) return { label: 'DS', color: '#8c8f99' };
  if (/wii u/.test(n)) return { label: 'WIIU', color: '#0096c8' };
  if (/wii/.test(n)) return { label: 'WII', color: '#8c8f99' };
  if (/gamecube|ngc/.test(n)) return { label: 'GCN', color: '#6a5acd' };
  if (/nintendo 64|n64/.test(n)) return { label: 'N64', color: '#2e7d32' };
  if (/super nintendo|snes|super famicom/.test(n)) return { label: 'SNES', color: '#7e57c2' };
  if (/game boy advance|gba/.test(n)) return { label: 'GBA', color: '#5c6bc0' };
  if (/game boy color|gbc/.test(n)) return { label: 'GBC', color: '#43a047' };
  if (/game boy/.test(n)) return { label: 'GB', color: '#7c8a6a' };
  if (/nes|famicom|nintendo entertainment/.test(n)) return { label: 'NES', color: '#b71c1c' };
  if (/android|ios|iphone|móvil|mobile/.test(n)) return { label: 'MÓVIL', color: '#5f6b7a' };
  if (/arcade/.test(n)) return { label: 'ARC', color: '#8d6e63' };
  return { label: name.slice(0, 4).toUpperCase(), color: '#8c8f99' };
}

export const LIST_COLORS: [string, string][] = [
  ['#ff2a4d', '#2ef2ff'],
  ['#7b2ff7', '#f107a3'],
  ['#2f9e58', '#e8c547'],
  ['#ff8fc8', '#7fd6ff'],
  ['#e53935', '#ffd23f'],
  ['#1e3c72', '#2a5298'],
  ['#f7971e', '#ffd200'],
  ['#11998e', '#38ef7d'],
  ['#232526', '#7a7f87'],
  ['#c94b4b', '#4b134f'],
];

export const LIST_ICONS = [
  'albums',
  'game-controller',
  'calendar',
  'star',
  'heart',
  'trophy',
  'flame',
  'flash',
  'planet',
  'rocket',
  'shield',
  'diamond',
  'triangle',
  'skull',
  'leaf',
  'moon',
  'musical-notes',
  'library',
];

export const AVATAR_COLORS = ['#ff2a4d', '#7b2ff7', '#3fa7ff', '#2f9e58', '#f2a93b', '#e66cc4', '#11998e', '#5c6370'];
