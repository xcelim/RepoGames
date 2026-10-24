import type { GameList, Profile } from '@/types';

// Las bibliotecas oficiales solo dicen QUÉ serie son. Los juegos, portadas,
// horas y descripciones se descargan de la API (IGDB / RAWG).

export type OfficialSeries = {
  id: string;
  name: string;
  query: string; // nombre de la serie en la API
  color: string;
  color2: string;
  icon: string;
};

export const OFFICIAL_SERIES: OfficialSeries[] = [
  { id: 'persona', name: 'Persona', query: 'Persona', color: '#ff2a4d', color2: '#2ef2ff', icon: 'flame' },
  { id: 'fe', name: 'Fire Emblem', query: 'Fire Emblem', color: '#f7971e', color2: '#c94b4b', icon: 'shield' },
  { id: 'ff', name: 'Final Fantasy', query: 'Final Fantasy', color: '#1e3c72', color2: '#7fd6ff', icon: 'diamond' },
  {
    id: 'zelda',
    name: 'The Legend of Zelda',
    query: 'The Legend of Zelda',
    color: '#2f9e58',
    color2: '#e8c547',
    icon: 'triangle',
  },
  { id: 'kirby', name: 'Kirby', query: 'Kirby', color: '#ff8fc8', color2: '#7fd6ff', icon: 'star' },
  { id: 'mario', name: 'Super Mario', query: 'Super Mario', color: '#e53935', color2: '#ffd23f', icon: 'flash' },
  {
    id: 'xeno',
    name: 'Xenoblade Chronicles',
    query: 'Xenoblade Chronicles',
    color: '#11998e',
    color2: '#38ef7d',
    icon: 'planet',
  },
  { id: 'metroid', name: 'Metroid', query: 'Metroid', color: '#ff7a18', color2: '#7b2ff7', icon: 'rocket' },
];

export const officialListId = (seriesId: string) => `official-${seriesId}`;

export function seriesOfList(listId: string): OfficialSeries | undefined {
  return OFFICIAL_SERIES.find((s) => officialListId(s.id) === listId);
}

export const OFFICIAL_PROFILE_ID = 'saga-quest';

export const OFFICIAL_PROFILE: Profile = {
  id: OFFICIAL_PROFILE_ID,
  username: 'sagaquest',
  displayName: 'Saga Quest',
  bio: 'Los canónicos de cada saga en su mejor versión. Datos de la API de IGDB.',
  avatarColor: '#ff2a4d',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const OFFICIAL_LISTS: GameList[] = OFFICIAL_SERIES.map((series) => ({
  id: officialListId(series.id),
  ownerId: OFFICIAL_PROFILE_ID,
  name: series.name,
  description: `Los juegos canónicos de ${series.name}, cada uno en su mejor versión jugable.`,
  visibility: 'public',
  color: series.color,
  color2: series.color2,
  icon: series.icon,
  forkedFrom: null,
  official: true,
  createdAt: OFFICIAL_PROFILE.createdAt,
  updatedAt: OFFICIAL_PROFILE.createdAt,
}));
