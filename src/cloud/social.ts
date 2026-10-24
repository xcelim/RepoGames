// Amigos, chat y actividad de amigos (Supabase + tiempo real).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { useStore } from '@/store/useStore';
import type { GameRecord, Profile, UserGame } from '@/types';

import {
  fromGameRow,
  fromItemRow,
  fromListRow,
  fromProfileRow,
  fromUserGameRow,
  toGameRow,
  type GameRow,
  type ListItemRow,
  type ListRow,
  type ProfileRow,
  type UserGameRow,
} from './mappers';
import { notifyLocal, setupLocalNotifications } from '@/utils/localNotify';

import { syncNow } from './engine';
import { useRemote } from './remote';
import { getSupabase } from './supabase';

export type Friendship = {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  acceptedAt: string | null;
};

export type Message = {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  gameId: string | null;
  createdAt: string;
  readAt: string | null;
  pending?: boolean; // aún enviándose
};

type FriendshipRow = {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  created_at: string;
  accepted_at: string | null;
};
type MessageRow = {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  game_id: string | null;
  created_at: string;
  read_at: string | null;
};

const fromFriendship = (r: FriendshipRow): Friendship => ({
  requester: r.requester,
  addressee: r.addressee,
  status: r.status,
  createdAt: r.created_at,
  acceptedAt: r.accepted_at,
});
const fromMessage = (r: MessageRow): Message => ({
  id: r.id,
  sender: r.sender,
  recipient: r.recipient,
  body: r.body,
  gameId: r.game_id,
  createdAt: r.created_at,
  readAt: r.read_at,
});

type SocialState = {
  ready: boolean;
  missingTables: boolean; // no se ha ejecutado el SQL de amigos y chat
  friendships: Friendship[];
  profiles: Record<string, Profile>;
  games: Record<string, GameRecord>;
  // Mensajes por conversación (id del amigo → mensajes, del más antiguo al más nuevo)
  chats: Record<string, Message[]>;
  activity: { ug: UserGame; at: string }[];
  reactions: Reaction[];
  groups: ChatGroup[];
  groupChats: Record<string, GroupMessage[]>;
};

export type Reaction = { profileId: string; targetProfile: string; gameId: string; emoji: string; createdAt: string };
export type ChatGroup = { id: string; name: string; createdBy: string; members: string[]; lastReadAt: string };
export type GroupMessage = {
  id: string;
  groupId: string;
  sender: string;
  body: string;
  gameId: string | null;
  createdAt: string;
  pending?: boolean;
};
type GroupMessageRow = {
  id: string;
  group_id: string;
  sender: string;
  body: string;
  game_id: string | null;
  created_at: string;
};
const fromGroupMessage = (r: GroupMessageRow): GroupMessage => ({
  id: r.id,
  groupId: r.group_id,
  sender: r.sender,
  body: r.body,
  gameId: r.game_id,
  createdAt: r.created_at,
});
export const REACTIONS = ['👍', '🔥', '😂', '😮', '❤️', '🏆'];

export const useSocial = create<SocialState>()(() => ({
  ready: false,
  missingTables: false,
  friendships: [],
  profiles: {},
  games: {},
  chats: {},
  activity: [],
  reactions: [],
  groups: [],
  groupChats: {},
}));

const me = () => useStore.getState().cloudUserId;
const otherOf = (f: { requester: string; addressee: string } | Message, uid: string) =>
  'requester' in f ? (f.requester === uid ? f.addressee : f.requester) : f.sender === uid ? f.recipient : f.sender;

function isMissing(error: { message: string; code?: string } | null): boolean {
  return (
    !!error &&
    (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message))
  );
}

export async function ensureProfiles(ids: string[]): Promise<void> {
  const client = getSupabase();
  const known = useSocial.getState().profiles;
  const missing = [...new Set(ids)].filter((id) => id && !known[id]);
  if (!client || !missing.length) return;
  const { data } = await client.from('profiles').select('*').in('id', missing);
  if (!data) return;
  useSocial.setState((s) => ({
    profiles: { ...s.profiles, ...Object.fromEntries((data as ProfileRow[]).map((r) => [r.id, fromProfileRow(r)])) },
  }));
}

