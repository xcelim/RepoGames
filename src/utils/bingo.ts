// Bingo gamer mensual: un cartón de 5×5 con retos que se marcan solos con lo que haces ese mes.
import type { MyGame } from '@/hooks/useMyGames';
import { finishedDay } from '@/hooks/useMyGames';
import type { DurationMode } from '@/types';
import { gameHours } from '@/utils/library';

export type BingoCtx = {
  month: string; // AAAA-MM
  mine: MyGame[];
  finished: MyGame[]; // terminados este mes
  started: MyGame[]; // empezados este mes
  added: MyGame[]; // añadidos este mes
  touched: MyGame[]; // tocados (editados) este mes
  mode: DurationMode;
};

export type BingoChallenge = {
  id: string;
  text: string;
  icon: string;
  done: (c: BingoCtx) => boolean;
};

const plat = (m: MyGame, re: RegExp) => re.test(m.ug.platform ?? '') || re.test(m.game.platforms ?? '');
const hours = (c: BingoCtx, m: MyGame) => gameHours(m.game, c.mode);

export const BINGO_POOL: BingoChallenge[] = [
  {
    id: 'fin1',
    icon: 'flag',
    text: 'Termina un juego',
    done: (c) => c.finished.length >= 1,
  },
  {
    id: 'fin3',
    icon: 'flag',
    text: 'Termina 3 juegos',
    done: (c) => c.finished.length >= 3,
  },
  {
    id: 'fin5',
    icon: 'flame',
    text: 'Termina 5 juegos',
    done: (c) => c.finished.length >= 5,
  },
  {
    id: 'old',
    icon: 'hourglass',
    text: 'Termina uno anterior al 2000',
    done: (c) => c.finished.some((m) => (m.game.year ?? 3000) < 2000),
  },
  {
    id: '90s',
    icon: 'disc',
    text: 'Termina uno de los 90',
    done: (c) => c.finished.some((m) => (m.game.year ?? 0) >= 1990 && (m.game.year ?? 0) < 2000),
  },
  {
    id: '2010s',
    icon: 'calendar',
    text: 'Termina uno de 2010 a 2019',
    done: (c) => c.finished.some((m) => (m.game.year ?? 0) >= 2010 && (m.game.year ?? 0) < 2020),
  },
  {
    id: 'new',
    icon: 'sparkles',
    text: 'Termina uno de este año',
    done: (c) => c.finished.some((m) => m.game.year === Number(c.month.slice(0, 4))),
  },
  {
    id: 'short',
    icon: 'timer',
    text: 'Termina uno de menos de 10 h',
    done: (c) => c.finished.some((m) => hours(c, m) > 0 && hours(c, m) < 10),
  },
  {
    id: 'long',
    icon: 'trail-sign',
    text: 'Termina uno de más de 40 h',
    done: (c) => c.finished.some((m) => hours(c, m) > 40),
  },
  {
    id: 'critic',
    icon: 'star',
    text: 'Termina uno con 85+ de la crítica',
    done: (c) => c.finished.some((m) => (m.game.criticRating ?? 0) >= 85),
  },
  {
    id: 'saga',
    icon: 'library',
    text: 'Termina un juego de una saga',
    done: (c) => c.finished.some((m) => !!m.game.series),
  },
  {
    id: 'switch',
    icon: 'game-controller',
    text: 'Termina uno de Nintendo',
    done: (c) => c.finished.some((m) => plat(m, /switch|nintendo|wii|3ds|game ?boy|gamecube/i)),
  },
  {
    id: 'pc',
    icon: 'desktop',
    text: 'Termina uno en PC',
    done: (c) => c.finished.some((m) => plat(m, /\bpc\b|windows|steam/i)),
  },
  {
    id: 'ps',
    icon: 'logo-playstation',
    text: 'Termina uno de PlayStation',
    done: (c) => c.finished.some((m) => plat(m, /playstation|ps[1-5]|psp|vita/i)),
  },
  {
    id: 'physical',
    icon: 'disc',
    text: 'Termina uno que tengas en físico',
    done: (c) => c.finished.some((m) => m.ug.owned),
  },
  {
    id: 'backlog',
    icon: 'archive',
    text: 'Termina uno que llevaba +6 meses esperando',
    done: (c) => c.finished.some((m) => Date.parse(m.ug.addedAt) < Date.parse(`${c.month}-01`) - 180 * 86_400_000),
  },
  {
    id: 'quick',
    icon: 'speedometer',
    text: 'Empieza y termina uno en 7 días',
    done: (c) =>
      c.finished.some(
        (m) => !!m.ug.startedAt && Date.parse(finishedDay(m.ug)!) - Date.parse(m.ug.startedAt) <= 7 * 86_400_000,
      ),
  },
  {
    id: 'fresh',
    icon: 'leaf',
    text: 'Termina uno que empezaste este mes',
    done: (c) => c.finished.some((m) => (m.ug.startedAt ?? '').startsWith(c.month)),
  },
  {
    id: 'full',
    icon: 'trophy',
    text: 'Complétalo al 100 %',
    done: (c) => c.finished.some((m) => m.ug.status === 'completed'),
  },
  {
    id: 'start1',
    icon: 'play',
    text: 'Empieza un juego',
    done: (c) => c.started.length >= 1,
  },
  {
    id: 'start3',
    icon: 'play-forward',
    text: 'Empieza 3 juegos',
    done: (c) => c.started.length >= 3,
  },
  {
    id: 'add3',
    icon: 'add-circle',
    text: 'Añade 3 juegos',
    done: (c) => c.added.length >= 3,
  },
  {
    id: 'wish',
    icon: 'heart',
    text: 'Añade uno a deseados',
    done: (c) => c.added.some((m) => m.ug.status === 'wishlist'),
  },
  {
    id: 'rate',
    icon: 'star-half',
    text: 'Pon nota a un juego',
    done: (c) => c.touched.some((m) => m.ug.rating != null),
  },
  {
    id: 'ten',
    icon: 'ribbon',
    text: 'Pon un 10 a un juego',
    done: (c) => c.touched.some((m) => m.ug.rating === 10),
  },
  {
    id: 'review',
    icon: 'create',
    text: 'Escribe una reseña',
    done: (c) => c.touched.some((m) => (m.ug.review ?? '').trim().length > 20),
  },
  {
    id: 'fav',
    icon: 'heart-circle',
    text: 'Marca un favorito',
    done: (c) => c.touched.some((m) => m.ug.favorite),
  },
  {
    id: 'drop',
    icon: 'close-circle',
    text: 'Abandona uno que no te llena',
    done: (c) => c.touched.some((m) => m.ug.status === 'dropped'),
  },
  {
    id: 'two',
    icon: 'git-compare',
    text: 'Juega a dos a la vez',
    done: (c) => c.mine.filter((m) => m.ug.status === 'playing').length >= 2,
  },
];

// Generador pseudoaleatorio con semilla (el mismo cartón para ti todo el mes).
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 25 casillas; la del centro es libre.
export function bingoCard(seed: string, month: string): (BingoChallenge | null)[] {
  const rand = rng(`${seed}|${month}`);
  const pool = [...BINGO_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 24);
  return [...picks.slice(0, 12), null, ...picks.slice(12)];
}

export function bingoContext(mine: MyGame[], month: string, mode: DurationMode): BingoCtx {
  const inMonth = (d: string | null | undefined) => !!d && d.startsWith(month);
  return {
    month,
    mine,
    mode,
    finished: mine.filter((m) => inMonth(finishedDay(m.ug))),
    started: mine.filter((m) => inMonth(m.ug.startedAt)),
    added: mine.filter((m) => inMonth(m.ug.addedAt)),
    touched: mine.filter((m) => inMonth(m.ug.updatedAt)),
  };
}

export const BINGO_LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

export function bingoLines(marked: boolean[]): number[][] {
  return BINGO_LINES.filter((line) => line.every((i) => marked[i]));
}
