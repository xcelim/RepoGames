// Retos entre amigos y progreso de tus amigos en un juego (logros incluidos).
import { create } from 'zustand';

import { fetchAchievements, type Achievement } from '@/api/achievements';
import { useStore } from '@/store/useStore';
import type { GameRecord, UserGame } from '@/types';

import { fromUserGameRow, toGameRow, type UserGameRow } from './mappers';
import { ensureGames, ensureProfiles, friendIds, useSocial } from './social';
import { getSupabase } from './supabase';

export type ChallengeKind = 'finish' | 'platinum' | 'achievements' | 'count';

export type Challenge = {
  id: string;
  creator: string;
  title: string;
  kind: ChallengeKind;
  gameId: string | null;
  target: number | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  members: { profileId: string; accepted: boolean; finishedAt: string | null }[];
};

type ChallengeRow = {
  id: string;
  creator: string;
  title: string;
  kind: ChallengeKind;
  game_id: string | null;
  target: number | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};
type MemberRow = { challenge_id: string; profile_id: string; accepted: boolean; finished_at: string | null };

export const KIND_META: Record<ChallengeKind, { name: string; description: string; icon: string }> = {
  finish: { name: 'Terminarlo', description: 'Quién termina antes el juego', icon: 'flag' },
  platinum: { name: 'Platino', description: 'Quién consigue antes todos los logros', icon: 'trophy' },
  achievements: { name: 'Carrera de logros', description: 'Quién tiene más logros del juego', icon: 'ribbon' },
  count: { name: 'Maratón', description: 'Quién termina más juegos en el plazo', icon: 'speedometer' },
};

export const useChallenges = create<{ list: Challenge[]; loaded: boolean; missing: boolean }>(() => ({
  list: [],
  loaded: false,
  missing: false,
}));

const me = () => useStore.getState().cloudUserId;

export async function refreshChallenges(): Promise<void> {
  const client = getSupabase();
  if (!client || !me()) return;
  const { data, error } = await client
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    useChallenges.setState({ loaded: true, missing: /does not exist|schema cache/i.test(error.message) });
    return;
  }
  const rows = data as ChallengeRow[];
  const ids = rows.map((r) => r.id);
  const { data: mdata } = ids.length
    ? await client.from('challenge_members').select('*').in('challenge_id', ids)
    : { data: [] as MemberRow[] };
  const members = (mdata as MemberRow[] | null) ?? [];
  const list: Challenge[] = rows.map((r) => ({
    id: r.id,
    creator: r.creator,
    title: r.title,
    kind: r.kind,
    gameId: r.game_id,
    target: r.target,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
    members: members
      .filter((m) => m.challenge_id === r.id)
      .map((m) => ({ profileId: m.profile_id, accepted: m.accepted, finishedAt: m.finished_at })),
  }));
  useChallenges.setState({ list, loaded: true, missing: false });
  await ensureGames(list.map((c) => c.gameId).filter((g): g is string => !!g));
  await ensureProfiles(list.flatMap((c) => [c.creator, ...c.members.map((m) => m.profileId)]));
}

export async function createChallenge(input: {
  title: string;
  kind: ChallengeKind;
  gameId: string | null;
  target: number | null;
  days: number | null;
  invite: string[];
}): Promise<string> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) throw new Error('Necesitas conexión');
  // El juego tiene que existir en la base de datos.
  if (input.gameId) {
    const g = useStore.getState().games[input.gameId];
    if (g) {
      await client.from('games').upsert(toGameRow(g, g.source === 'igdb' || g.source === 'rawg' ? null : uid));
    }
  }
  const { data, error } = await client
    .from('challenges')
    .insert({
      creator: uid,
      title: input.title.trim(),
      kind: input.kind,
      game_id: input.gameId,
      target: input.target,
      ends_at: input.days ? new Date(Date.now() + input.days * 86_400_000).toISOString() : null,
    })
    .select('*')
    .single();
  if (error)
    throw new Error(
      /does not exist|schema cache/i.test(error.message) ? 'Falta ejecutar el SQL de retos' : error.message,
    );
  const id = (data as ChallengeRow).id;
  const rows = [
    { challenge_id: id, profile_id: uid, accepted: true },
    ...input.invite.map((p) => ({ challenge_id: id, profile_id: p, accepted: false })),
  ];
  const res = await client.from('challenge_members').insert(rows);
  if (res.error) throw new Error(res.error.message);
  await refreshChallenges();
  return id;
}

