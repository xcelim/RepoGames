import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { hasIgdbCredentials, igdbBestOfYear, igdbRecentPopular, igdbUpcoming, igdbUpcomingWide } from './igdb';
import type { OnlineResult } from './types';

// Secciones de "Descubrir" (como IGN): mejor valorados del año, lo que se juega ahora y lo que viene.

export type DiscoverKind = 'best' | 'popular' | 'upcoming' | 'best-last';

const MAX_AGE = 12 * 3600 * 1000;
const PREFIX = 'discover:v1:';

export const DISCOVER_META: Record<DiscoverKind, { title: (y: number) => string; subtitle: (y: number) => string }> = {
  best: {
    title: (y) => `Mejor valorados ${y}`,
    subtitle: (y) => `Los juegos con mejor nota media de ${y}, según crítica y jugadores de IGDB.`,
  },
  popular: {
    title: () => 'Se juega esta semana',
    subtitle: () => 'Lanzamientos recientes con más expectación.',
  },
  upcoming: {
    title: () => 'Próximos lanzamientos',
    subtitle: () => 'Los más esperados que todavía no han salido.',
  },
  'best-last': {
    title: (y) => `Mejor valorados ${y - 1}`,
    subtitle: (y) => `Lo mejor del año pasado (${y - 1}).`,
  },
};

async function load(kind: DiscoverKind, limit: number): Promise<OnlineResult[]> {
  const year = new Date().getFullYear();
  if (kind === 'best') {
    const games = await igdbBestOfYear(year, limit);
    // A principios de año casi no hay notas: tira del año pasado.
    return games.length >= 5 ? games : igdbBestOfYear(year - 1, limit);
  }
  if (kind === 'best-last') return igdbBestOfYear(year - 1, limit);
  if (kind === 'popular') return igdbRecentPopular(limit);
  return igdbUpcoming(limit);
}

export async function fetchDiscover(kind: DiscoverKind, limit = 20, force = false): Promise<OnlineResult[]> {
  const key = `${PREFIX}${kind}:${limit}`;
  if (!force) {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const { at, data } = JSON.parse(cached) as { at: number; data: OnlineResult[] };
      if (Date.now() - at < MAX_AGE) return data;
    }
  }
  if (!(await hasIgdbCredentials())) return [];
  const data = await load(kind, limit);
  await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  return data;
}

export function useDiscover(kind: DiscoverKind, limit = 20) {
  const [state, setState] = useState<{ data: OnlineResult[]; loading: boolean; error: string | null }>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    fetchDiscover(kind, limit)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch(
        (e: unknown) =>
          !cancelled && setState({ data: [], loading: false, error: e instanceof Error ? e.message : 'Error' }),
      );
    return () => {
      cancelled = true;
    };
  }, [kind, limit]);
  return state;
}

// Calendario de lanzamientos (todas las plataformas), guardado 12 horas.
export function useUpcomingWide() {
  const [state, setState] = useState<{ data: OnlineResult[]; loading: boolean; error: string | null }>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = `${PREFIX}upcoming-wide`;
      const cached = await AsyncStorage.getItem(key).catch(() => null);
      if (cached) {
        const { at, data } = JSON.parse(cached) as { at: number; data: OnlineResult[] };
        if (Date.now() - at < MAX_AGE) return data;
      }
      if (!(await hasIgdbCredentials())) return [];
      const data = await igdbUpcomingWide();
      await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), data })).catch(() => undefined);
      return data;
    })()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch(
        (e: unknown) =>
          !cancelled && setState({ data: [], loading: false, error: e instanceof Error ? e.message : 'Error' }),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
