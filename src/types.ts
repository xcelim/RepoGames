// ---------- Ajustes ----------
export type DurationMode = 'main' | 'extra' | 'full';
export type SkinId =
  | 'neon'
  | 'cozy'
  | 'gameboy'
  | 'teyvat'
  | 'synthwave'
  | 'hud'
  | 'pastel'
  // Inspiradas en videojuegos
  | 'hyrule'
  | 'sheikah'
  | 'dreamland'
  | 'mushroom'
  | 'metaverse'
  | 'velvet'
  | 'fodlan'
  | 'crystal'
  | 'midgar'
  | 'alrest'
  | 'zebes'
  | 'hallownest'
  | 'summit'
  | 'pelican'
  | 'island'
  | 'blocks'
  | 'kanto'
  | 'inkopolis'
  | 'greenhill'
  | 'ring'
  | 'inferno'
  | 'lordran'
  | 'underground'
  | 'falling'
  | 'maze';

// ---------- Catálogo (datos de partida) ----------
export type Game = {
  title: string;
  version: string;
  platform: string;
  year: number;
  main: number;
  extra: number;
  full: number;
  synopsis: string;
  note: string;
  igdbQuery?: string;
};

export type Saga = {
  id: string;
  name: string;
  color: string;
  color2: string;
  tag: string;
  blurb: string;
  games: Game[];
};

// ---------- Modelo de la app (mismas columnas que las tablas de Supabase) ----------

// Un juego: del catálogo, de IGDB o creado a mano.
export type GameRecord = {
  id: string;
  title: string;
  year: number | null;
  platforms: string; // plataformas en las que salió (texto libre)
  version: string | null; // versión recomendada
  series: string | null; // id de la saga, si pertenece a una
  main: number | null;
  extra: number | null;
  full: number | null;
  synopsis: string | null;
  note: string | null;
  igdbId: number | null;
  rawgId: number | null;
  igdbQuery: string | null;
  coverUrl: string | null;
  developer?: string | null;
  releaseDate?: string | null; // AAAA-MM-DD
  criticRating?: number | null; // 0-100
  source: 'catalog' | 'igdb' | 'rawg' | 'custom';
  createdBy: string | null; // perfil que lo creó (null = catálogo)
};

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  createdAt: string;
  onboarded?: boolean; // ya ha creado su usuario (nombre, @usuario, color)
};

// Estado del juego en tu biblioteca personal (como IGN Playlist).
export type PlayStatus =
  | 'library' // en "Mis juegos", sin estado concreto
  | 'wishlist'
  | 'backlog'
  | 'playing'
  | 'paused'
  | 'beaten'
  | 'completed'
  | 'dropped';

// Lo que un usuario sabe de un juego: estado, nota, plataforma, reseña...
export type UserGame = {
  id: string;
  profileId: string;
  gameId: string;
  status: PlayStatus;
  rating: number | null; // 1-10
  platform: string | null; // plataforma en la que lo has jugado
  liked: string[];
  disliked: string[];
  review: string;
  hoursPlayed: number | null;
  startedAt: string | null; // AAAA-MM-DD
  finishedAt: string | null;
  owned: boolean;
  favorite: boolean;
  recommend?: boolean | null;
  spoilers?: boolean;
  reviewPrivate?: boolean;
  addedAt: string;
  updatedAt: string;
};

export type Visibility = 'public' | 'private';

// Una lista (biblioteca / carpeta): ordenada a mano, pública o privada.
export type GameList = {
  id: string;
  ownerId: string; // 'saga-quest' para las oficiales
  name: string;
  description: string;
  visibility: Visibility;
  color: string;
  color2: string;
  icon: string; // nombre de Ionicons
  forkedFrom: string | null;
  official: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListItem = {
  id: string;
  listId: string;
  gameId: string;
  position: number;
  addedAt: string;
};

export type ListSort =
  | 'manual'
  | 'updated-new'
  | 'updated-old'
  | 'az'
  | 'za'
  | 'critic-high'
  | 'critic-low'
  | 'release-new'
  | 'release-old'
  | 'hltb-long'
  | 'hltb-short'
  | 'mine-high'
  | 'mine-low'
  | 'status';
