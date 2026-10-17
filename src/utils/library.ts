import { OFFICIAL_LISTS } from '@/data/catalog';
import { FINISHED, STATUS_ORDER } from '@/data/meta';
import type {
  DurationMode,
  GameList,
  GameRecord,
  ListItem,
  ListSort,
  PlayStatus,
  UserGame,
} from '@/types';

export function userGameKey(profileId: string, gameId: string): string {
  return `${profileId}:${gameId}`;
}

export function findGame(
  customGames: Record<string, GameRecord>,
  gameId: string,
): GameRecord | undefined {
  return customGames[gameId];
}

export function allLists(userLists: Record<string, GameList>): GameList[] {
  return [...OFFICIAL_LISTS, ...Object.values(userLists)];
}

export function findList(
  userLists: Record<string, GameList>,
  listId: string,
): GameList | undefined {
  return userLists[listId] ?? OFFICIAL_LISTS.find((list) => list.id === listId);
}

export function itemsOfList(items: Record<string, ListItem>, listId: string): ListItem[] {
  return Object.values(items).filter((item) => item.listId === listId).sort((a, b) => a.position - b.position);
}

// Una fila lista para pintar: el juego, su posición y lo que el usuario sabe de él.
export type Entry = {
  item: ListItem;
  game: GameRecord;
  rank: number; // posición manual (1, 2, 3...)
  userGame: UserGame | undefined;
};

export function buildEntries(
  items: ListItem[],
  customGames: Record<string, GameRecord>,
  userGames: Record<string, UserGame>,
  profileId: string | null,
): Entry[] {
  const entries: Entry[] = [];
  items.forEach((item, index) => {
    const game = findGame(customGames, item.gameId);
    if (!game) return;
    entries.push({
      item,
      game,
      rank: index + 1,
      userGame: profileId ? userGames[userGameKey(profileId, game.id)] : undefined,
    });
  });
  return entries;
}

export function gameHours(game: GameRecord, mode: DurationMode): number {
  return game[mode] ?? 0;
}

const STATUS_RANK: Record<PlayStatus, number> = Object.fromEntries(
  STATUS_ORDER.map((status, index) => [status, index]),
) as Record<PlayStatus, number>;

export function sortEntries(
  entries: Entry[],
  sort: ListSort,
  mode: DurationMode,
  descending = false,
): Entry[] {
  const list = [...entries];
  const byTitle = (a: Entry, b: Entry) => a.game.title.localeCompare(b.game.title, 'es');
  const compare: Record<ListSort, (a: Entry, b: Entry) => number> = {
    manual: (a, b) => a.rank - b.rank,
    release: (a, b) => (a.game.year ?? 9999) - (b.game.year ?? 9999) || a.rank - b.rank,
    // Sin nota, al final.
    rating: (a, b) => (b.userGame?.rating ?? -1) - (a.userGame?.rating ?? -1) || a.rank - b.rank,
    title: byTitle,
    duration: (a, b) => gameHours(a.game, mode) - gameHours(b.game, mode) || a.rank - b.rank,
    status: (a, b) =>
      (a.userGame ? STATUS_RANK[a.userGame.status] : 99) -
        (b.userGame ? STATUS_RANK[b.userGame.status] : 99) || a.rank - b.rank,
    added: (a, b) => b.item.addedAt.localeCompare(a.item.addedAt) || a.rank - b.rank,
  };
  list.sort(compare[sort]);
  return descending ? list.reverse() : list;
}

export type EntryFilter = {
  statuses: PlayStatus[]; // vacío = todos
  includeUntracked: boolean; // juegos sin estado
  platform: string | null;
  query: string;
};

export const EMPTY_FILTER: EntryFilter = {
  statuses: [],
  includeUntracked: true,
  platform: null,
  query: '',
};

export function filterEntries(entries: Entry[], filter: EntryFilter): Entry[] {
  const query = filter.query.trim().toLowerCase();
  return entries.filter((entry) => {
    const status = entry.userGame?.status;
    if (filter.statuses.length > 0) {
      if (status ? !filter.statuses.includes(status) : !filter.includeUntracked) return false;
    }
    if (filter.platform && entry.userGame?.platform !== filter.platform) return false;
    if (query && !entry.game.title.toLowerCase().includes(query)) return false;
    return true;
  });
}

export type Stats = {
  games: number;
  finished: number;
  playing: number;
  rated: number;
  averageRating: number | null;
  totalHours: number; // duración estimada de toda la lista
  hoursLeft: number; // de los no terminados
  hoursPlayed: number; // las que has apuntado
};

export function entryStats(entries: Entry[], mode: DurationMode): Stats {
  let finished = 0;
  let playing = 0;
  let ratingSum = 0;
  let rated = 0;
  let totalHours = 0;
  let hoursLeft = 0;
  let hoursPlayed = 0;
  for (const { game, userGame } of entries) {
    const hours = gameHours(game, mode);
    totalHours += hours;
    const done = userGame ? FINISHED.includes(userGame.status) : false;
    if (done) finished += 1;
    else if (userGame?.status !== 'dropped') hoursLeft += hours;
    if (userGame?.status === 'playing') playing += 1;
    if (userGame?.rating != null) {
      ratingSum += userGame.rating;
      rated += 1;
    }
    hoursPlayed += userGame?.hoursPlayed ?? 0;
  }
  return {
    games: entries.length,
    finished,
    playing,
    rated,
    averageRating: rated > 0 ? Math.round((ratingSum / rated) * 10) / 10 : null,
    totalHours,
    hoursLeft,
    hoursPlayed,
  };
}

// Devuelve las posiciones nuevas tras mover un elemento de "from" a "to".
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const result = [...list];
  const clamped = Math.max(0, Math.min(result.length - 1, to));
  const [moved] = result.splice(from, 1);
  result.splice(clamped, 0, moved);
  return result;
}

export function formatHours(hours: number): string {
  if (hours >= 1000) return `${(hours / 1000).toFixed(1).replace('.', ',')} mil h`;
  return `${Math.round(hours)} h`;
}
