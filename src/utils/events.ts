// Eventos de temporada: Halloween, Navidad, verano... cada uno con su reto y una insignia que solo
// se consigue mientras dura.
import type { MyGame } from '@/hooks/useMyGames';
import { finishedDay } from '@/hooks/useMyGames';

export type EventCtx = {
  finished: MyGame[]; // terminados durante el evento
  touched: MyGame[]; // editados durante el evento
  added: MyGame[]; // añadidos durante el evento
  themes: Map<number, { themes: number[]; genres: number[] }>; // de IGDB
};

export type SeasonEvent = {
  key: string;
  name: string;
  emoji: string;
  particles: string[];
  colors: [string, string];
  start: string; // MM-DD
  end: string; // MM-DD (si es menor que start, acaba al año siguiente)
  goal: string;
  target: number;
  badge: string; // nombre de la insignia
  needsThemes?: boolean;
  count: (c: EventCtx) => number;
};

const HORROR_TITLES =
  /resident evil|silent hill|dead space|outlast|amnesia|fatal frame|project zero|alan wake|evil within|until dawn|five nights|alien: isolation|layers of fear|the callisto|little nightmares|signalis|visage|dredge|soma\b|condemned|f\.e\.a\.r|darkwood|dead by daylight|phasmophobia|the quarry|clock tower|siren\b|parasite eve|dino crisis/i;

const sixMonthsBefore = (m: MyGame) => {
  const end = finishedDay(m.ug);
  return !!end && Date.parse(m.ug.addedAt) < Date.parse(end) - 180 * 86_400_000;
};

export const SEASON_EVENTS: SeasonEvent[] = [
  {
    key: 'sanvalentin',
    name: 'Amor por los juegos',
    emoji: '💘',
    particles: ['💘', '💖', '💌'],
    colors: ['#ff5f8f', '#a1155b'],
    start: '02-07',
    end: '02-21',
    goal: 'Marca 2 juegos como favoritos',
    target: 2,
    badge: 'Corazón gamer',
    count: (c) => c.touched.filter((m) => m.ug.favorite).length,
  },
  {
    key: 'primavera',
    name: 'Limpieza de primavera',
    emoji: '🌸',
    particles: ['🌸', '🌷', '🍃'],
    colors: ['#f6a5c0', '#3fa66a'],
    start: '03-20',
    end: '04-15',
    goal: 'Termina 2 juegos que llevaban más de 6 meses esperando',
    target: 2,
    badge: 'Backlog a raya',
    count: (c) => c.finished.filter(sixMonthsBefore).length,
  },
  {
    key: 'verano',
    name: 'Verano retro',
    emoji: '☀️',
    particles: ['☀️', '🌴', '🕹️'],
    colors: ['#ffb347', '#ff5e62'],
    start: '06-21',
    end: '08-31',
    goal: 'Termina 2 juegos anteriores a 2005',
    target: 2,
    badge: 'Ola retro',
    count: (c) => c.finished.filter((m) => (m.game.year ?? 3000) < 2005).length,
  },
  {
    key: 'sagas',
    name: 'Septiembre de sagas',
    emoji: '🗡️',
    particles: ['🗡️', '🛡️', '📜'],
    colors: ['#4b6cb7', '#182848'],
    start: '09-01',
    end: '09-30',
    goal: 'Termina un juego que forme parte de una saga',
    target: 1,
    badge: 'Guardián de sagas',
    count: (c) => c.finished.filter((m) => !!m.game.series).length,
  },
  {
    key: 'halloween',
    name: 'Noche de terror',
    emoji: '🎃',
    particles: ['🎃', '🦇', '👻', '🕸️'],
    colors: ['#ff7518', '#3d0c5c'],
    start: '10-15',
    end: '11-07',
    goal: 'Termina un juego de terror',
    target: 1,
    badge: 'Superviviente',
    needsThemes: true,
    count: (c) =>
      c.finished.filter((m) => {
        const t = m.game.igdbId ? c.themes.get(m.game.igdbId) : undefined;
        return (t?.themes.includes(19) ?? false) || HORROR_TITLES.test(m.game.title);
      }).length,
  },
  {
    key: 'ofertas',
    name: 'Semana cazaofertas',
    emoji: '🛒',
    particles: ['🛒', '🏷️', '💸'],
    colors: ['#141e30', '#f5c518'],
    start: '11-20',
    end: '12-02',
    goal: 'Añade 3 juegos a tus deseados',
    target: 3,
    badge: 'Cazaofertas',
    count: (c) => c.added.filter((m) => m.ug.status === 'wishlist').length,
  },
  {
    key: 'navidad',
    name: 'Navidad gamer',
    emoji: '🎄',
    particles: ['🎄', '❄️', '🎁', '⭐'],
    colors: ['#c31432', '#0f5132'],
    start: '12-15',
    end: '01-06',
    goal: 'Termina 2 juegos durante las fiestas',
    target: 2,
    badge: 'Espíritu navideño',
    count: (c) => c.finished.length,
  },
];

export type EventWindow = { event: SeasonEvent; id: string; from: string; to: string };

// La edición de un evento que contiene (o empieza después de) un día.
function windowFor(e: SeasonEvent, year: number): EventWindow {
  const wraps = e.end < e.start;
  return { event: e, id: `${e.key}-${year}`, from: `${year}-${e.start}`, to: `${wraps ? year + 1 : year}-${e.end}` };
}

export function activeEvent(today: string): EventWindow | null {
  const y = Number(today.slice(0, 4));
  for (const e of SEASON_EVENTS) {
    for (const w of [windowFor(e, y), windowFor(e, y - 1)]) if (today >= w.from && today <= w.to) return w;
  }
  return null;
}

export function nextEvent(today: string): EventWindow {
  const y = Number(today.slice(0, 4));
  const all = SEASON_EVENTS.flatMap((e) => [windowFor(e, y), windowFor(e, y + 1)])
    .filter((w) => w.from > today)
    .sort((a, b) => a.from.localeCompare(b.from));
  return all[0];
}

export function eventById(id: string): SeasonEvent | undefined {
  return SEASON_EVENTS.find((e) => id.startsWith(`${e.key}-`));
}

export function eventContext(mine: MyGame[], w: EventWindow, themes: EventCtx['themes']): EventCtx {
  const inside = (d: string | null | undefined) => !!d && d.slice(0, 10) >= w.from && d.slice(0, 10) <= w.to;
  return {
    finished: mine.filter((m) => inside(finishedDay(m.ug))),
    touched: mine.filter((m) => inside(m.ug.updatedAt)),
    added: mine.filter((m) => inside(m.ug.addedAt)),
    themes,
  };
}

export const daysLeft = (w: EventWindow, today: string) =>
  Math.max(0, Math.round((Date.parse(w.to) - Date.parse(today)) / 86_400_000));
