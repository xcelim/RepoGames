// Rangos de los competitivos más jugados, para las insignias del perfil.
// Las insignias las dibuja la app (no son los emblemas oficiales de cada juego).

export type Tier = { name: string; color: string; color2?: string };
export type RankedGame = { id: string; name: string; tiers: Tier[]; divisions?: string[]; short: string };

const T = (name: string, color: string, color2?: string): Tier => ({ name, color, color2 });

const IRON = '#6b6b73';
const BRONZE = '#b07444';
const SILVER = '#b8c2cc';
const GOLD = '#e8b923';
const PLAT = '#3fc7b5';
const EMERALD = '#2ecc71';
const DIAMOND = '#5aa9ff';
const MASTER = '#b467ff';
const GM = '#ff4d5a';
const CHALL = '#f7d36b';

export const RANKED_GAMES: RankedGame[] = [
  {
    id: 'lol',
    name: 'League of Legends',
    short: 'LoL',
    divisions: ['IV', 'III', 'II', 'I'],
    tiers: [
      T('Hierro', IRON),
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Esmeralda', EMERALD),
      T('Diamante', DIAMOND),
      T('Maestro', MASTER),
      T('Gran Maestro', GM),
      T('Aspirante', CHALL, '#5aa9ff'),
    ],
  },
  {
    id: 'valorant',
    name: 'Valorant',
    short: 'VAL',
    divisions: ['1', '2', '3'],
    tiers: [
      T('Hierro', IRON),
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Diamante', '#c387ff'),
      T('Ascendente', '#2fd18b'),
      T('Inmortal', '#e0465e'),
      T('Radiante', '#fff2a8', '#ffcf4d'),
    ],
  },
  {
    id: 'rocket',
    name: 'Rocket League',
    short: 'RL',
    divisions: ['I', 'II', 'III'],
    tiers: [
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', '#59d0ff'),
      T('Diamante', '#2f6fff'),
      T('Campeón', '#a64dff'),
      T('Gran Campeón', '#ff3b4f'),
      T('Leyenda Supersónica', '#ffffff', '#b467ff'),
    ],
  },
  {
    id: 'overwatch',
    name: 'Overwatch 2',
    short: 'OW2',
    divisions: ['5', '4', '3', '2', '1'],
    tiers: [
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', '#c9d6e3'),
      T('Diamante', DIAMOND),
      T('Maestro', '#ffb84d'),
      T('Gran Maestro', '#ffe28a'),
      T('Campeón', '#ff5fa2'),
      T('Top 500', '#ffffff', GOLD),
    ],
  },
  {
    id: 'cs2',
    name: 'Counter-Strike 2',
    short: 'CS2',
    tiers: [
      T('Plata I', SILVER),
      T('Plata Élite', SILVER),
      T('Nova', GOLD),
      T('Nova Maestro', GOLD),
      T('Ak Maestro', '#5aa9ff'),
      T('Águila Legendaria', '#7b8cff'),
      T('Supremo', '#b467ff'),
      T('Global Élite', '#ffd34d', '#ff4d5a'),
    ],
  },
  {
    id: 'apex',
    name: 'Apex Legends',
    short: 'APEX',
    divisions: ['IV', 'III', 'II', 'I'],
    tiers: [
      T('Novato', IRON),
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Diamante', DIAMOND),
      T('Maestro', MASTER),
      T('Depredador', '#ff3b3b'),
    ],
  },
  {
    id: 'fortnite',
    name: 'Fortnite (clasificatoria)',
    short: 'FN',
    divisions: ['I', 'II', 'III'],
    tiers: [
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Diamante', DIAMOND),
      T('Élite', '#c9d6e3'),
      T('Campeón', '#ff9f43'),
      T('Irreal', '#b467ff', '#ff5fa2'),
    ],
  },
  {
    id: 'r6',
    name: 'Rainbow Six Siege',
    short: 'R6',
    divisions: ['V', 'IV', 'III', 'II', 'I'],
    tiers: [
      T('Cobre', '#b5523b'),
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Esmeralda', EMERALD),
      T('Diamante', '#b467ff'),
      T('Campeón', '#ff3b70'),
    ],
  },
  {
    id: 'dota2',
    name: 'Dota 2',
    short: 'DOTA',
    divisions: ['1', '2', '3', '4', '5'],
    tiers: [
      T('Heraldo', '#8a9a5b'),
      T('Guardián', '#9aa0a6'),
      T('Cruzado', '#4fb3a0'),
      T('Arconte', '#e8b923'),
      T('Leyenda', '#5aa9ff'),
      T('Ancestral', '#b467ff'),
      T('Divino', '#ffd34d'),
      T('Inmortal', '#ff4d5a'),
    ],
  },
  {
    id: 'sf6',
    name: 'Street Fighter 6',
    short: 'SF6',
    divisions: ['1', '2', '3', '4', '5'],
    tiers: [
      T('Novato', IRON),
      T('Hierro', IRON),
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Diamante', DIAMOND),
      T('Maestro', MASTER),
      T('Leyenda', '#ff4d5a', GOLD),
    ],
  },
  {
    id: 'rivals',
    name: 'Marvel Rivals',
    short: 'MR',
    divisions: ['III', 'II', 'I'],
    tiers: [
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Diamante', DIAMOND),
      T('Gran Maestro', MASTER),
      T('Celestial', '#ffb84d'),
      T('Eternidad', '#ff5fa2'),
      T('Uno sobre Todos', '#ffffff', GOLD),
    ],
  },
  {
    id: 'other',
    name: 'Otro juego',
    short: '',
    tiers: [
      T('Bronce', BRONZE),
      T('Plata', SILVER),
      T('Oro', GOLD),
      T('Platino', PLAT),
      T('Diamante', DIAMOND),
      T('Maestro', MASTER),
      T('Leyenda', GM, GOLD),
    ],
  },
];

export function rankedGame(id: string): RankedGame | undefined {
  return RANKED_GAMES.find((g) => g.id === id);
}

// La posición del rango (0..1) decide la forma de la insignia: más alto, más adornada.
export function tierInfo(gameId: string, tier: string): { tier: Tier; level: number } {
  const g = rankedGame(gameId) ?? RANKED_GAMES[RANKED_GAMES.length - 1];
  const i = g.tiers.findIndex((t) => t.name === tier);
  const idx = i < 0 ? 0 : i;
  return { tier: g.tiers[idx], level: g.tiers.length > 1 ? idx / (g.tiers.length - 1) : 0 };
}
