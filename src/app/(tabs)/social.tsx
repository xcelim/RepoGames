import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  acceptFriend,
  refreshActivity,
  refreshFriends,
  refreshInbox,
  removeFriend,
  useSocial,
  type Message,
} from '@/cloud/social';
import { GameCover } from '@/components/games';
import { Card, DarkButton, HeaderIcon, IgnScreen, LightButton, timeAgo, useIgnColors } from '@/components/ign';
import { OfflineGate } from '@/components/offline';
import { Segmented } from '@/components/Segmented';
import { ThemedText } from '@/components/ThemedText';
import { PersonRow } from '@/components/PersonRow';
import { UserAvatar } from '@/components/UserAvatar';
import { STATUS_META } from '@/data/meta';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';

type Tab = 'chats' | 'activity' | 'friends';

function SocialInner() {
  const c = useIgnColors();
  const uid = useStore((s) => s.cloudUserId);
  const localGames = useStore((s) => s.games);
  const { ready, missingTables, friendships, profiles, chats, activity, games } = useSocial();
  const [tab, setTab] = useState<Tab>('chats');
  const [busy, setBusy] = useState(false);

  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester === uid ? f.addressee : f.requester));
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee === uid).map((f) => f.requester);
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester === uid).map((f) => f.addressee);
  const gameOf = (id: string): GameRecord | undefined => localGames[id] ?? games[id];

  const convos = useMemo(
    () =>
      Object.entries(chats)
        .map(([other, ms]) => ({
          other,
          last: ms[ms.length - 1],
          unread: ms.filter((m) => m.recipient === uid && !m.readAt).length,
        }))
        .filter((x) => x.last)
        .sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt)),
    [chats, uid],
  );

  const reload = async () => {
    setBusy(true);
    try {
      await refreshFriends();
      await Promise.all([refreshInbox(), refreshActivity()]);
    } finally {
      setBusy(false);
    }
  };

  if (ready && missingTables) {
    return (
      <IgnScreen title="Amigos">
        <Card style={{ marginHorizontal: 20, gap: 10 }}>
          <ThemedText variant="bold" size={15}>
            Falta preparar la base de datos
          </ThemedText>
          <ThemedText variant="muted" size={13}>
            Para usar amigos y chat hay que ejecutar una vez el SQL «2026-10-24-social.sql» en Supabase (SQL Editor →
            Run). Después pulsa «Reintentar».
          </ThemedText>
          <DarkButton label={busy ? 'Comprobando…' : 'Reintentar'} disabled={busy} onPress={reload} />
        </Card>
      </IgnScreen>
    );
  }

  const unreadTotal = convos.reduce((n, x) => n + x.unread, 0);

  return (
    <IgnScreen
      title="Amigos"
      right={
        <>
          <HeaderIcon icon="refresh" label="Actualizar" onPress={reload} />
          <HeaderIcon icon="person-add-outline" label="Añadir amigos" onPress={() => router.push('/friends')} />
        </>
      }
    >
      <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'chats', label: unreadTotal ? `Chats (${unreadTotal})` : 'Chats' },
            { value: 'activity', label: 'Actividad' },
            { value: 'friends', label: incoming.length ? `Amigos (${incoming.length})` : 'Amigos' },
          ]}
        />
      </View>

      {tab === 'chats' ? (
        <View style={styles.section}>
          {convos.length === 0 ? (
            <Empty
              icon="chatbubbles-outline"
              text={
                friends.length
                  ? 'Aún no has hablado con nadie. Abre un amigo y escríbele.'
                  : 'Añade amigos para chatear con ellos.'
              }
              action={friends.length ? undefined : { label: 'Buscar amigos', onPress: () => router.push('/friends') }}
            />
          ) : (
            convos.map(({ other, last, unread }) => {
              const p = profiles[other];
              return (
                <Pressable
                  key={other}
                  onPress={() => router.push(`/chat/${other}`)}
                  style={[styles.row, { borderBottomColor: c.line }]}
                >
                  {p ? <UserAvatar profile={p} size={48} /> : <View style={{ width: 48 }} />}
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <ThemedText variant="bold" size={15} numberOfLines={1} style={{ flex: 1 }}>
                        {p?.displayName ?? 'Jugador'}
                      </ThemedText>
                      <ThemedText variant="muted" size={11}>
                        {timeAgo(last.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText variant={unread ? 'bold' : 'muted'} size={13} numberOfLines={1}>
                      {preview(last, uid, gameOf)}
                    </ThemedText>
                  </View>
                  {unread ? (
                    <View style={[styles.dot, { backgroundColor: c.accent }]}>
                      <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
                        {unread}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      {tab === 'activity' ? (
        <View style={styles.section}>
          {activity.length === 0 ? (
            <Empty
              icon="pulse-outline"
              text={friends.length ? 'Tus amigos aún no han movido nada.' : 'Aquí verás lo que juegan tus amigos.'}
            />
          ) : (
            activity.map(({ ug, at }) => {
              const p = profiles[ug.profileId];
              const g = gameOf(ug.gameId);
              if (!p || !g) return null;
              return (
                <Pressable
                  key={`${ug.profileId}-${ug.gameId}`}
                  onPress={() => router.push(`/game/${encodeURIComponent(g.id)}`)}
                  style={[styles.row, { borderBottomColor: c.line }]}
                >
                  <Pressable onPress={() => router.push(`/user/${p.id}`)}>
                    <UserAvatar profile={p} size={40} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText size={14}>
                      <ThemedText variant="bold" size={14}>
                        {p.displayName}
                      </ThemedText>{' '}
                      {activityVerb(ug.status)}{' '}
                      <ThemedText variant="bold" size={14}>
                        {g.title}
                      </ThemedText>
                    </ThemedText>
                    <ThemedText variant="muted" size={11}>
                      {timeAgo(at)}
                      {ug.rating ? ` · le da un ${ug.rating}` : ''}
                    </ThemedText>
                    {ug.review && !ug.reviewPrivate ? (
                      <ThemedText variant="muted" size={12} numberOfLines={2} style={{ fontStyle: 'italic' }}>
                        “{ug.spoilers ? 'Reseña con spoilers' : ug.review}”
                      </ThemedText>
                    ) : null}
                  </View>
                  <GameCover game={g} width={44} radius={4} />
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      {tab === 'friends' ? (
        <View style={styles.section}>
          {incoming.length ? (
            <>
              <ThemedText variant="display" size={17} style={styles.h}>
                Solicitudes
              </ThemedText>
              {incoming.map((id) => (
                <PersonRow key={id} profile={profiles[id]}>
                  <Pressable
                    onPress={() => acceptFriend(id).catch(() => undefined)}
                    style={[styles.small, { backgroundColor: c.inverseBg }]}
                  >
                    <ThemedText variant="bold" size={12} style={{ color: c.inverseText }}>
                      Aceptar
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={() => removeFriend(id).catch(() => undefined)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={c.muted} />
                  </Pressable>
                </PersonRow>
              ))}
            </>
          ) : null}
          <ThemedText variant="display" size={17} style={styles.h}>
            {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
          </ThemedText>
          {friends.length === 0 ? (
            <Empty
              icon="people-outline"
              text="Busca a tus amigos por su @usuario."
              action={{ label: 'Buscar amigos', onPress: () => router.push('/friends') }}
            />
          ) : (
            friends.map((id) => (
              <PersonRow key={id} profile={profiles[id]} onPress={() => router.push(`/user/${id}`)}>
                <Pressable onPress={() => router.push(`/chat/${id}`)} hitSlop={8}>
                  <Ionicons name="chatbubble-outline" size={22} color={c.text} />
                </Pressable>
              </PersonRow>
            ))
          )}
          {outgoing.length ? (
            <>
              <ThemedText variant="display" size={17} style={styles.h}>
                Enviadas
              </ThemedText>
              {outgoing.map((id) => (
                <PersonRow key={id} profile={profiles[id]}>
                  <Pressable onPress={() => removeFriend(id).catch(() => undefined)} hitSlop={8}>
                    <ThemedText variant="muted" size={12} style={{ textDecorationLine: 'underline' }}>
                      Cancelar
                    </ThemedText>
                  </Pressable>
                </PersonRow>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </IgnScreen>
  );
}

function activityVerb(status: string): string {
  switch (status) {
    case 'playing':
      return 'está jugando a';
    case 'beaten':
      return 'ha terminado';
    case 'completed':
      return 'ha sacado al 100 %';
    case 'paused':
      return 'ha pausado';
    case 'dropped':
      return 'ha abandonado';
    case 'backlog':
      return 'tiene pendiente';
    case 'wishlist':
      return 'quiere';
    default:
      return 'ha añadido';
  }
}

function preview(m: Message, uid: string | null, gameOf: (id: string) => GameRecord | undefined): string {
  const mine = m.sender === uid ? 'Tú: ' : '';
  if (m.gameId) return `${mine}🎮 ${gameOf(m.gameId)?.title ?? 'Un juego'}${m.body ? ` · ${m.body}` : ''}`;
  return `${mine}${m.body}`;
}

function Empty({
  icon,
  text,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useIgnColors();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={c.muted} />
      <ThemedText variant="muted" size={14} style={{ textAlign: 'center' }}>
        {text}
      </ThemedText>
      {action ? <LightButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export default function SocialScreen() {
  return (
    <OfflineGate what="Amigos">
      <SocialInner />
    </OfflineGate>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  h: { marginTop: 14, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  small: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 20 },
});
