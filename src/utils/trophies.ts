// Trofeos de Saga Quest: logros de la propia app, con bronce, plata, oro y platino.
import type { MyGame } from '@/hooks/useMyGames';
import type { DurationMode, GameList, ListItem, Profile } from '@/types';
import { gameHours } from '@/utils/library';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const TIER_META: Record<Tier, { label: string; color: string }> = {
  bronze: { label: 'Bronce', color: '#cd7f32' },
  silver: { label: 'Plata', color: '#c0c7d1' },
  gold: { label: 'Oro', color: '#f5c518' },
  platinum: { label: 'Platino', color: '#9ad7ff' },
};

export type TrophyCtx = {
  mine: MyGame[];
  mode: DurationMode;
  profile: Profile | null;
  lists: GameList[]; // tus listas
  items: ListItem[];
  follows: number;
  friends: number;
  cards: {
    total: number;
    legendary: number;
    foil: number;
    unique: number;
    trades: number;
  };
  officialDone: number; // sagas oficiales completas
};

export type Trophy = {
  id: string;
  name: string;
  description: string;
  tier: Tier;
  icon: string;
  group: string;
  progress: (c: TrophyCtx) => [number, number]; // [actual, objetivo]
};

const finished = (c: TrophyCtx) => c.mine.filter((m) => m.ug.status === 'beaten' || m.ug.status === 'completed');
const count = (n: number, target: number): [number, number] => [Math.min(n, target), target];
const platinums = (c: TrophyCtx) =>
  c.mine.filter((m) => m.ug.achievementsTotal && (m.ug.achievements?.length ?? 0) >= m.ug.achievementsTotal).length;
// Horas jugadas: las que apuntas tú o, si terminaste el juego sin apuntarlas, lo que dura.
export function playedHours(mine: MyGame[], mode: DurationMode): number {
  let total = 0;
  for (const m of mine) {
    const done = m.ug.status === 'beaten' || m.ug.status === 'completed';
    total += m.ug.hoursPlayed ?? (done ? gameHours(m.game, mode) : 0);
  }
  return total;
}
const hours = (c: TrophyCtx) => playedHours(c.mine, c.mode);

const T = (t: Trophy) => t;

