import { useEffect, useMemo, useState } from 'react';

import { igdbThemes } from '@/api/igdb';
import { useCurrentProfile } from '@/store/useStore';
import { activeEvent, eventContext, type EventCtx, type EventWindow } from '@/utils/events';

import { todayIso, useMyGames } from './useMyGames';

export type SeasonState = {
  window: EventWindow | null;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  today: string;
};

// El evento de temporada activo y cómo vas en su reto.
export function useSeasonEvent(): SeasonState {
  const mine = useMyGames();
  const profile = useCurrentProfile();
  const today = todayIso();
  const w = useMemo(() => activeEvent(today), [today]);
  const [themes, setThemes] = useState<EventCtx['themes']>(() => new Map());
  const base = useMemo(() => (w ? eventContext(mine, w, themes) : null), [mine, w, themes]);
  // Para los retos por tema (terror...) se piden a IGDB los temas de lo que has terminado.
  const ids = useMemo(
    () =>
      w?.event.needsThemes && base
        ? base.finished
            .map((m) => m.game.igdbId)
            .filter((x): x is number => !!x)
            .sort()
            .join(',')
        : '',
    [w, base],
  );
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    igdbThemes(ids.split(',').map(Number))
      .then((m) => alive && m.size && setThemes(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ids]);
  const target = w?.event.target ?? 1;
  const progress = base && w ? Math.min(target, w.event.count(base)) : 0;
  return {
    window: w,
    progress,
    target,
    done: !!w && progress >= target,
    claimed: !!w && !!profile?.events?.[w.id],
    today,
  };
}