export async function answerChallenge(id: string, accept: boolean): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  if (accept)
    await client.from('challenge_members').update({ accepted: true }).eq('challenge_id', id).eq('profile_id', uid);
  else await client.from('challenge_members').delete().eq('challenge_id', id).eq('profile_id', uid);
  await refreshChallenges();
}

export async function deleteChallenge(id: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from('challenges').delete().eq('id', id);
  await refreshChallenges();
}

export async function markChallengeDone(id: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  await client
    .from('challenge_members')
    .update({ finished_at: new Date().toISOString() })
    .eq('challenge_id', id)
    .eq('profile_id', uid)
    .is('finished_at', null);
  await refreshChallenges();
}

// ---------- Progreso de varias personas en un juego ----------

export type PersonProgress = { profileId: string; ug: UserGame | null };

export async function fetchPeopleOnGame(gameId: string, people: string[]): Promise<PersonProgress[]> {
  const client = getSupabase();
  const uid = me();
  const out: PersonProgress[] = [];
  const others = people.filter((p) => p !== uid);
  if (client && others.length) {
    const { data } = await client.from('user_games').select('*').eq('game_id', gameId).in('profile_id', others);
    const rows = (data as UserGameRow[] | null) ?? [];
    for (const p of others) {
      const r = rows.find((x) => x.profile_id === p);
      out.push({ profileId: p, ug: r ? fromUserGameRow(r, p) : null });
    }
  }
  if (uid && people.includes(uid)) {
    const mine = useStore.getState().userGames[`${useStore.getState().currentProfileId}:${gameId}`] ?? null;
    out.unshift({ profileId: uid, ug: mine });
  }
  return out;
}

// Juegos terminados por cada persona desde una fecha (para el reto "Maratón").
export async function fetchFinishedSince(people: string[], since: string): Promise<Record<string, number>> {
  const client = getSupabase();
  const uid = me();
  const out: Record<string, number> = {};
  const day = since.slice(0, 10);
  const finished = (u: { status: string; finished_at?: string | null; updated_at?: string }) =>
    (u.status === 'beaten' || u.status === 'completed') &&
    ((u.finished_at ?? '') >= day || (!u.finished_at && (u.updated_at ?? '') >= since));
  if (client) {
    const others = people.filter((p) => p !== uid);
    if (others.length) {
      const { data } = await client
        .from('user_games')
        .select('profile_id,status,finished_at,updated_at')
        .in('profile_id', others)
        .in('status', ['beaten', 'completed']);
      for (const r of (data as (UserGameRow & { profile_id: string })[] | null) ?? [])
        if (finished(r)) out[r.profile_id] = (out[r.profile_id] ?? 0) + 1;
    }
  }
  if (uid && people.includes(uid)) {
    const pid = useStore.getState().currentProfileId;
    out[uid] = Object.values(useStore.getState().userGames).filter(
      (u) => u.profileId === pid && finished({ status: u.status, finished_at: u.finishedAt, updated_at: u.updatedAt }),
    ).length;
  }
  return out;
}

// Tus amigos que tienen este juego (para ver quién tiene cada logro).
export async function fetchFriendsOnGame(gameId: string): Promise<PersonProgress[]> {
  const ids = friendIds();
  if (!ids.length) return [];
  const list = await fetchPeopleOnGame(gameId, ids);
  return list.filter((p) => p.ug);
}

export type GameRace = { game: GameRecord | null; achievements: Achievement[]; people: PersonProgress[] };

export async function loadRace(gameId: string, people: string[]): Promise<GameRace> {
  const game = useStore.getState().games[gameId] ?? useSocial.getState().games[gameId] ?? null;
  const [set, progress] = await Promise.all([
    game ? fetchAchievements(game).catch(() => null) : null,
    fetchPeopleOnGame(gameId, people),
  ]);
  return { game, achievements: set?.list ?? [], people: progress };
}