export const TROPHIES: Trophy[] = [
  // Biblioteca
  T({
    id: 'lib1',
    group: 'Biblioteca',
    name: 'Primer paso',
    description: 'Añade tu primer juego',
    tier: 'bronze',
    icon: 'add-circle',
    progress: (c) => count(c.mine.length, 1),
  }),
  T({
    id: 'lib50',
    group: 'Biblioteca',
    name: 'Coleccionista',
    description: 'Ten 50 juegos en tu biblioteca',
    tier: 'silver',
    icon: 'library',
    progress: (c) => count(c.mine.length, 50),
  }),
  T({
    id: 'lib200',
    group: 'Biblioteca',
    name: 'Archivo viviente',
    description: 'Ten 200 juegos en tu biblioteca',
    tier: 'gold',
    icon: 'albums',
    progress: (c) => count(c.mine.length, 200),
  }),
  T({
    id: 'phys10',
    group: 'Biblioteca',
    name: 'Estantería física',
    description: 'Marca 10 juegos en físico',
    tier: 'silver',
    icon: 'disc',
    progress: (c) => count(c.mine.filter((m) => m.ug.owned).length, 10),
  }),
  T({
    id: 'plat5',
    group: 'Biblioteca',
    name: 'Multiplataforma',
    description: 'Juega en 5 plataformas distintas',
    tier: 'silver',
    icon: 'game-controller',
    progress: (c) => count(new Set(c.mine.map((m) => m.ug.platform).filter(Boolean)).size, 5),
  }),
  T({
    id: 'decades',
    group: 'Biblioteca',
    name: 'Viajero del tiempo',
    description: 'Termina juegos de 4 décadas distintas',
    tier: 'gold',
    icon: 'hourglass',
    progress: (c) =>
      count(
        new Set(
          finished(c)
            .map((m) => (m.game.year ? Math.floor(m.game.year / 10) : null))
            .filter((d) => d != null),
        ).size,
        4,
      ),
  }),
  T({
    id: 'retro',
    group: 'Biblioteca',
    name: 'Arqueólogo',
    description: 'Termina un juego anterior a 1995',
    tier: 'silver',
    icon: 'skull',
    progress: (c) => count(finished(c).filter((m) => (m.game.year ?? 3000) < 1995).length, 1),
  }),
  // Terminar
  T({
    id: 'fin1',
    group: 'Partidas',
    name: 'Créditos finales',
    description: 'Termina tu primer juego',
    tier: 'bronze',
    icon: 'flag',
    progress: (c) => count(finished(c).length, 1),
  }),
  T({
    id: 'fin10',
    group: 'Partidas',
    name: 'Rematador',
    description: 'Termina 10 juegos',
    tier: 'bronze',
    icon: 'flag',
    progress: (c) => count(finished(c).length, 10),
  }),
  T({
    id: 'fin50',
    group: 'Partidas',
    name: 'Imparable',
    description: 'Termina 50 juegos',
    tier: 'silver',
    icon: 'flame',
    progress: (c) => count(finished(c).length, 50),
  }),
  T({
    id: 'fin100',
    group: 'Partidas',
    name: 'Leyenda viva',
    description: 'Termina 100 juegos',
    tier: 'gold',
    icon: 'trophy',
    progress: (c) => count(finished(c).length, 100),
  }),
  T({
    id: 'long',
    group: 'Partidas',
    name: 'Maratón épico',
    description: 'Termina un juego de más de 60 horas',
    tier: 'silver',
    icon: 'trail-sign',
    progress: (c) => count(finished(c).filter((m) => gameHours(m.game, c.mode) > 60).length, 1),
  }),
  T({
    id: 'h100',
    group: 'Partidas',
    name: 'Cien horas',
    description: 'Acumula 100 horas jugadas',
    tier: 'bronze',
    icon: 'time',
    progress: (c) => count(Math.floor(hours(c)), 100),
  }),
  T({
    id: 'h1000',
    group: 'Partidas',
    name: 'Mil horas',
    description: 'Acumula 1.000 horas jugadas',
    tier: 'gold',
    icon: 'time',
    progress: (c) => count(Math.floor(hours(c)), 1000),
  }),
  T({
    id: 'drop',
    group: 'Partidas',
    name: 'Sin remordimientos',
    description: 'Abandona un juego que no te llena',
    tier: 'bronze',
    icon: 'close-circle',
    progress: (c) => count(c.mine.filter((m) => m.ug.status === 'dropped').length, 1),
  }),
  // Logros
  T({
    id: 'ach10',
    group: 'Logros',
    name: 'Cazalogros',
    description: 'Marca 10 logros',
    tier: 'bronze',
    icon: 'ribbon',
    progress: (c) =>
      count(
        c.mine.reduce((a, m) => a + (m.ug.achievements?.length ?? 0), 0),
        10,
      ),
  }),
  T({
    id: 'ach500',
    group: 'Logros',
    name: 'Vitrina llena',
    description: 'Marca 500 logros',
    tier: 'gold',
    icon: 'ribbon',
    progress: (c) =>
      count(
        c.mine.reduce((a, m) => a + (m.ug.achievements?.length ?? 0), 0),
        500,
      ),
  }),
  T({
    id: 'plat1',
    group: 'Logros',
    name: 'Primer platino',
    description: 'Consigue un Platino Saga Quest',
    tier: 'silver',
    icon: 'diamond',
    progress: (c) => count(platinums(c), 1),
  }),
  T({
    id: 'plat10',
    group: 'Logros',
    name: 'Platinero',
    description: 'Consigue 10 Platinos Saga Quest',
    tier: 'gold',
    icon: 'diamond',
    progress: (c) => count(platinums(c), 10),
  }),
  T({
    id: 'full5',
    group: 'Logros',
    name: 'Al cien por cien',
    description: 'Completa 5 juegos al 100 %',
    tier: 'silver',
    icon: 'checkmark-done-circle',
    progress: (c) => count(c.mine.filter((m) => m.ug.status === 'completed').length, 5),
  }),
  // Opinión
  T({
    id: 'rate10',
    group: 'Opinión',
    name: 'Crítico',
    description: 'Pon nota a 10 juegos',
    tier: 'bronze',
    icon: 'star-half',
    progress: (c) => count(c.mine.filter((m) => m.ug.rating != null).length, 10),
  }),
  T({
    id: 'perfect',
    group: 'Opinión',
    name: 'Obra maestra',
    description: 'Pon un 10 a un juego',
    tier: 'bronze',
    icon: 'star',
    progress: (c) => count(c.mine.filter((m) => m.ug.rating === 10).length, 1),
  }),
  T({
    id: 'review5',
    group: 'Opinión',
    name: 'Pluma afilada',
    description: 'Escribe 5 reseñas',
    tier: 'silver',
    icon: 'create',
    progress: (c) => count(c.mine.filter((m) => (m.ug.review ?? '').trim().length > 20).length, 5),
  }),
  // Listas
  T({
    id: 'list1',
    group: 'Listas',
    name: 'Organizado',
    description: 'Crea tu primera lista',
    tier: 'bronze',
    icon: 'list',
    progress: (c) => count(c.lists.length, 1),
  }),
  T({
    id: 'public3',
    group: 'Listas',
    name: 'Curador',
    description: 'Publica 3 listas',
    tier: 'silver',
    icon: 'globe',
    progress: (c) => count(c.lists.filter((l) => l.visibility === 'public').length, 3),
  }),
  T({
    id: 'follow',
    group: 'Listas',
    name: 'Seguidor',
    description: 'Añade 3 listas de otros a tu perfil',
    tier: 'bronze',
    icon: 'bookmark',
    progress: (c) => count(c.follows, 3),
  }),
  T({
    id: 'saga',
    group: 'Listas',
    name: 'Saga completa',
    description: 'Termina todos los juegos de una saga oficial',
    tier: 'gold',
    icon: 'medal',
    progress: (c) => count(c.officialDone, 1),
  }),
  // Social
  T({
    id: 'friend1',
    group: 'Social',
    name: 'Compañero de equipo',
    description: 'Haz tu primer amigo',
    tier: 'bronze',
    icon: 'people',
    progress: (c) => count(c.friends, 1),
  }),
  T({
    id: 'friend10',
    group: 'Social',
    name: 'Clan',
    description: 'Ten 10 amigos',
    tier: 'silver',
    icon: 'people-circle',
    progress: (c) => count(c.friends, 10),
  }),
  // Sala de juegos
  T({
    id: 'tier',
    group: 'Sala de juegos',
    name: 'Ranker',
    description: 'Haz una tier list',
    tier: 'bronze',
    icon: 'podium',
    progress: (c) => count(c.profile?.tierlists?.length ?? 0, 1),
  }),
  T({
    id: 'duel50',
    group: 'Sala de juegos',
    name: 'Duelista',
    description: 'Juega 50 duelos',
    tier: 'silver',
    icon: 'flash',
    progress: (c) => count(c.profile?.duels ?? 0, 50),
  }),
  T({
    id: 'hilo10',
    group: 'Sala de juegos',
    name: 'Adivino',
    description: 'Haz una racha de 10 en ¿Más o menos?',
    tier: 'silver',
    icon: 'trending-up',
    progress: (c) => count(Math.max(c.profile?.hilo?.rating ?? 0, c.profile?.hilo?.hours ?? 0), 10),
  }),
  T({
    id: 'event1',
    group: 'Sala de juegos',
    name: 'De temporada',
    description: 'Completa un evento de temporada',
    tier: 'silver',
    icon: 'calendar',
    progress: (c) => count(Object.keys(c.profile?.events ?? {}).length, 1),
  }),
  // Cromos
  T({
    id: 'card10',
    group: 'Cromos',
    name: 'Álbum en marcha',
    description: 'Consigue 10 cromos',
    tier: 'bronze',
    icon: 'albums',
    progress: (c) => count(c.cards.total, 10),
  }),
  T({
    id: 'card50u',
    group: 'Cromos',
    name: 'Coleccionista de cromos',
    description: 'Ten 50 cromos distintos',
    tier: 'gold',
    icon: 'albums',
    progress: (c) => count(c.cards.unique, 50),
  }),
  T({
    id: 'legend',
    group: 'Cromos',
    name: 'Leyenda en mano',
    description: 'Consigue un cromo legendario',
    tier: 'silver',
    icon: 'sparkles',
    progress: (c) => count(c.cards.legendary, 1),
  }),
  T({
    id: 'foil',
    group: 'Cromos',
    name: 'Que brille',
    description: 'Consigue un cromo brillante',
    tier: 'silver',
    icon: 'star',
    progress: (c) => count(c.cards.foil, 1),
  }),
  T({
    id: 'trade',
    group: 'Cromos',
    name: 'Trato hecho',
    description: 'Intercambia un cromo',
    tier: 'bronze',
    icon: 'swap-horizontal',
    progress: (c) => count(c.cards.trades, 1),
  }),
  // Ciudad
  T({
    id: 'city5',
    group: 'Tu mundo',
    name: 'Urbanista',
    description: 'Coloca 5 decoraciones en tu mundo',
    tier: 'bronze',
    icon: 'business',
    progress: (c) => count(c.profile?.city?.items.length ?? 0, 5),
  }),
  T({
    id: 'cityup',
    group: 'Tu mundo',
    name: 'Rascacielos',
    description: 'Mejora un edificio al nivel máximo',
    tier: 'silver',
    icon: 'trending-up',
    progress: (c) => count(Object.values(c.profile?.city?.upgrades ?? {}).filter((l) => l >= 3).length, 1),
  }),
];

// El trofeo final: todos los demás.
export const PLATINUM_TROPHY: Trophy = {
  id: 'all',
  group: 'Platino',
  name: 'Saga Quest al 100 %',
  description: 'Consigue todos los trofeos',
  tier: 'platinum',
  icon: 'diamond',
  progress: () => [0, 1],
};

export function earnedTrophies(ctx: TrophyCtx): Set<string> {
  const out = new Set<string>();
  for (const t of TROPHIES) {
    const [cur, target] = t.progress(ctx);
    if (cur >= target) out.add(t.id);
  }
  if (out.size === TROPHIES.length) out.add(PLATINUM_TROPHY.id);
  return out;
}
