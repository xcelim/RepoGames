// Tipos comunes a las bases de datos de juegos online (IGDB y RAWG).

export type OnlineSource = 'igdb' | 'rawg';

// Un resultado de búsqueda.
export type OnlineResult = {
  source: OnlineSource;
  sourceId: number;
  title: string;
  year: number | null;
  platforms: string;
  coverUrl: string | null;
  summary: string | null;
  rating: number | null; // 0-100
  main: number | null; // horas
  extra: number | null;
  full: number | null;
  developer?: string | null;
  releaseDate?: string | null; // AAAA-MM-DD
  popularity?: number; // nº de valoraciones (para ordenar)
};

// La ficha completa de un juego.
export type GameDetails = {
  source: OnlineSource;
  sourceId: number;
  name: string;
  coverUrl: string | null; // vertical
  heroUrl: string | null; // horizontal, para la cabecera
  screenshots: string[];
  videoIds: string[]; // YouTube
  summary: string | null;
  storyline: string | null;
  releaseDate: string | null; // AAAA-MM-DD
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
  franchise: string | null;
  rating: number | null; // 0-100
  ratingCount: number | null;
  ratingLabel: string; // "IGDB", "Metacritic"...
  criticRating?: number | null; // 0-100, media de la prensa
  criticCount?: number | null;
  userRating?: number | null; // 0-100, media de los jugadores
  userCount?: number | null;
  themes?: string[];
  modes?: string[];
  ageRating?: string | null;
  timeToBeat: { main: number | null; extra: number | null; full: number | null } | null;
  url: string | null;
};
