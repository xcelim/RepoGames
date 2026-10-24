// Mensajes con la base de datos nueva: conversaciones (de dos o de grupo) + miembros + mensajes.
// Por fuera la app sigue viendo lo mismo: chats por amigo y grupos con sus mensajes.
import { useStore } from '@/store/useStore';

import { toGameRow } from './mappers';
import type { ChatGroup, GroupMessage, Message } from './social';
import { getSupabase } from './supabase';

type ConvRow = {
  id: string;
  kind: 'direct' | 'group';
  name: string | null;
  created_by: string | null;
  created_at: string;
};
type MemberRow = { conversation_id: string; profile_id: string; last_read_at: string; role: string };
export type MsgRow = {
  id: string;
  conversation_id: string;
  sender: string | null;
  body: string;
  game_id: string | null;
  created_at: string;
};

export type ConvMeta = {
  kind: 'direct' | 'group';
  other: string | null; // en los chats de dos: el amigo
  myRead: string;
  otherRead: string; // lo último que ha leído el otro (para el ✓✓)
};

export type ConvState = {
  chats: Record<string, Message[]>;
  groups: ChatGroup[];
  groupChats: Record<string, GroupMessage[]>;
  dmConv: Record<string, string>; // amigo → conversación
  convMeta: Record<string, ConvMeta>;
};

const me = () => useStore.getState().cloudUserId;

export function isMissingError(error: { message: string; code?: string } | null): boolean {
  return (
    !!error &&
    (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message))
  );
}

// ¿Está ya la base de datos nueva? (si no, la app usa las tablas antiguas)
export async function hasConversations(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  const { error } = await client.from('conversations').select('id').limit(1);
  return !isMissingError(error);
}

export function toDirectMessage(row: MsgRow, uid: string, meta: ConvMeta): Message {
  const mine = row.sender === uid;
  const read = mine ? meta.otherRead : meta.myRead;
  return {
    id: row.id,
    sender: row.sender ?? '',
    recipient: mine ? (meta.other ?? '') : uid,
    body: row.body,
    gameId: row.game_id,
    createdAt: row.created_at,
    readAt: read && read >= row.created_at ? read : null,
  };
}

export function toGroupMessage(row: MsgRow): GroupMessage {
  return {
    id: row.id,
    groupId: row.conversation_id,
    sender: row.sender ?? '',
    body: row.body,
    gameId: row.game_id,
    createdAt: row.created_at,
  };
}

// Todas tus conversaciones con sus últimos mensajes.
export async function loadConversations(): Promise<ConvState | null> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return null;
  const { data: mine, error } = await client
    .from('conversation_members')
    .select('conversation_id,profile_id,last_read_at,role')
    .eq('profile_id', uid);
  if (error) throw new Error(error.message);
  const ids = ((mine as MemberRow[]) ?? []).map((m) => m.conversation_id);
  const empty: ConvState = { chats: {}, groups: [], groupChats: {}, dmConv: {}, convMeta: {} };
  if (!ids.length) return empty;
  const [convs, members, msgs] = await Promise.all([
    client.from('conversations').select('id,kind,name,created_by,created_at').in('id', ids),
    client
      .from('conversation_members')
      .select('conversation_id,profile_id,last_read_at,role')
      .in('conversation_id', ids),
    client
      .from('messages')
      .select('id,conversation_id,sender,body,game_id,created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(800),
  ]);
  if (convs.error) throw new Error(convs.error.message);
  const memberRows = (members.data as MemberRow[] | null) ?? [];
  const out: ConvState = { ...empty, chats: {}, groupChats: {}, dmConv: {}, convMeta: {} };
  for (const c of (convs.data as ConvRow[] | null) ?? []) {
    const ms = memberRows.filter((m) => m.conversation_id === c.id);
    const myRow = ms.find((m) => m.profile_id === uid);
    const others = ms.filter((m) => m.profile_id !== uid);
    if (c.kind === 'direct') {
      const other = others[0]?.profile_id ?? null;
      out.convMeta[c.id] = {
        kind: 'direct',
        other,
        myRead: myRow?.last_read_at ?? '',
        otherRead: others[0]?.last_read_at ?? '',
      };
      if (other) out.dmConv[other] = c.id;
    } else {
      out.convMeta[c.id] = { kind: 'group', other: null, myRead: myRow?.last_read_at ?? '', otherRead: '' };
      out.groups.push({
        id: c.id,
        name: c.name ?? 'Grupo',
        createdBy: c.created_by ?? '',
        members: ms.map((m) => m.profile_id),
        lastReadAt: myRow?.last_read_at ?? '',
      });
      out.groupChats[c.id] = [];
    }
  }
  for (const row of ((msgs.data as MsgRow[] | null) ?? []).slice().reverse()) {
    const meta = out.convMeta[row.conversation_id];
    if (!meta) continue;
    if (meta.kind === 'direct' && meta.other) (out.chats[meta.other] ??= []).push(toDirectMessage(row, uid, meta));
    else if (meta.kind === 'group') (out.groupChats[row.conversation_id] ??= []).push(toGroupMessage(row));
  }
  const byDate = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
  for (const k of Object.keys(out.chats)) out.chats[k].sort(byDate);
  for (const k of Object.keys(out.groupChats)) out.groupChats[k].sort(byDate);
  return out;
}

async function saveGame(gameId: string | null | undefined) {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid || !gameId) return;
  const g = useStore.getState().games[gameId];
  if (g) await client.from('games').upsert(toGameRow(g, g.source === 'igdb' || g.source === 'rawg' ? null : uid));
}

export async function openDirect(otherId: string): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { data, error } = await client.rpc('open_direct_chat', { other: otherId });
  if (error) throw new Error(/amigos/i.test(error.message) ? 'Solo puedes escribir a tus amigos' : error.message);
  return data as string;
}

export async function postMessage(conversationId: string, body: string, gameId?: string | null): Promise<MsgRow> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) throw new Error('Necesitas conexión');
  await saveGame(gameId);
  const { data, error } = await client
    .from('messages')
    .insert({ conversation_id: conversationId, sender: uid, body: body.trim(), game_id: gameId ?? null })
    .select('id,conversation_id,sender,body,game_id,created_at')
    .single();
  if (error)
    throw new Error(error.message.includes('row-level security') ? 'Solo puedes escribir a tus amigos' : error.message);
  return data as MsgRow;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.rpc('mark_conversation_read', { cid: conversationId });
}

export async function createGroupConversation(name: string, members: string[]): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error('Necesitas conexión');
  const { data, error } = await client.rpc('create_group_chat', { p_name: name.trim(), p_members: members });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function addConversationMembers(conversationId: string, members: string[]): Promise<void> {
  const client = getSupabase();
  if (!client || !members.length) return;
  const { error } = await client.rpc('add_chat_members', { cid: conversationId, p_members: members });
  if (error) throw new Error(error.message);
}

export async function leaveConversation(conversationId: string): Promise<void> {
  const client = getSupabase();
  const uid = me();
  if (!client || !uid) return;
  await client.from('conversation_members').delete().eq('conversation_id', conversationId).eq('profile_id', uid);
}
