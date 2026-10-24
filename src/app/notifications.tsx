import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { answerChallenge, refreshChallenges } from '@/cloud/challenges';
import { acceptFriend, removeFriend, useSocial } from '@/cloud/social';
import { IgnScreen, timeAgo, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { dismissNotes, markNotesSeen, useNotesSeen, useNotifications, type Note } from '@/hooks/useNotifications';
import { notify } from '@/utils/notify';

function SmallButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const c = useIgnColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.small,
        {
          borderRadius: c.radius,
          backgroundColor: primary ? c.inverseBg : 'transparent',
          borderColor: primary ? c.inverseBg : c.line,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <ThemedText variant="bold" size={12} style={{ color: primary ? c.inverseText : c.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// Centro de avisos: aceptar o rechazar solicitudes y retos, y borrar avisos.
export default function NotificationsScreen() {
  const c = useIgnColors();
  const notes = useNotifications();
  const profiles = useSocial((s) => s.profiles);
  const [busy, setBusy] = useState<string | null>(null);
  // Lo que había sin ver al entrar se queda resaltado mientras estés aquí.
  const [seenBefore] = useState(() => useNotesSeen.getState().seenAt);
  useEffect(() => {
    refreshChallenges().catch(() => undefined);
    markNotesSeen().catch(() => undefined);
  }, []);

  const act = async (n: Note, accept: boolean) => {
    if (!n.ref) return;
    setBusy(n.id);
    try {
      if (n.kind === 'friend-request') {
        if (accept) await acceptFriend(n.ref);
        else await removeFriend(n.ref);
        notify(accept ? '¡Ahora sois amigos!' : 'Solicitud rechazada');
      } else if (n.kind === 'challenge') {
        await answerChallenge(n.ref, accept);
        notify(accept ? 'Reto aceptado' : 'Reto rechazado');
      }
      await dismissNotes([n.id]);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo');
    } finally {
      setBusy(null);
    }
  };

  return (
    <IgnScreen
      title="Avisos"
      back
      right={
        notes.length ? (
          <Pressable onPress={() => dismissNotes(notes.map((n) => n.id))} hitSlop={10} style={styles.clearAll}>
            <Ionicons name="trash-outline" size={18} color={c.text} />
            <ThemedText variant="bold" size={12}>
              Borrar todo
            </ThemedText>
          </Pressable>
        ) : null
      }
      contentStyle={{ paddingHorizontal: 20 }}
    >
      {notes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={44} color={c.muted} />
          <ThemedText variant="muted" size={14}>
            No tienes avisos.
          </ThemedText>
        </View>
      ) : null}
      {notes.map((n) => {
        const p = n.who ? profiles[n.who] : undefined;
        const fresh = n.at > seenBefore;
        const actionable = n.kind === 'friend-request' || n.kind === 'challenge';
        return (
          <View key={n.id} style={[styles.row, { borderBottomColor: c.line }]}>
            <Pressable onPress={() => router.push(n.href as never)} style={styles.main}>
              <View>
                {p ? (
                  <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={42} />
                ) : (
                  <Ionicons name={n.icon as never} size={30} color={c.text} />
                )}
                <View style={[styles.badge, { backgroundColor: c.accent }]}>
                  <Ionicons name={n.icon as never} size={11} color="#fff" />
                </View>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <ThemedText variant={fresh ? 'bold' : 'body'} size={14} numberOfLines={3}>
                  {n.text}
                </ThemedText>
                <ThemedText variant="muted" size={11}>
                  {timeAgo(n.at)}
                </ThemedText>
                {actionable ? (
                  <View style={styles.actions}>
                    <SmallButton label={busy === n.id ? '…' : 'Aceptar'} primary onPress={() => busy || act(n, true)} />
                    <SmallButton label="Rechazar" onPress={() => busy || act(n, false)} />
                  </View>
                ) : null}
              </View>
            </Pressable>
            <View style={styles.side}>
              {fresh ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
              <Pressable
                onPress={() => dismissNotes([n.id])}
                hitSlop={10}
                accessibilityLabel="Borrar aviso"
                style={styles.close}
              >
                <Ionicons name="close" size={18} color={c.muted} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  side: { alignItems: 'center', gap: 8 },
  close: { padding: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  small: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  clearAll: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