export async function ensureGames(ids: string[]): Promise<void> {
  const client = getSupabase();
  const local = useStore.getState().games;
  const known = useSocial.getState().games;
  const missing = [...new Set(ids)].filter((id) => id && !local[id] && !known[id]);
  if (!client || !missing.length) return;
  const { data } = await client.from('games').select('*').in('id', missing.slice(0, 500));
  if (!data) return;
  useSocial.setState((s) => ({
    games: { ...s.games, ...Object.fromEntries((data as GameRow[]).map((r) => [r.id, fromGameRow(r)])) },
  }));
}

// ---------- Amigos ----------

export async function refreshFriends(): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const { data, error } = await client.from('friendships').select('*');
  if (isMissing(error)) {
    useSocial.setState({ missingTables: true, ready: true });
    return;
  }
  if (error) throw new Error(error.message);
  const friendships = (data as FriendshipRow[]).map(fromFriendship);
  useSocial.setState({ friendships, missingTables: false, ready: true });
  await ensureProfiles(friendships.map((f) => otherOf(f, uid)));
}

export function friendIds(): string[] {
  const uid = me();
  if (!uid) return [];
  return useSocial
    .getState()
    .friendships.filter((f) => f.status === 'accepted')
    .map((f) => otherOf(f, uid));
}

export function useFriendState(otherId: string): 'none' | 'friends' | 'sent' | 'received' | 'me' {
  const uid = useStore((s) => s.cloudUserId);
  const f = useSocial((s) =>
    s.friendships.find((x) => (x.requester === otherId || x.addressee === otherId) && otherId !== uid),
  );
  if (otherId === uid) return 'me';
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester === uid ? 'sent' : 'received';
}

