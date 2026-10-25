import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { useCards } from '@/cloud/cards';
import { useChallenges } from '@/cloud/challenges';
import { groupUnread, useSocial } from '@/cloud/social';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';

// Avisos de la app: solicitudes, mensajes, reacciones, retos… (se calculan con lo que ya hay).
export type Note = {
  id: string;
  at: string;
  icon: string;
  text: string;
  who?: string; // perfil
  href: string;
  kind?: 'friend-request' | 'challenge';
  ref?: string; // a quién aceptar / qué reto
};

const SEEN_KEY = 'notes:seenAt';
const DISMISSED_KEY = 'notes:dismissed';
export const useNotesSeen = create<{ seenAt: string; loaded: boolean; dismissed: string[] }>(() => ({
  seenAt: '',
  loaded: false,
  dismissed: [],
}));

export async function loadNotesSeen() {
  const [v, d] = await Promise.all([
    AsyncStorage.getItem(SEEN_KEY).catch(() => null),
    AsyncStorage.getItem(DISMISSED_KEY).catch(() => null),
  ]);
  let dismissed: string[] = [];
  try {
    dismissed = d ? (JSON.parse(d) as string[]) : [];
  } catch {
    dismissed = [];
  }
  useNotesSeen.setState({ seenAt: v ?? '', loaded: true, dismissed });
}

// Borrar avisos (se recuerdan los borrados; se guardan los últimos 500).
export async function dismissNotes(ids: string[]) {
  const dismissed = [...new Set([...useNotesSeen.getState().dismissed, ...ids])].slice(-500);
  useNotesSeen.setState({ dismissed });
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed)).catch(() => undefined);
}
export async function markNotesSeen() {
  const now = new Date().toISOString();
  useNotesSeen.setState({ seenAt: now });
  await AsyncStorage.setItem(SEEN_KEY, now).catch(() => undefined);
}

export function useNotifications(): Note[] {
  const uid = useStore((s) => s.cloudUserId);
  const { friendships, profiles, chats, reactions, groups, groupChats, games } = useSocial(
    useShallow((s) => ({
      friendships: s.friendships,
      profiles: s.profiles,
      chats: s.chats,
      reactions: s.reactions,
      groups: s.groups,
      groupChats: s.groupChats,
      games: s.games,
    })),
  );
  const localGames = useStore((s) => s.games);
  const challenges = useChallenges((s) => s.list);
  const dismissed = useNotesSeen((s) => s.dismissed);
  const trades = useCards((s) => s.trades);
  useEffect(() => {
    if (!useNotesSeen.getState().loaded) loadNotesSeen().catch(() => undefined);
  }, []);
  return useMemo(() => {
    if (!uid) return [];
    const name = (id: string) => profiles[id]?.displayName ?? 'Alguien';
    const title = (gid: string) => localGames[gid]?.title ?? games[gid]?.title ?? 'un juego';
    const out: Note[] = [];
    for (const f of friendships) {
      if (f.status === 'pending' && f.addressee === uid) {
        out.push({
          id: `fr-${f.requester}-${f.createdAt}`,
          at: f.createdAt,
          icon: 'person-add',
          text: `${name(f.requester)} quiere ser tu amigo`,
          who: f.requester,
          href: `/user/${f.requester}`,
          kind: 'friend-request',
          ref: f.requester,
        });
      }
      if (f.status === 'accepted' && f.requester === uid && f.acceptedAt) {
        out.push({
          id: `fa-${f.addressee}`,
          at: f.acceptedAt,
          icon: 'people',
          text: `${name(f.addressee)} ha aceptado tu solicitud`,
          who: f.addressee,
          href: `/user/${f.addressee}`,
        });
      }
    }
    for (const [other, ms] of Object.entries(chats)) {
      const unread = ms.filter((m) => m.recipient === uid && !m.readAt);
      if (unread.length) {
        const last = unread[unread.length - 1];
        out.push({
          id: `dm-${other}-${last.id}`,
          at: last.createdAt,
          icon: last.gameId ? 'game-controller' : 'chatbubble',
          text: last.gameId
            ? `${name(other)} te recomienda ${title(last.gameId)}`
            : `${name(other)}: ${last.body}${unread.length > 1 ? ` (+${unread.length - 1})` : ''}`,
          who: other,
          href: `/chat/${other}`,
        });
      }
    }
    for (const g of groups) {
      const n = groupUnread(g, groupChats[g.id], uid);
      const ms = groupChats[g.id] ?? [];
      const last = ms[ms.length - 1];
      if (n && last)
        out.push({
          id: `gr-${g.id}-${last.id}`,
          at: last.createdAt,
          icon: 'people-circle',
          text: `${g.name}: ${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
          who: last.sender,
          href: `/group/${g.id}`,
        });
    }
    for (const r of reactions) {
      if (r.targetProfile === uid && r.profileId !== uid) {
        out.push({
          id: `re-${r.profileId}-${r.gameId}-${r.emoji}-${r.createdAt}`,
          at: r.createdAt,
          icon: 'happy',
          text: `${name(r.profileId)} ha reaccionado ${r.emoji} a ${title(r.gameId)}`,
          who: r.profileId,
          href: `/game/${encodeURIComponent(r.gameId)}`,
        });
      }
    }
    for (const ch of challenges) {
      const me = ch.members.find((m) => m.profileId === uid);
      if (me && !me.accepted) {
        out.push({
          id: `ch-${ch.id}`,
          at: ch.createdAt,
          icon: 'trophy',
          text: `${name(ch.creator)} te reta: ${ch.title}`,
          who: ch.creator,
          href: `/challenge/${ch.id}`,
          kind: 'challenge',
          ref: ch.id,
        });
      }
      for (const m of ch.members) {
        if (m.finishedAt && m.profileId !== uid && me?.accepted) {
          out.push({
            id: `cw-${ch.id}-${m.profileId}`,
            at: m.finishedAt,
            icon: 'flag',
            text: `${name(m.profileId)} ha cumplido el reto «${ch.title}»`,
            who: m.profileId,
            href: `/challenge/${ch.id}`,
          });
        }
      }
    }
    for (const t of trades) {
      if (t.status === 'pending' && t.to === uid)
        out.push({
          id: `ct-${t.id}`,
          at: t.createdAt,
          icon: 'swap-horizontal',
          text: `${name(t.from)} te propone un intercambio de cromos`,
          who: t.from,
          href: '/cards/trades',
        });
    }
    const gone = new Set(dismissed);
    return out
      .filter((n) => !gone.has(n.id))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80);
  }, [
    uid,
    friendships,
    profiles,
    chats,
    reactions,
    groups,
    groupChats,
    games,
    localGames,
    challenges,
    dismissed,
    trades,
  ]);
}

export function useUnreadNotifications(): number {
  const notes = useNotifications();
  const seenAt = useNotesSeen((s) => s.seenAt);
  return notes.filter((n) => n.at > seenAt).length;
}
