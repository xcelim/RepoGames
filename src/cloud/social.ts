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
};

export const useSocial = create<SocialState>()(() => ({
  ready: false,
  missingTables: false,
  friendships: [],
  profiles: {},
  games: {},
  chats: {},
  activity: [],
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

async function ensureProfiles(ids: string[]): Promise<void> {
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
  return useSocial((s) =>
    Object.values(s.chats).reduce((n, ms) => n + ms.filter((m) => m.recipient === uid && !m.readAt).length, 0),
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

// ---------- Tiempo real ----------

let channel: RealtimeChannel | null = null;

export function startSocial(): () => void {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return () => undefined;
  refreshFriends()
    .then(() => Promise.all([refreshInbox(), refreshActivity()]))
    .catch(() => undefined);
  if (channel) client.removeChannel(channel);
  const onMessage = (row: MessageRow) => {
    const m = fromMessage(row);
    const other = otherOf(m, uid);
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
      (p) => onMessage(p.new as MessageRow),
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender=eq.${uid}` }, (p) =>
      onMessage(p.new as MessageRow),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
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
