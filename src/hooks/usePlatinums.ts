import { useEffect, useState } from 'react';

import { fetchAchievements } from '@/api/achievements';
import { useStore } from '@/store/useStore';
import type { GameRecord, UserGame } from '@/types';

export type Platinum = { game: GameRecord; ug: UserGame; total: number };

// Juegos con todos los logros marcados (el "Platino Saga Quest").
// Usa la lista de logros guardada en el móvil; si no está, la descarga.
export function usePlatinums(): { list: Platinum[]; loading: boolean } {
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const [state, setState] = useState<{ list: Platinum[]; loading: boolean }>({ list: [], loading: true });

  useEffect(() => {
    let alive = true;
    const candidates = Object.values(userGames).filter(
      (u) => u.profileId === profileId && (u.achievements?.length ?? 0) > 0,
    );
    (async () => {
      const out: Platinum[] = [];
      for (const ug of candidates) {
        const game = games[ug.gameId];
        if (!game) continue;
        const set = await fetchAchievements(game).catch(() => null);
        if (!set || !set.list.length) continue;
        const done = new Set(ug.achievements);
        if (set.list.every((a) => done.has(a.id))) out.push({ game, ug, total: set.list.length });
      }
      // El más reciente primero.
      out.sort((a, b) => (b.ug.updatedAt ?? '').localeCompare(a.ug.updatedAt ?? ''));
      if (alive) setState({ list: out, loading: false });
    })();
    return () => {
      alive = false;
    };
  }, [userGames, games, profileId]);

  return state;
}
