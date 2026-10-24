// Conversión entre los tipos de la app (camelCase) y las filas de Supabase (snake_case).
import type {
  CompetitiveRank,
  GameList,
  GameRecord,
  ListItem,
  PlayStatus,
  Profile,
  Showcase,
  UserGame,
  Visibility,
  TierList,
} from '@/types';

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_color: string;
  settings?: {
    skin?: string;
    durationMode?: string;
    onboarded?: boolean;
    showcases?: Showcase[];
    ranks?: CompetitiveRank[];
    photo?: string | null;
    frame?: number | null;
    level?: number;
    xp?: number;
    steamId?: string | null;
    tierlists?: TierList[];
    elo?: Record<string, number>;
    duels?: number;
  } | null;
  created_at: string;
  updated_at?: string;
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
  rawg_id: number | null;
  igdb_query: string | null;
  cover_url: string | null;
  developer?: string | null;
  release_date?: string | null;
  critic_rating?: number | null;
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
  note?: string;
  replays?: number;
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
  recommend?: boolean | null;
  spoilers?: boolean;
  review_private?: boolean;
  replays_extra?: number;
  achievements?: string[];
  added_at: string;
  updated_at: string;
};

export const toProfileRow = (p: Profile, id = p.id, settings?: ProfileRow['settings']): ProfileRow => ({
  id,
  // Solo letras minúsculas, números y guiones (lo exige la base de datos).
  username: (p.username.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'jugador').slice(0, 30),
  display_name: p.displayName || p.username,
  bio: p.bio,
  avatar_color: p.avatarColor,
  ...(settings
    ? {
        settings: {
          ...settings,
          onboarded: !!p.onboarded,
          ...(p.showcases ? { showcases: p.showcases } : {}),
          ...(p.ranks ? { ranks: p.ranks } : {}),
          ...(p.photo !== undefined ? { photo: p.photo } : {}),
          ...(p.frame !== undefined ? { frame: p.frame } : {}),
          ...(p.level !== undefined ? { level: p.level, xp: p.xp } : {}),
          ...(p.steamId !== undefined ? { steamId: p.steamId } : {}),
          ...(p.tierlists ? { tierlists: p.tierlists } : {}),
          ...(p.elo ? { elo: p.elo, duels: p.duels ?? 0 } : {}),
        },
      }
    : {}),
  created_at: p.createdAt,
  updated_at: new Date().toISOString(),
});

export const fromProfileRow = (r: ProfileRow): Profile => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  bio: r.bio ?? '',
  avatarColor: r.avatar_color ?? '#7b2ff7',
  createdAt: r.created_at,
  onboarded: !!r.settings?.onboarded,
  ...(Array.isArray(r.settings?.showcases) ? { showcases: r.settings.showcases } : {}),
  ...(Array.isArray(r.settings?.ranks) ? { ranks: r.settings.ranks } : {}),
  ...(r.settings?.photo !== undefined ? { photo: r.settings.photo } : {}),
  ...(r.settings?.frame !== undefined ? { frame: r.settings.frame } : {}),
  ...(typeof r.settings?.level === 'number' ? { level: r.settings.level, xp: r.settings.xp } : {}),
  ...(r.settings?.steamId !== undefined ? { steamId: r.settings.steamId } : {}),
  ...(Array.isArray(r.settings?.tierlists) ? { tierlists: r.settings.tierlists } : {}),
  ...(r.settings?.elo && typeof r.settings.elo === 'object'
    ? { elo: r.settings.elo, duels: r.settings.duels ?? 0 }
    : {}),
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
  rawg_id: g.rawgId,
  igdb_query: g.igdbQuery,
  cover_url: g.coverUrl,
  developer: g.developer ?? null,
  release_date: g.releaseDate ?? null,
  critic_rating: g.criticRating ?? null,
  source: g.source,
  // Los juegos de la API son comunes (sin dueño); los creados a mano son de quien los crea.
  created_by: g.source === 'igdb' || g.source === 'rawg' ? null : createdBy,
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
  rawgId: r.rawg_id ?? null,
  igdbQuery: r.igdb_query,
  coverUrl: r.cover_url,
  developer: r.developer ?? null,
  releaseDate: r.release_date ?? null,
  criticRating: r.critic_rating ?? null,
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
  // Solo se envían si se usan, así la sincronización no falla si aún no has añadido las columnas.
  ...(i.note !== undefined ? { note: i.note } : {}),
  ...(i.replays !== undefined ? { replays: i.replays } : {}),
});

export const fromItemRow = (r: ListItemRow): ListItem => ({
  id: r.id,
  listId: r.list_id,
  gameId: r.game_id,
  position: r.position,
  addedAt: r.added_at,
  ...(r.note ? { note: r.note } : {}),
  ...(r.replays ? { replays: r.replays } : {}),
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
  recommend: u.recommend ?? null,
  spoilers: u.spoilers ?? false,
  review_private: u.reviewPrivate ?? false,
  ...(u.replaysExtra !== undefined ? { replays_extra: u.replaysExtra } : {}),
  ...(u.achievements !== undefined ? { achievements: u.achievements } : {}),
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
  recommend: r.recommend ?? null,
  spoilers: r.spoilers ?? false,
  reviewPrivate: r.review_private ?? false,
  ...(r.replays_extra ? { replaysExtra: r.replays_extra } : {}),
  ...(r.achievements?.length ? { achievements: r.achievements } : {}),
  addedAt: r.added_at,
  updatedAt: r.updated_at,
});