export async function searchUsers(q: string): Promise<Profile[]> {
  const client = getSupabase();
  const uid = me();
  const text = q
    .trim()
    .replace(/^@/, '')
    .replace(/[%_,()]/g, '');
  if (!client || text.length < 2) return [];
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${text}%,display_name.ilike.%${text}%`)
    .limit(25);
  if (error) throw new Error(error.message);
  const out = (data as ProfileRow[]).map(fromProfileRow).filter((p) => p.id !== uid);
  useSocial.setState((s) => ({ profiles: { ...s.profiles, ...Object.fromEntries(out.map((p) => [p.id, p])) } }));
  return out;
}

export async function sendFriendRequest(otherId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) throw new Error('Necesitas iniciar sesión');
  // Si el otro ya te lo había pedido, se acepta directamente.
  const theirs = useSocial.getState().friendships.find((f) => f.requester === otherId && f.addressee === uid);
  if (theirs) return acceptFriend(otherId);
  const { error } = await client.from('friendships').insert({ requester: uid, addressee: otherId });
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
  await refreshFriends();
}

export async function acceptFriend(requester: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const { error } = await client
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('requester', requester)
    .eq('addressee', uid);
  if (error) throw new Error(error.message);
  await refreshFriends();
}

export async function removeFriend(otherId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  await client.from('friendships').delete().eq('requester', uid).eq('addressee', otherId);
  await client.from('friendships').delete().eq('requester', otherId).eq('addressee', uid);
  await refreshFriends();
}

// ---------- Chat ----------

export async function refreshInbox(): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const { data, error } = await client
    .from('messages')
    .select('*')
    .or(`sender.eq.${uid},recipient.eq.${uid}`)
    .order('created_at', { ascending: false })
    .limit(400);
  if (isMissing(error)) return;
  if (error) throw new Error(error.message);
  const chats: Record<string, Message[]> = {};
  for (const m of (data as MessageRow[]).map(fromMessage)) {
    const other = otherOf(m, uid);
    (chats[other] ??= []).push(m);
  }
  for (const k of Object.keys(chats)) chats[k].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  useSocial.setState({ chats });
  await ensureProfiles(Object.keys(chats));
  await ensureGames(Object.values(chats).flatMap((ms) => ms.map((m) => m.gameId).filter((g): g is string => !!g)));
}

export async function sendMessage(otherId: string, body: string, gameId?: string | null): Promise<void> {
  const client = getSupabase();
  const uid = me();
  const text = body.trim();
  if (!client || !uid || (!text && !gameId)) return;
  const temp: Message = {
    id: `tmp-${Date.now()}`,
    sender: uid,
    recipient: otherId,
    body: text,
    gameId: gameId ?? null,
    createdAt: new Date().toISOString(),
    readAt: null,
    pending: true,
  };
  useSocial.setState((s) => ({ chats: { ...s.chats, [otherId]: [...(s.chats[otherId] ?? []), temp] } }));
  // El juego que mandas tiene que existir en la base de datos.
  if (gameId) {
    const g = useStore.getState().games[gameId];
    if (g) {
      await client.from('games').upsert(toGameRow(g, g.source === 'igdb' || g.source === 'rawg' ? null : uid));
    }
  }
  const { data, error } = await client
    .from('messages')
    .insert({ sender: uid, recipient: otherId, body: text, game_id: gameId ?? null })
    .select('*')
    .single();
  useSocial.setState((s) => ({
    chats: {
      ...s.chats,
      [otherId]: (s.chats[otherId] ?? [])
        .filter((m) => m.id !== temp.id && (!data || m.id !== (data as MessageRow).id))
        .concat(data ? [fromMessage(data as MessageRow)] : []),
    },
  }));
  if (error)
    throw new Error(error.message.includes('row-level security') ? 'Solo puedes escribir a tus amigos' : error.message);
}

export async function markRead(otherId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const msgs = useSocial.getState().chats[otherId] ?? [];
  if (!msgs.some((m) => m.recipient === uid && !m.readAt)) return;
  const now = new Date().toISOString();
  useSocial.setState((s) => ({
    chats: {
      ...s.chats,
      [otherId]: (s.chats[otherId] ?? []).map((m) => (m.recipient === uid && !m.readAt ? { ...m, readAt: now } : m)),
    },
  }));
  await client.rpc('mark_chat_read', { other: otherId });
}

export function useUnreadCount(): number {
  const uid = useStore((s) => s.cloudUserId);
  return useSocial(
    (s) =>
      Object.values(s.chats).reduce((n, ms) => n + ms.filter((m) => m.recipient === uid && !m.readAt).length, 0) +
      s.groups.reduce((n, g) => n + groupUnread(g, s.groupChats[g.id], uid), 0),
  );
}

export function usePendingRequests(): number {
  const uid = useStore((s) => s.cloudUserId);
  return useSocial((s) => s.friendships.filter((f) => f.status === 'pending' && f.addressee === uid).length);
}

// ---------- Actividad de tus amigos ----------

export async function refreshActivity(): Promise<void> {
  const client = getSupabase();
  const ids = friendIds();
  if (!client || !ids.length) {
    useSocial.setState({ activity: [] });
    return;
  }
  const { data, error } = await client
    .from('user_games')
    .select('*')
    .in('profile_id', ids)
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error) return;
  const activity = (data as UserGameRow[]).map((r) => ({ ug: fromUserGameRow(r, r.profile_id), at: r.updated_at }));
  useSocial.setState({ activity });
  await ensureGames(activity.map((a) => a.ug.gameId));
}

// Biblioteca pública de otro usuario (para su perfil y la compatibilidad).
export async function fetchUserLibrary(profileId: string): Promise<UserGame[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from('user_games').select('*').eq('profile_id', profileId).limit(2000);
  const list = ((data as UserGameRow[] | null) ?? []).map((r) => fromUserGameRow(r, profileId));
  await ensureGames(list.map((u) => u.gameId));
  return list;
}

export async function fetchProfile(profileId: string): Promise<Profile | null> {
  await ensureProfiles([profileId]);
  return useSocial.getState().profiles[profileId] ?? null;
}

// ---------- Reacciones a la actividad ----------

export async function refreshReactions(): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const { data, error } = await client
    .from('reactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return;
  const reactions = (
    data as { profile_id: string; target_profile: string; game_id: string; emoji: string; created_at: string }[]
  ).map((r) => ({
    profileId: r.profile_id,
    targetProfile: r.target_profile,
    gameId: r.game_id,
    emoji: r.emoji,
    createdAt: r.created_at,
  }));
  useSocial.setState({ reactions });
  await ensureProfiles(reactions.map((r) => r.profileId));
}

// Una reacción por persona y actividad: tocar la misma la quita; otra, la cambia.
export async function toggleReaction(targetProfile: string, gameId: string, emoji: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const current = useSocial
    .getState()
    .reactions.find((r) => r.profileId === uid && r.targetProfile === targetProfile && r.gameId === gameId);
  const others = useSocial.getState().reactions.filter((r) => r !== current);
  if (current?.emoji === emoji) {
    useSocial.setState({ reactions: others });
    await client
      .from('reactions')
      .delete()
      .eq('profile_id', uid)
      .eq('target_profile', targetProfile)
      .eq('game_id', gameId);
    return;
  }
  const next: Reaction = { profileId: uid, targetProfile, gameId, emoji, createdAt: new Date().toISOString() };
  useSocial.setState({ reactions: [next, ...others] });
  const { error } = await client
    .from('reactions')
    .upsert({ profile_id: uid, target_profile: targetProfile, game_id: gameId, emoji, created_at: next.createdAt });
  if (error) {
    useSocial.setState({ reactions: useSocial.getState().reactions.filter((r) => r !== next) });
    throw new Error(error.message);
  }
}

// ---------- Chats de grupo ----------

export async function refreshGroups(): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const { data: mine, error } = await client
    .from('chat_group_members')
    .select('group_id,last_read_at')
    .eq('profile_id', uid);
  if (error) return;
  const ids = (mine as { group_id: string; last_read_at: string }[]).map((m) => m.group_id);
  if (!ids.length) {
    useSocial.setState({ groups: [], groupChats: {} });
    return;
  }
  const [{ data: groups }, { data: members }, { data: msgs }] = await Promise.all([
    client.from('chat_groups').select('*').in('id', ids),
    client.from('chat_group_members').select('group_id,profile_id').in('group_id', ids),
    client.from('group_messages').select('*').in('group_id', ids).order('created_at', { ascending: false }).limit(500),
  ]);
  const readAt = new Map(
    (mine as { group_id: string; last_read_at: string }[]).map((m) => [m.group_id, m.last_read_at]),
  );
  const list: ChatGroup[] = ((groups as { id: string; name: string; created_by: string }[] | null) ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    createdBy: g.created_by,
    members: ((members as { group_id: string; profile_id: string }[] | null) ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => m.profile_id),
    lastReadAt: readAt.get(g.id) ?? '',
  }));
  const groupChats: Record<string, GroupMessage[]> = {};
  for (const m of ((msgs as GroupMessageRow[] | null) ?? []).map(fromGroupMessage))
    (groupChats[m.groupId] ??= []).push(m);
  for (const k of Object.keys(groupChats)) groupChats[k].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  useSocial.setState({ groups: list, groupChats });
  await ensureProfiles(list.flatMap((g) => g.members));
  await ensureGames(Object.values(groupChats).flatMap((ms) => ms.map((m) => m.gameId).filter((g): g is string => !!g)));
}

export async function createGroup(name: string, members: string[]): Promise<string> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) throw new Error('Necesitas conexión');
  const { data, error } = await client
    .from('chat_groups')
    .insert({ name: name.trim(), created_by: uid })
    .select('*')
    .single();
  if (error) throw new Error(isMissing(error) ? 'Falta ejecutar el SQL de grupos' : error.message);
  const id = (data as { id: string }).id;
  const r1 = await client.from('chat_group_members').insert({ group_id: id, profile_id: uid });
  if (r1.error) throw new Error(r1.error.message);
  if (members.length) {
    const r2 = await client.from('chat_group_members').insert(members.map((p) => ({ group_id: id, profile_id: p })));
    if (r2.error) throw new Error(r2.error.message);
  }
  await refreshGroups();
  return id;
}

export async function addGroupMembers(groupId: string, members: string[]): Promise<void> {
  const client = getSupabase();
  if (!client || !members.length) return;
  const { error } = await client
    .from('chat_group_members')
    .insert(members.map((p) => ({ group_id: groupId, profile_id: p })));
  if (error) throw new Error(error.message);
  await refreshGroups();
}

export async function leaveGroup(groupId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  await client.from('chat_group_members').delete().eq('group_id', groupId).eq('profile_id', uid);
  await refreshGroups();
}

export async function sendGroupMessage(groupId: string, body: string, gameId?: string | null): Promise<void> {
  const client = getSupabase();
  const uid = me();
  const text = body.trim();
  if (!client || !uid || (!text && !gameId)) return;
  const temp: GroupMessage = {
    id: `tmp-${Date.now()}`,
    groupId,
    sender: uid,
    body: text,
    gameId: gameId ?? null,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  useSocial.setState((s) => ({ groupChats: { ...s.groupChats, [groupId]: [...(s.groupChats[groupId] ?? []), temp] } }));
  if (gameId) {
    const g = useStore.getState().games[gameId];
    if (g) await client.from('games').upsert(toGameRow(g, g.source === 'igdb' || g.source === 'rawg' ? null : uid));
  }
  const { data, error } = await client
    .from('group_messages')
    .insert({ group_id: groupId, sender: uid, body: text, game_id: gameId ?? null })
    .select('*')
    .single();
  useSocial.setState((s) => ({
    groupChats: {
      ...s.groupChats,
      [groupId]: (s.groupChats[groupId] ?? [])
        .filter((m) => m.id !== temp.id && (!data || m.id !== (data as GroupMessageRow).id))
        .concat(data ? [fromGroupMessage(data as GroupMessageRow)] : []),
    },
  }));
  if (error) throw new Error(error.message);
}

export async function markGroupRead(groupId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  const now = new Date().toISOString();
  useSocial.setState((s) => ({ groups: s.groups.map((g) => (g.id === groupId ? { ...g, lastReadAt: now } : g)) }));
  await client.from('chat_group_members').update({ last_read_at: now }).eq('group_id', groupId).eq('profile_id', uid);
}

export function groupUnread(g: ChatGroup, msgs: GroupMessage[] | undefined, uid: string | null): number {
  return (msgs ?? []).filter((m) => m.sender !== uid && m.createdAt > g.lastReadAt).length;
}

// ---------- Tiempo real ----------

let channel: RealtimeChannel | null = null;

export function startSocial(): () => void {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return () => undefined;
  setupLocalNotifications().catch(() => undefined);
  refreshFriends()
    .then(() => Promise.all([refreshInbox(), refreshActivity(), refreshReactions(), refreshGroups()]))
    .then(() => import('./challenges').then(({ refreshChallenges }) => refreshChallenges()))
    .catch(() => undefined);
  if (channel) client.removeChannel(channel);
  const nameOf = (id: string) => useSocial.getState().profiles[id]?.displayName ?? 'Saga Quest';
  const onMessage = (row: MessageRow, fresh = false) => {
    const m = fromMessage(row);
    const other = otherOf(m, uid);
    if (fresh && m.sender !== uid) {
      ensureProfiles([other])
        .then(() => notifyLocal(nameOf(other), m.gameId ? '🎮 Te ha recomendado un juego' : m.body, `/chat/${other}`))
        .catch(() => undefined);
    }
    useSocial.setState((s) => {
      const list = (s.chats[other] ?? []).filter((x) => x.id !== m.id && !(x.pending && x.body === m.body));
      return { chats: { ...s.chats, [other]: [...list, m].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) } };
    });
    ensureProfiles([other]).catch(() => undefined);
    if (m.gameId) ensureGames([m.gameId]).catch(() => undefined);
  };
  channel = client
    .channel(`social-${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${uid}` },
      (p) => onMessage(p.new as MessageRow, true),
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender=eq.${uid}` }, (p) =>
      onMessage(p.new as MessageRow),
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (p) => {
      const m = fromGroupMessage(p.new as GroupMessageRow);
      if (m.sender !== uid) {
        const g = useSocial.getState().groups.find((x) => x.id === m.groupId);
        notifyLocal(
          g?.name ?? 'Grupo',
          `${nameOf(m.sender)}: ${m.gameId ? '🎮 un juego' : m.body}`,
          `/group/${m.groupId}`,
        );
      }
      if (!useSocial.getState().groups.some((g) => g.id === m.groupId)) {
        refreshGroups().catch(() => undefined);
        return;
      }
      useSocial.setState((s) => {
        const list = (s.groupChats[m.groupId] ?? []).filter(
          (x) => x.id !== m.id && !(x.pending && x.body === m.body && x.sender === m.sender),
        );
        return {
          groupChats: {
            ...s.groupChats,
            [m.groupId]: [...list, m].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          },
        };
      });
      if (m.gameId) ensureGames([m.gameId]).catch(() => undefined);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, () => {
      refreshGroups().catch(() => undefined);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => {
      refreshReactions().catch(() => undefined);
    })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'challenge_members', filter: `profile_id=eq.${uid}` },
      () => {
        import('./challenges')
          .then(({ refreshChallenges }) => refreshChallenges())
          .then(() => notifyLocal('¡Te han retado!', 'Tienes un reto nuevo en Saga Quest', '/challenges'))
          .catch(() => undefined);
      },
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (p) => {
      const row = p.new as FriendshipRow | undefined;
      if (p.eventType === 'INSERT' && row?.addressee === uid) {
        ensureProfiles([row.requester])
          .then(() => notifyLocal('Solicitud de amistad', `${nameOf(row.requester)} quiere ser tu amigo`, '/social'))
          .catch(() => undefined);
      }
      refreshFriends()
        .then(refreshActivity)
        .catch(() => undefined);
    })
    .subscribe();
  return () => {
    if (channel) client.removeChannel(channel);
    channel = null;
  };
}

