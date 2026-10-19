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
  return (id: string) => (id === OFFICIAL_PROFILE.id ? OFFICIAL_PROFILE : (profiles[id] ?? remote[id]));
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
    return (listId: string) => counts[listId] ?? 0;
  }, [items, remoteItems]);
}

// Primeras portadas de cada lista (para los mosaicos) y su número de juegos.
export function useListPreview(): (listId: string, n?: number) => GameRecord[] {
  const items = useStore((s) => s.items);
  const games = useStore((s) => s.games);
  const remoteItems = useRemote((s) => s.items);
  const remoteGames = useRemote((s) => s.games);
  return useMemo(() => {
    const byList: Record<string, { position: number; gameId: string }[]> = {};
    const local = Object.values(items);
    const localLists = new Set(local.map((i) => i.listId));
    for (const item of [...local, ...Object.values(remoteItems).filter((i) => !localLists.has(i.listId))]) {
      (byList[item.listId] ??= []).push(item);
    }
    for (const arr of Object.values(byList)) arr.sort((a, b) => a.position - b.position);
    return (listId: string, n = 4) =>
      (byList[listId] ?? [])
        .map((i) => games[i.gameId] ?? remoteGames[i.gameId])
        .filter((g): g is GameRecord => !!g)
        .slice(0, n);
  }, [items, games, remoteItems, remoteGames]);
}

// Las listas que sigues.
export function useFollowedLists(): GameList[] {
  const follows = useStore((s) => s.follows);
  const profileId = useStore((s) => s.currentProfileId);
  const lists = useStore((s) => s.lists);
  const remote = useRemote((s) => s.lists);
  return useMemo(() => {
    const ids = profileId ? (follows[profileId] ?? []) : [];
    return ids
      .map((id) => lists[id] ?? OFFICIAL_LISTS.find((l) => l.id === id) ?? remote[id])
      .filter((l): l is GameList => !!l);
  }, [follows, profileId, lists, remote]);
}

export type ListProgress = { games: number; finished: number; pct: number };

// Cuánto llevas completado de cada lista (terminados o al 100 % con tu cuenta).
export function useListProgress(): (listId: string) => ListProgress {
  const items = useStore((s) => s.items);
  const userGames = useStore((s) => s.userGames);
  const profileId = useStore((s) => s.currentProfileId);
  const remoteItems = useRemote((s) => s.items);
  return useMemo(() => {
    const done = new Set(
      Object.values(userGames)
        .filter((u) => u.profileId === profileId && (u.status === 'beaten' || u.status === 'completed'))
        .map((u) => u.gameId),
    );
    const local = Object.values(items);
    const localLists = new Set(local.map((i) => i.listId));
    const byList: Record<string, ListProgress> = {};
    for (const item of [...local, ...Object.values(remoteItems).filter((i) => !localLists.has(i.listId))]) {
      const p = (byList[item.listId] ??= { games: 0, finished: 0, pct: 0 });
      p.games += 1;
      if (done.has(item.gameId)) p.finished += 1;
    }
    for (const p of Object.values(byList)) p.pct = p.games ? Math.round((p.finished / p.games) * 100) : 0;
    return (listId: string) => byList[listId] ?? { games: 0, finished: 0, pct: 0 };
  }, [items, userGames, profileId, remoteItems]);
}
