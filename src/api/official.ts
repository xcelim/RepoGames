import { create } from 'zustand';

import { CANON } from '@/data/canon';
import { OFFICIAL_SERIES, officialListId, type OfficialSeries } from '@/data/catalog';
import { useStore } from '@/store/useStore';

import { fetchSeries, resolveGames, toGameRecord } from './games';
import { fetchOfficialFromDb, publishMissingOfficial, publishOfficial } from './officialDb';

// Descarga de la base de datos los juegos de las bibliotecas oficiales.

const MAX_AGE = 7 * 24 * 3600 * 1000; // se actualizan una vez por semana

type LoadState = {
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  set: (patch: Partial<Pick<LoadState, 'loading' | 'errors'>>) => void;
};

export const useOfficialStatus = create<LoadState>()((set) => ({
  loading: {},
  errors: {},
  set: (patch) => set(patch),
}));

function setLoading(listId: string, value: boolean, error?: string) {
  const status = useOfficialStatus.getState();
  const errors = { ...status.errors };
  if (error) errors[listId] = error;
  else delete errors[listId];
  status.set({ loading: { ...status.loading, [listId]: value }, errors });
}

export async function loadOfficialList(series: OfficialSeries, force = false): Promise<void> {
  const listId = officialListId(series.id);
  const store = useStore.getState();
  const loadedAt = store.officialLoadedAt[listId];
  if (!force && loadedAt && Date.now() - new Date(loadedAt).getTime() < MAX_AGE) return;
  if (useOfficialStatus.getState().loading[listId]) return;
  setLoading(listId, true);
  try {
    // Primero, la versión publicada en la base de datos (si la hay y no se pide forzar).
    if (!force) {
      const saved = await fetchOfficialFromDb(listId).catch(() => null);
      if (saved?.length) {
        useStore.getState().setOfficialList(listId, saved);
        setLoading(listId, false);
        return;
      }
    }
    const canon = CANON[series.id];
    let games;
    if (canon) {
      // Solo los canónicos, en su mejor versión: la selección es nuestra, los datos de la API.
      const results = await resolveGames(canon);
      const seen = new Set<string>();
      games = results.flatMap((r, i) => {
        if (!r) return [];
        const game = { ...toGameRecord(r, null), series: series.id, version: canon[i].edition };
        if (seen.has(game.id)) return [];
        seen.add(game.id);
        return [game];
      });
    } else {
      const results = await fetchSeries(series.query);
      games = results.map((r) => ({ ...toGameRecord(r, null), series: series.id }));
    }
    if (games.length === 0) throw new Error('La API no ha devuelto juegos');
    useStore.getState().setOfficialList(listId, games);
    setLoading(listId, false);
    publishOfficial(listId, games).catch(() => undefined); // solo si eres administrador
  } catch (error) {
    setLoading(listId, false, error instanceof Error ? error.message : 'No se pudo descargar');
  }
}

export async function loadAllOfficial(force = false): Promise<void> {
  // Aunque no haya API de juegos (por ejemplo, en la web), se leen de la base de datos.
  for (const series of OFFICIAL_SERIES) {
    await loadOfficialList(series, force);
  }
  publishMissingOfficial().catch(() => undefined);
}
