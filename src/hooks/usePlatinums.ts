import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { fetchAchievements, type Achievement } from '@/api/achievements';
import { useStore } from '@/store/useStore';
import type { GameRecord, UserGame } from '@/types';

export type Platinum = { game: GameRecord; ug: UserGame; total: number; list: Achievement[] };
export type Earned = { game: GameRecord; achievement: Achievement };

type Data = { platinums: Platinum[]; earned: Earned[]; loading: boolean };

// Compartido entre pantallas para no recalcularlo en cada una.
const useAchData = create<Data & { key: string }>(() => ({ platinums: [], earned: [], loading: true, key: '' }));

// Tus logros marcados y tus Platinos Saga Quest (juegos con todos los logros).
// Usa la lista de logros guardada en el móvil; si no está, la descarga.
export function useAchievementData(): Data {
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const data = useAchData();

  useEffect(() => {
    const candidates = Object.values(userGames).filter(
      (u) => u.profileId === profileId && (u.achievements?.length ?? 0) > 0,
    );
    const key = `${profileId}#` + candidates.map((u) => `${u.gameId}:${u.achievements!.length}`).join('|');
    if (key === useAchData.getState().key) return;
    let alive = true;
    computeAchievements(candidates, games).then((d) => {
      if (alive) useAchData.setState({ ...d, loading: false, key });
    });
    return () => {
      alive = false;
    };
  }, [userGames, games, profileId]);

  return data;
}

export async function computeAchievements(
  candidates: UserGame[],
  games: Record<string, GameRecord>,
): Promise<{ platinums: Platinum[]; earned: Earned[] }> {
  const platinums: Platinum[] = [];
  const earned: Earned[] = [];
  for (const ug of candidates) {
    if (!ug.achievements?.length) continue;
    const game = games[ug.gameId];
    if (!game) continue;
    const set = await fetchAchievements(game).catch(() => null);
    const done = new Set(ug.achievements);
    const list = set?.list ?? [];
    // ¿La lista descargada es la misma con la que marcaste los logros? (Steam y RAWG usan ids
    // distintos: según el dispositivo puede salir una u otra.)
    const same = list.length > 0 && list.some((a) => done.has(a.id));
    if (same) {
      if (ug.profileId === useStore.getState().currentProfileId)
        useStore.getState().setAchievementsTotal(game.id, list.length);
      for (const a of list) if (done.has(a.id)) earned.push({ game, achievement: a });
      if (list.every((a) => done.has(a.id))) platinums.push({ game, ug, total: list.length, list });
      continue;
    }
    // Si no se puede comprobar aquí, vale lo que se guardó al marcarlos (es igual en todos tus dispositivos).
    if (ug.achievementsTotal && done.size >= ug.achievementsTotal)
      platinums.push({ game, ug, total: ug.achievementsTotal, list: [] });
  }
  platinums.sort((a, b) => (b.ug.updatedAt ?? '').localeCompare(a.ug.updatedAt ?? ''));
  return { platinums, earned };
}

// Logros y platinos de otro usuario (para su perfil público).
export function useAchievementsOf(userGames: UserGame[], games: Record<string, GameRecord>): Data {
  const [data, setData] = useState<Data>({ platinums: [], earned: [], loading: true });
  const key =
    userGames.map((u) => `${u.gameId}:${u.achievements?.length ?? 0}`).join('|') + `#${Object.keys(games).length}`;
  useEffect(() => {
    let alive = true;
    computeAchievements(userGames, games).then((d) => alive && setData({ ...d, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data;
}

export function usePlatinums(): { list: Platinum[]; loading: boolean } {
  const { platinums, loading } = useAchievementData();
  return { list: platinums, loading };
}
