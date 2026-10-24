import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { refreshChallenges } from '@/cloud/challenges';
import { useSocial } from '@/cloud/social';
import { IgnScreen, timeAgo, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { markNotesSeen, useNotesSeen, useNotifications } from '@/hooks/useNotifications';

// Centro de avisos.
export default function NotificationsScreen() {
  const c = useIgnColors();
  const notes = useNotifications();
  const profiles = useSocial((s) => s.profiles);
  // Lo que había sin ver al entrar se queda resaltado mientras estés aquí.
  const [seenBefore] = useState(() => useNotesSeen.getState().seenAt);
  useEffect(() => {
    refreshChallenges().catch(() => undefined);
    markNotesSeen().catch(() => undefined);
  }, []);
  return (
    <IgnScreen title="Avisos" back contentStyle={{ paddingHorizontal: 20 }}>
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
        return (
          <Pressable
            key={n.id}
            onPress={() => router.push(n.href as never)}
            style={[styles.row, { borderBottomColor: c.line }]}
          >
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
            <View style={{ flex: 1 }}>
              <ThemedText variant={fresh ? 'bold' : 'body'} size={14} numberOfLines={3}>
                {n.text}
              </ThemedText>
              <ThemedText variant="muted" size={11}>
                {timeAgo(n.at)}
              </ThemedText>
            </View>
            {fresh ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
          </Pressable>
        );
      })}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
