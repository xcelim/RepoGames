import { useEffect } from 'react';
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
    (async () => {
      const platinums: Platinum[] = [];
      const earned: Earned[] = [];
      for (const ug of candidates) {
        const game = games[ug.gameId];
        if (!game) continue;
        const set = await fetchAchievements(game).catch(() => null);
        if (!set || !set.list.length) continue;
        const done = new Set(ug.achievements);
        for (const a of set.list) if (done.has(a.id)) earned.push({ game, achievement: a });
        if (set.list.every((a) => done.has(a.id))) platinums.push({ game, ug, total: set.list.length, list: set.list });
      }
      platinums.sort((a, b) => (b.ug.updatedAt ?? '').localeCompare(a.ug.updatedAt ?? ''));
      if (alive) useAchData.setState({ platinums, earned, loading: false, key });
    })();
    return () => {
      alive = false;
    };
  }, [userGames, games, profileId]);

  return data;
}

export function usePlatinums(): { list: Platinum[]; loading: boolean } {
  const { platinums, loading } = useAchievementData();
  return { list: platinums, loading };
}