// Listas públicas de un usuario (se guardan con las de la comunidad).
export async function fetchUserLists(profileId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { data: lists } = await client.from('lists').select('*').eq('owner_id', profileId).eq('visibility', 'public');
  const rows = (lists as ListRow[] | null) ?? [];
  if (!rows.length) return;
  const { data: items } = await client
    .from('list_items')
    .select('*')
    .in(
      'list_id',
      rows.map((l) => l.id),
    );
  const itemRows = (items as ListItemRow[] | null) ?? [];
  await ensureGames(itemRows.map((i) => i.game_id));
  const remote = useRemote.getState();
  remote.setData({
    lists: { ...remote.lists, ...Object.fromEntries(rows.map((r) => [r.id, fromListRow(r)])) },
    items: { ...remote.items, ...Object.fromEntries(itemRows.map((r) => [r.id, fromItemRow(r)])) },
    games: { ...remote.games, ...useSocial.getState().games },
  });
}

// ---------- Listas cooperativas ----------

export async function addListMember(listId: string, profileId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) throw new Error('Necesitas conexión');
  const { error } = await client.from('list_members').insert({ list_id: listId, profile_id: profileId, added_by: uid });
  if (error && !/duplicate/i.test(error.message)) {
    throw new Error(isMissing(error) ? 'Falta ejecutar el SQL de listas cooperativas' : error.message);
  }
  await syncNow();
}

export async function removeListMember(listId: string, profileId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { error } = await client.from('list_members').delete().eq('list_id', listId).eq('profile_id', profileId);
  if (error) throw new Error(error.message);
  await syncNow();
}
