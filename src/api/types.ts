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
  timeToBeat: { main: number | null; extra: number | null; full: number | null } | null;
  url: string | null;
};
