// Conversión entre los tipos de la app (camelCase) y las filas de Supabase (snake_case).
import type { GameList, GameRecord, ListItem, PlayStatus, Profile, UserGame, Visibility } from '@/types';

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_color: string;
  created_at: string;
};

export type GameRow = {
  id: string;
  title: string;
  year: number | null;
  platforms: string;
  version: string | null;
  series: string | null;
  main: number | null;
  extra: number | null;
  full: number | null;
  synopsis: string | null;
  note: string | null;
  igdb_id: number | null;
  igdb_query: string | null;
  cover_url: string | null;
  source: GameRecord['source'];
  created_by: string | null;
};

export type ListRow = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  visibility: Visibility;
  color: string;
  color2: string;
  icon: string;
  forked_from: string | null;
  official: boolean;
  created_at: string;
  updated_at: string;
};

export type ListItemRow = {
  id: string;
  list_id: string;
  game_id: string;
  position: number;
  added_at: string;
};

export type UserGameRow = {
  profile_id: string;
  game_id: string;
  status: PlayStatus;
  rating: number | null;
  platform: string | null;
  liked: string[];
  disliked: string[];
  review: string;
  hours_played: number | null;
  started_at: string | null;
  finished_at: string | null;
  owned: boolean;
  favorite: boolean;
  added_at: string;
  updated_at: string;
};

export const toProfileRow = (p: Profile, id = p.id): ProfileRow => ({
  id,
  username: p.username,
  display_name: p.displayName,
  bio: p.bio,
  avatar_color: p.avatarColor,
  created_at: p.createdAt,
});

export const fromProfileRow = (r: ProfileRow): Profile => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  bio: r.bio ?? '',
  avatarColor: r.avatar_color ?? '#7b2ff7',
  createdAt: r.created_at,
});

export const toGameRow = (g: GameRecord, createdBy: string | null): GameRow => ({
  id: g.id,
  title: g.title,
  year: g.year,
  platforms: g.platforms,
  version: g.version,
  series: g.series,
  main: g.main,
  extra: g.extra,
  full: g.full,
  synopsis: g.synopsis,
  note: g.note,
  igdb_id: g.igdbId,
  igdb_query: g.igdbQuery,
  cover_url: g.coverUrl,
  source: g.source,
  created_by: createdBy,
});

export const fromGameRow = (r: GameRow): GameRecord => ({
  id: r.id,
  title: r.title,
  year: r.year,
  platforms: r.platforms ?? '',
  version: r.version,
  series: r.series,
  main: r.main,
  extra: r.extra,
  full: r.full,
  synopsis: r.synopsis,
  note: r.note,
  igdbId: r.igdb_id,
  igdbQuery: r.igdb_query,
  coverUrl: r.cover_url,
  source: r.source,
  createdBy: r.created_by,
});

export const toListRow = (l: GameList, ownerId: string): ListRow => ({
  id: l.id,
  owner_id: ownerId,
  name: l.name,
  description: l.description,
  visibility: l.visibility,
  color: l.color,
  color2: l.color2,
  icon: l.icon,
  forked_from: l.forkedFrom,
  official: false,
  created_at: l.createdAt,
  updated_at: l.updatedAt,
});

export const fromListRow = (r: ListRow, ownerId = r.owner_id ?? 'saga-quest'): GameList => ({
  id: r.id,
  ownerId,
  name: r.name,
  description: r.description ?? '',
  visibility: r.visibility,
  color: r.color,
  color2: r.color2,
  icon: r.icon,
  forkedFrom: r.forked_from,
  official: r.official,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toItemRow = (i: ListItem): ListItemRow => ({
  id: i.id,
  list_id: i.listId,
  game_id: i.gameId,
  position: i.position,
  added_at: i.addedAt,
});

export const fromItemRow = (r: ListItemRow): ListItem => ({
  id: r.id,
  listId: r.list_id,
  gameId: r.game_id,
  position: r.position,
  addedAt: r.added_at,
});

export const toUserGameRow = (u: UserGame, profileId: string): UserGameRow => ({
  profile_id: profileId,
  game_id: u.gameId,
  status: u.status,
  rating: u.rating,
  platform: u.platform,
  liked: u.liked,
  disliked: u.disliked,
  review: u.review,
  hours_played: u.hoursPlayed,
  started_at: u.startedAt,
  finished_at: u.finishedAt,
  owned: u.owned,
  favorite: u.favorite,
  added_at: u.addedAt,
  updated_at: u.updatedAt,
});

export const fromUserGameRow = (r: UserGameRow, localProfileId: string): UserGame => ({
  id: `${localProfileId}:${r.game_id}`,
  profileId: localProfileId,
  gameId: r.game_id,
  status: r.status,
  rating: r.rating,
  platform: r.platform,
  liked: r.liked ?? [],
  disliked: r.disliked ?? [],
  review: r.review ?? '',
  hoursPlayed: r.hours_played,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  owned: r.owned,
  favorite: r.favorite,
  addedAt: r.added_at,
  updatedAt: r.updated_at,
});
