import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { groupAlbum, useCards } from '@/cloud/cards';
import { useSocial } from '@/cloud/social';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { earnedTrophies, type TrophyCtx } from '@/utils/trophies';

import { useMyGames } from './useMyGames';

// Todo lo que necesitan los trofeos, sacado de tu biblioteca, listas, amigos y cromos.
export function useTrophyCtx(): TrophyCtx {
  const mine = useMyGames();
  const mode = useStore((s) => s.durationMode);
  const profile = useCurrentProfile();
  const { lists, items, follows, pid, uid } = useStore(
    useShallow((s) => ({
      lists: s.lists,
      items: s.items,
      follows: s.follows,
      pid: s.currentProfileId,
      uid: s.cloudUserId,
    })),
  );
  const friendships = useSocial((s) => s.friendships);
  const { cards, trades } = useCards(useShallow((s) => ({ cards: s.mine, trades: s.trades })));

  return useMemo(() => {
    const myLists = Object.values(lists).filter((l) => l.ownerId === pid && !l.official);
    const done = new Set(
      mine.filter((m) => m.ug.status === 'beaten' || m.ug.status === 'completed').map((m) => m.game.id),
    );
    // Sagas oficiales con todos sus juegos terminados.
    const byList = new Map<string, string[]>();
    for (const it of Object.values(items)) byList.set(it.listId, [...(byList.get(it.listId) ?? []), it.gameId]);
    const officialDone = Object.values(lists).filter((l) => {
      if (!l.official) return false;
      const ids = byList.get(l.id) ?? [];
      return ids.length >= 2 && ids.every((g) => done.has(g));
    }).length;
    return {
      mine,
      mode,
      profile,
      lists: myLists,
      items: Object.values(items),
      follows: pid ? (follows[pid]?.length ?? 0) : 0,
      friends: friendships.filter((f) => f.status === 'accepted').length,
      cards: {
        total: cards.length,
        unique: groupAlbum(cards).length,
        legendary: cards.filter((c) => c.rarity === 'legendary').length,
        foil: cards.filter((c) => c.foil).length,
        trades: trades.filter((t) => t.status === 'accepted' && (t.from === uid || t.to === uid)).length,
      },
      officialDone,
    };
  }, [mine, mode, profile, lists, items, follows, pid, uid, friendships, cards, trades]);
}

export function useEarnedTrophies() {
  const ctx = useTrophyCtx();
  return { ctx, earned: useMemo(() => earnedTrophies(ctx), [ctx]) };
}
