import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addGroupMembers,
  leaveGroup,
  markGroupRead,
  sendGroupMessage,
  useChatPolling,
  useSocial,
  type GroupMessage,
} from '@/cloud/social';
import { PersonRow } from '@/components/PersonRow';
import { Avatar } from '@/components/ui';
import { GameCover } from '@/components/games';
import { Sheet, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { notify } from '@/utils/notify';
import { goBack } from '@/utils/nav';

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
};

// Chat de grupo, en tiempo real.
export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const c = useIgnColors();
  useChatPolling();
  const insets = useSafeAreaInsets();
  const uid = useStore((s) => s.cloudUserId);
  const localGames = useStore((s) => s.games);
  const group = useSocial((s) => s.groups.find((g) => g.id === groupId));
  const profiles = useSocial((s) => s.profiles);
  const friendships = useSocial((s) => s.friendships);
  const remoteGames = useSocial((s) => s.games);
  const messages = useSocial((s) => s.groupChats[groupId]);
  const state = group ? 'friends' : 'none';
  const [info, setInfo] = useState(false);
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    markGroupRead(groupId).catch(() => undefined);
  }, [groupId, messages?.length]);

  // Lista invertida: lo más nuevo abajo. Con separadores de día.
  const rows = useMemo(() => {
    const list = messages ?? [];
    const out: ({ kind: 'msg'; m: GroupMessage } | { kind: 'day'; label: string; key: string })[] = [];
    list.forEach((m, i) => {
      const prev = list[i - 1];
      if (!prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()) {
        out.push({ kind: 'day', label: dayLabel(m.createdAt), key: `d-${m.createdAt}` });
      }
      out.push({ kind: 'msg', m });
    });
    return out.reverse();
  }, [messages]);

  const send = (gameId?: string) => {
    const body = gameId ? '' : text;
    if (!gameId) setText('');
    sendGroupMessage(groupId, body, gameId).catch((e: unknown) =>
      notify(e instanceof Error ? e.message : 'No se pudo enviar'),
    );
  };

  const gameOf = (gid: string): GameRecord | undefined => localGames[gid] ?? remoteGames[gid];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      // En Android (pantalla de borde a borde) el sistema ya no encoge la ventana: hay que subir el chat a mano.
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: c.line, backgroundColor: c.bg }]}>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Pressable onPress={() => setInfo(true)} style={styles.who}>
          <Ionicons name="people-circle" size={36} color={c.accent} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={16} numberOfLines={1}>
              {group?.name ?? '…'}
            </ThemedText>
            {group ? (
              <ThemedText variant="muted" size={11} numberOfLines={1}>
                {group.members.map((p) => (p === uid ? 'Tú' : (profiles[p]?.displayName ?? '?'))).join(', ')}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      </View>

      {state !== 'friends' ? (
        <View style={styles.notFriends}>
          <ThemedText variant="muted" size={13} style={{ textAlign: 'center' }}>
            Ya no estás en este grupo.
          </ThemedText>
        </View>
      ) : null}

      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => (r.kind === 'day' ? r.key : r.m.id)}
        contentContainerStyle={{ padding: 14, gap: 6 }}
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <ThemedText variant="muted" size={11} style={styles.day}>
                {item.label}
              </ThemedText>
            );
          }
          const m = item.m;
          const mine = m.sender === uid;
          const game = m.gameId ? gameOf(m.gameId) : undefined;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {!mine ? (
                <View style={styles.senderRow}>
                  {profiles[m.sender] ? (
                    <Avatar
                      name={profiles[m.sender].displayName}
                      color={profiles[m.sender].avatarColor}
                      uri={profiles[m.sender].photo}
                      size={18}
                    />
                  ) : null}
                  <ThemedText variant="bold" size={11} style={{ color: profiles[m.sender]?.avatarColor ?? c.muted }}>
                    {profiles[m.sender]?.displayName ?? 'Jugador'}
                  </ThemedText>
                </View>
              ) : null}
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: c.accent, borderBottomRightRadius: 4 }
                    : {
                        backgroundColor: c.card,
                        borderBottomLeftRadius: 4,
                        borderColor: c.line,
                        borderWidth: StyleSheet.hairlineWidth,
                      },
                  { opacity: m.pending ? 0.6 : 1 },
                ]}
              >
                {game ? (
                  <Pressable onPress={() => router.push(`/game/${encodeURIComponent(game.id)}`)} style={styles.gameMsg}>
                    <GameCover game={game} width={64} radius={6} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText
                        variant="muted"
                        size={10}
                        style={{ color: mine ? '#ffffffcc' : c.muted, letterSpacing: 0.6 }}
                      >
                        COMPARTE
                      </ThemedText>
                      <ThemedText variant="bold" size={14} style={{ color: mine ? '#fff' : c.text }} numberOfLines={2}>
                        {game.title}
                      </ThemedText>
                      {game.year ? (
                        <ThemedText size={11} style={{ color: mine ? '#ffffffcc' : c.muted }}>
                          {game.year}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                ) : null}
                {m.body ? (
                  <ThemedText size={15} style={{ color: mine ? '#fff' : c.text }}>
                    {m.body}
                  </ThemedText>
                ) : null}
                <ThemedText
                  size={10}
                  style={{ color: mine ? '#ffffffaa' : c.muted, alignSelf: 'flex-end', marginTop: 2 }}
                >
                  {hhmm(m.createdAt)}
                </ThemedText>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <ThemedText variant="muted" size={13} style={[styles.day, { transform: [{ scaleY: -1 }] }]}>
            Saluda al grupo 👋 o comparte un juego.
          </ThemedText>
        }
      />

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: c.line, backgroundColor: c.bg },
        ]}
      >
        <Pressable
          onPress={() => setPicking(true)}
          disabled={state !== 'friends'}
          hitSlop={8}
          accessibilityLabel="Mandar un juego"
        >
          <Ionicons name="game-controller-outline" size={26} color={state === 'friends' ? c.text : c.line} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe al grupo…"
          placeholderTextColor={c.muted}
          editable={state === 'friends'}
          multiline
          maxLength={2000}
          style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.line }]}
        />
        <Pressable
          onPress={() => send()}
          disabled={!text.trim() || state !== 'friends'}
          style={[styles.send, { backgroundColor: text.trim() ? c.accent : c.soft }]}
          accessibilityLabel="Enviar"
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      {info && group ? (
        <GroupInfo
          members={group.members}
          friends={friendships
            .filter((f) => f.status === 'accepted')
            .map((f) => (f.requester === uid ? f.addressee : f.requester))}
          onAdd={(ids) =>
            addGroupMembers(groupId, ids).catch((e: unknown) => notify(e instanceof Error ? e.message : 'No se pudo'))
          }
          onLeave={() => leaveGroup(groupId).then(() => goBack())}
          onClose={() => setInfo(false)}
        />
      ) : null}
      {picking ? (
        <GamePicker
          onPick={(g) => {
            setPicking(false);
            send(g.id);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function GroupInfo({
  members,
  friends,
  onAdd,
  onLeave,
  onClose,
}: {
  members: string[];
  friends: string[];
  onAdd: (ids: string[]) => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const c = useIgnColors();
  const profiles = useSocial((s) => s.profiles);
  const candidates = friends.filter((f) => !members.includes(f));
  return (
    <Sheet visible title="Miembros" onClose={onClose}>
      {members.map((pid) => (
        <PersonRow key={pid} profile={profiles[pid]} />
      ))}
      {candidates.length ? (
        <ThemedText variant="bold" size={13} style={{ marginTop: 12 }}>
          Añadir amigos
        </ThemedText>
      ) : null}
      {candidates.map((pid) => (
        <PersonRow key={pid} profile={profiles[pid]} onPress={() => onAdd([pid])}>
          <Ionicons name="add-circle-outline" size={24} color={c.text} />
        </PersonRow>
      ))}
      <Pressable onPress={onLeave} style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ThemedText variant="bold" size={14} style={{ color: '#e5484d' }}>
          Salir del grupo
        </ThemedText>
      </Pressable>
    </Sheet>
  );
}

// Elegir un juego de tu biblioteca para mandárselo.
function GamePicker({ onPick, onClose }: { onPick: (g: GameRecord) => void; onClose: () => void }) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const [q, setQ] = useState('');
  const mine = useMemo(
    () =>
      Object.values(userGames)
        .filter((u) => u.profileId === profileId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((u) => games[u.gameId])
        .filter((g): g is GameRecord => !!g),
    [userGames, games, profileId],
  );
  const shown = q.trim() ? rankByQuery(q, mine, (g) => g.title) : mine;
  return (
    <Sheet visible title="Mandar un juego" onClose={onClose}>
      <TextField value={q} onChangeText={setQ} placeholder="Buscar en tu biblioteca…" />
      {shown.slice(0, 50).map((g) => (
        <Pressable key={g.id} onPress={() => onPick(g)} style={[styles.pick, { borderBottomColor: c.line }]}>
          <GameCover game={g} width={36} radius={4} />
          <ThemedText size={14} style={{ flex: 1 }} numberOfLines={1}>
            {g.title}
          </ThemedText>
          <Ionicons name="send-outline" size={18} color={c.muted} />
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, marginLeft: 4 },
  notFriends: { alignItems: 'center', gap: 10, padding: 16 },
  day: { alignSelf: 'center', marginVertical: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, gap: 6 },
  gameMsg: { flexDirection: 'row', gap: 10, alignItems: 'center', minWidth: 200 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
