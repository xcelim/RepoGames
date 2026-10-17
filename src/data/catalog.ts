import type { GameList, GameRecord, ListItem, Profile, Saga } from '@/types';

import { NINTENDO_SAGAS } from './sagas-nintendo';
import { SAGAS as BASE_SAGAS } from './sagas';

const ORDER = ['persona', 'fe', 'ff', 'zelda', 'kirby', 'mario', 'xeno', 'metroid'];

export const SAGAS: Saga[] = [...BASE_SAGAS, ...NINTENDO_SAGAS].sort(
  (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id),
);

// Quita tildes ("Pokémon" -> "Pokemon") aunque el motor no soporte normalize.
export function stripAccents(text: string): string {
  try {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    return text;
  }
}

export function slugify(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function catalogGameId(sagaId: string, title: string): string {
  return `${sagaId}-${slugify(title)}`;
}

export const CATALOG_GAMES: Record<string, GameRecord> = {};
for (const saga of SAGAS) {
  for (const game of saga.games) {
    const id = catalogGameId(saga.id, game.title);
    CATALOG_GAMES[id] = {
      id,
      title: game.title,
      year: game.year,
      platforms: game.platform,
      version: game.version,
      series: saga.id,
      main: game.main,
      extra: game.extra,
      full: game.full,
      synopsis: game.synopsis,
      note: game.note,
      igdbId: null,
      igdbQuery: game.igdbQuery ?? null,
      coverUrl: null,
      source: 'catalog',
      createdBy: null,
    };
  }
}

export const OFFICIAL_PROFILE_ID = 'saga-quest';

export const OFFICIAL_PROFILE: Profile = {
  id: OFFICIAL_PROFILE_ID,
  username: 'sagaquest',
  displayName: 'Saga Quest',
  bio: 'Las sagas completas, en orden y en su mejor versión.',
  avatarColor: '#ff2a4d',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SAGA_ICONS: Record<string, string> = {
  persona: 'flame',
  fe: 'shield',
  ff: 'diamond',
  zelda: 'triangle',
  kirby: 'star',
  mario: 'flash',
  xeno: 'planet',
  metroid: 'rocket',
};

export const OFFICIAL_LISTS: GameList[] = SAGAS.map((saga) => ({
  id: `official-${saga.id}`,
  ownerId: OFFICIAL_PROFILE_ID,
  name: saga.name,
  description: `${saga.tag}. ${saga.blurb}`,
  visibility: 'public',
  color: saga.color,
  color2: saga.color2,
  icon: SAGA_ICONS[saga.id] ?? 'albums',
  forkedFrom: null,
  official: true,
  createdAt: OFFICIAL_PROFILE.createdAt,
  updatedAt: OFFICIAL_PROFILE.createdAt,
}));

export const OFFICIAL_ITEMS: ListItem[] = SAGAS.flatMap((saga) =>
  saga.games.map((game, position) => ({
    id: `official-${saga.id}-${position}`,
    listId: `official-${saga.id}`,
    gameId: catalogGameId(saga.id, game.title),
    position,
    addedAt: OFFICIAL_PROFILE.createdAt,
  })),
);
