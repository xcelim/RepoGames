import { useMemo } from 'react';

import { useStore } from '@/store/useStore';
import { frameIndexForLevel } from '@/theme/frames';
import { computeXp, levelFromXp, showcaseSlots } from '@/utils/level';

import { useAchievementData } from './usePlatinums';

// Tu nivel de jugador, tu experiencia y lo que tienes desbloqueado.
export function useLevel() {
  const profileId = useStore((s) => s.currentProfileId);
  const profile = useStore((s) => (s.currentProfileId ? s.profiles[s.currentProfileId] : undefined));
  const userGames = useStore((s) => s.userGames);
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const { platinums, earned, loading } = useAchievementData();
  return useMemo(() => {
    const { xp, breakdown } = computeXp({
      profileId: profileId ?? '',
      userGames,
      lists,
      items,
      platinums: platinums.length,
      achievements: earned.length,
    });
    const lv = levelFromXp(xp);
    const bestFrame = frameIndexForLevel(lv.level);
    // El marco elegido (si sigue desbloqueado) o el mejor que tengas.
    const chosen = profile?.frame;
    const frame =
      chosen === null ? null : chosen !== undefined && chosen <= bestFrame ? chosen : bestFrame >= 0 ? bestFrame : null;
    return { xp, breakdown, ...lv, slots: showcaseSlots(lv.level), bestFrame, frame, loading };
  }, [profileId, userGames, lists, items, platinums.length, earned.length, profile?.frame, loading]);
}
