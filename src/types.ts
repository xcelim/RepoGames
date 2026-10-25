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
  showcases?: Showcase[]; // vitrinas del perfil (se desbloquean con el nivel)
  ranks?: CompetitiveRank[]; // insignias de rango en juegos competitivos
  photo?: string | null; // foto de perfil (imagen pequeña en base64)
  steamId?: string | null; // tu cuenta de Steam (para volver a importar)
  level?: number; // nivel (lo calcula su app y lo publica para que lo vean los demás)
  xp?: number;
  frame?: number | null; // marco elegido (índice de FRAMES; null = sin marco; sin definir = el mejor)
  tierlists?: TierList[]; // tier lists que has hecho (S, A, B...)
  elo?: Record<string, number>; // puntuación de cada juego en los duelos «¿cuál prefieres?»
  duels?: number; // duelos jugados
  hilo?: { rating?: number; hours?: number }; // récords de «¿Más o menos?»
  trophies?: Record<string, string>; // trofeos Saga Quest conseguidos (id → fecha)
  city?: CityState; // tu mundo gamer (lo que has comprado con tus horas)
  events?: Record<string, string>; // eventos de temporada completados (id → fecha)
};

export type CityItem = { id: string; kind: string; x: number; y: number };
export type CityState = {
  spent: number; // monedas gastadas
  size: number; // lado del terreno (en casillas)
  items: CityItem[]; // decoración colocada
  upgrades: Record<string, number>; // nivel de cada edificio (juego → 1..3)
  sky?: string; // cielo elegido
  skies?: string[]; // cielos comprados
};

export type TierList = {
  id: string;
  title: string;
  tiers: { label: string; color: string; gameIds: string[] }[];
  pool?: string[]; // añadidos pero aún sin colocar
  updatedAt: string;
};

// Tu rango en un competitivo: juego (de la lista o escrito a mano), rango y división.
export type CompetitiveRank = { game: string; tier: string; division?: string };

export type ShowcaseType = 'favorites' | 'completionist' | 'rare' | 'recent' | 'replays' | 'stats';
export type Showcase = { type: ShowcaseType; gameIds?: string[] };

// Estado del juego en tu biblioteca personal (como IGN Playlist).
export type PlayStatus =
  | 'library' // en "Mis juegos", sin estado concreto
  | 'wishlist'
  | 'backlog'
  | 'playing'
  | 'paused'
  | 'beaten'
  | 'completed'
  | 'watched' // visto (en vídeo o en directo), sin jugarlo
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
  replaysExtra?: number; // rejugadas que no están en ninguna lista (se suman al total)
  achievements?: string[]; // logros marcados (ids de RAWG)
  achievementsTotal?: number; // cuántos logros tiene el juego (para el platino y el nivel)
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
  members?: string[]; // lista cooperativa: amigos que también pueden editarla
};

export type ListItem = {
  id: string;
  listId: string;
  gameId: string;
  position: number;
  addedAt: string;
  note?: string; // nota tuya sobre el juego dentro de esta lista
  replays?: number; // veces que lo rejugaste "en esta lista" (p. ej. ese año)
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
