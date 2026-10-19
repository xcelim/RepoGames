import type { GameList, ListItem, ShowcaseType, UserGame } from '@/types';

// Nivel de jugador al estilo Steam: se gana experiencia jugando y apuntándolo en la app.

// Subir cuesta: el nivel 1 son unos 4 juegos terminados, el 10 unos 40 y el 30 unos 170.
// Un platino vale como 4 juegos terminados.
export const XP = {
  inLibrary: 2,
  playing: 5,
  beaten: 120,
  completed: 180,
  rating: 5,
  review: 20,
  achievement: 3,
  platinum: 500,
  replay: 60,
  list: 10,
  physical: 2,
};

// Experiencia necesaria para pasar del nivel L al L+1.
export const stepFor = (level: number) => 450 + 15 * level;

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 0;
  let rest = xp;
  while (rest >= stepFor(level)) {
    rest -= stepFor(level);
    level++;
  }
  return { level, into: rest, need: stepFor(level) };
}

export type XpBreakdown = { label: string; xp: number }[];

export function computeXp(input: {
  profileId: string;
  userGames: Record<string, UserGame>;
  lists: Record<string, GameList>;
  items: Record<string, ListItem>;
  platinums: number;
  achievements: number;
}): { xp: number; breakdown: XpBreakdown } {
  const mine = Object.values(input.userGames).filter((u) => u.profileId === input.profileId);
  const myLists = Object.values(input.lists).filter((l) => l.ownerId === input.profileId && !l.official);
  const listIds = new Set(myLists.map((l) => l.id));
  let replays = 0;
  for (const i of Object.values(input.items)) if (listIds.has(i.listId)) replays += i.replays ?? 0;
  for (const u of mine) replays += u.replaysExtra ?? 0;
  const parts: XpBreakdown = [
    { label: 'Juegos en tu biblioteca', xp: mine.length * XP.inLibrary },
    { label: 'Jugando', xp: mine.filter((u) => u.status === 'playing').length * XP.playing },
    { label: 'Terminados', xp: mine.filter((u) => u.status === 'beaten').length * XP.beaten },
    { label: 'Al 100 %', xp: mine.filter((u) => u.status === 'completed').length * XP.completed },
    { label: 'Notas', xp: mine.filter((u) => u.rating).length * XP.rating },
    { label: 'Reseñas', xp: mine.filter((u) => u.review?.trim()).length * XP.review },
    { label: 'Logros', xp: input.achievements * XP.achievement },
    { label: 'Platinos', xp: input.platinums * XP.platinum },
    { label: 'Rejugadas', xp: Math.max(0, replays) * XP.replay },
    { label: 'Listas creadas', xp: myLists.length * XP.list },
    { label: 'En físico', xp: mine.filter((u) => u.owned).length * XP.physical },
  ];
  return { xp: parts.reduce((a, p) => a + p.xp, 0), breakdown: parts.filter((p) => p.xp > 0) };
}

// Huecos para vitrinas: 1 al empezar y uno más cada 5 niveles, como mucho 5.
export const MAX_SHOWCASES = 5;
export const showcaseSlots = (level: number) => Math.min(MAX_SHOWCASES, 1 + Math.floor(level / 5));
export const nextSlotLevel = (level: number) =>
  showcaseSlots(level) >= MAX_SHOWCASES ? null : (Math.floor(level / 5) + 1) * 5;

export const SHOWCASES: Record<ShowcaseType, { name: string; description: string; level: number; icon: string }> = {
  favorites: { name: 'Juegos favoritos', description: 'Hasta 6 juegos que tú eliges', level: 0, icon: 'heart' },
  recent: {
    name: 'Terminados hace poco',
    description: 'Tus últimos juegos terminados',
    level: 1,
    icon: 'checkmark-done',
  },
  completionist: { name: 'Completista', description: 'Tus Platinos Saga Quest', level: 2, icon: 'trophy' },
  stats: { name: 'Estadísticas', description: 'Tus números de un vistazo', level: 3, icon: 'stats-chart' },
  rare: { name: 'Logros más raros', description: 'Los logros que menos gente tiene', level: 5, icon: 'diamond' },
  replays: { name: 'Los más rejugados', description: 'Los juegos a los que más vuelves', level: 8, icon: 'repeat' },
};

// Color del nivel por decenas, como en Steam.
export function levelColor(level: number): string {
  const tiers = [
    '#9aa0a6',
    '#e5484d',
    '#f2994a',
    '#f2c94c',
    '#6fcf97',
    '#56ccf2',
    '#9b51e0',
    '#ff6fb5',
    '#a0785a',
    '#e0e0e0',
  ];
  return tiers[Math.floor(level / 10) % tiers.length];
}
