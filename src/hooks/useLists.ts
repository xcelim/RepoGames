import { useMemo } from 'react';

import { useRemote } from '@/cloud/remote';
import { OFFICIAL_LISTS, OFFICIAL_PROFILE } from '@/data/catalog';
import { useStore } from '@/store/useStore';
import type { GameList, GameRecord, Profile } from '@/types';
import { buildEntries, findGame, itemsOfList, type Entry } from '@/utils/library';

// Busca un juego en el catálogo, en los tuyos y en los descargados.
export function useGame(gameId: string): GameRecord | undefined {
  const games = useStore((s) => s.games);
  const remoteGames = useRemote((s) => s.games);
  return findGame(games, gameId) ?? remoteGames[gameId];
}

export function useProfileLookup(): (id: string) => Profile | undefined {
  const profiles = useStore((s) => s.profiles);
  const remote = useRemote((s) => s.profiles);
  return (id: string) =>
    id === OFFICIAL_PROFILE.id ? OFFICIAL_PROFILE : (profiles[id] ?? remote[id]);
}

export function useList(listId: string): GameList | undefined {
  const lists = useStore((s) => s.lists);
  const remote = useRemote((s) => s.lists);
  return lists[listId] ?? OFFICIAL_LISTS.find((l) => l.id === listId) ?? remote[listId];
}

export function useListEntries(listId: string): Entry[] {
  const items = useStore((s) => s.items);
  const games = useStore((s) => s.games);
  const userGames = useStore((s) => s.userGames);
  const profileId = useStore((s) => s.currentProfileId);
  const remoteItems = useRemote((s) => s.items);
  const remoteGames = useRemote((s) => s.games);
  return useMemo(() => {
    const local = itemsOfList(items, listId);
    const list = local.length > 0 ? local : itemsOfList(remoteItems, listId);
    return buildEntries(list, { ...remoteGames, ...games }, userGames, profileId);
  }, [items, games, userGames, profileId, listId, remoteItems, remoteGames]);
}

export function useMyLists(): GameList[] {
  const lists = useStore((s) => s.lists);
  const profileId = useStore((s) => s.currentProfileId);
  return useMemo(
    () =>
      Object.values(lists)
        .filter((list) => list.ownerId === profileId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [lists, profileId],
  );
}

// Listas públicas de la comunidad: otras cuentas del móvil y, con Supabase, de todo el mundo.
export function useCommunityLists(): GameList[] {
  const lists = useStore((s) => s.lists);
  const profileId = useStore((s) => s.currentProfileId);
  const remote = useRemote((s) => s.lists);
  return useMemo(() => {
    const seen = new Set<string>();
    return [...Object.values(lists), ...Object.values(remote)]
      .filter((list) => {
        if (list.visibility !== 'public' || list.ownerId === profileId || seen.has(list.id)) {
          return false;
        }
        seen.add(list.id);
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [lists, remote, profileId]);
}

export function useListCount(): (listId: string) => number {
  const items = useStore((s) => s.items);
  const remoteItems = useRemote((s) => s.items);
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of [...Object.values(items), ...Object.values(remoteItems)]) {
      counts[item.listId] = (counts[item.listId] ?? 0) + 1;
    }
    return (listId: string) =>
      listId.startsWith('official-') ? itemsOfList({}, listId).length : (counts[listId] ?? 0);
  }, [items, remoteItems]);
}
