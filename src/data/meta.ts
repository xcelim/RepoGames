import type { ListSort, PlayStatus } from '@/types';

export type StatusMeta = { label: string; short: string; icon: string; color: string };

export const STATUS_ORDER: PlayStatus[] = [
  'playing',
  'backlog',
  'wishlist',
  'paused',
  'beaten',
  'completed',
  'dropped',
];

export const STATUS_META: Record<PlayStatus, StatusMeta> = {
  wishlist: { label: 'Lo quiero', short: 'Lo quiero', icon: 'heart-outline', color: '#e66cc4' },
  backlog: { label: 'Pendiente', short: 'Pendiente', icon: 'albums-outline', color: '#8a8fa8' },
  playing: { label: 'Jugando', short: 'Jugando', icon: 'game-controller', color: '#3fa7ff' },
  paused: { label: 'En pausa', short: 'Pausa', icon: 'pause-circle', color: '#f2a93b' },
  beaten: { label: 'Terminado', short: 'Terminado', icon: 'flag', color: '#3dbb6b' },
  completed: { label: 'Completado al 100 %', short: '100 %', icon: 'trophy', color: '#e8c547' },
  dropped: { label: 'Abandonado', short: 'Abandonado', icon: 'close-circle', color: '#e5484d' },
};

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

export const LIKE_TAGS = [
  'Historia',
  'Personajes',
  'Jugabilidad',
  'Combate',
  'Música',
  'Arte',
  'Gráficos',
  'Mundo',
  'Exploración',
  'Diseño de niveles',
  'Dificultad',
  'Duración',
  'Rejugabilidad',
  'Final',
  'Rendimiento',
  'Multijugador',
];

export const SORT_LABEL: Record<ListSort, string> = {
  manual: 'Mi orden',
  release: 'Lanzamiento',
  rating: 'Mi nota',
  title: 'Título',
  duration: 'Duración',
  status: 'Estado',
  added: 'Añadido',
};

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

export const AVATAR_COLORS = [
  '#ff2a4d',
  '#7b2ff7',
  '#3fa7ff',
  '#2f9e58',
  '#f2a93b',
  '#e66cc4',
  '#11998e',
  '#5c6370',
];
