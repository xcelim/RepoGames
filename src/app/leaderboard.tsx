import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSocial } from '@/cloud/social';
import { Card, IgnScreen, ProgressBar, useIgnColors } from '@/components/ign';
import { LevelBadge } from '@/components/LevelBadge';
import { ThemedText } from '@/components/ThemedText';
import { UserAvatar } from '@/components/UserAvatar';
import { useLevel } from '@/hooks/useLevel';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { Profile } from '@/types';
import { levelColor, levelFromXp } from '@/utils/level';

const MEDALS = ['🥇', '🥈', '🥉'];

// Clasificación de nivel entre tus amigos.
export default function LeaderboardScreen() {
  const c = useIgnColors();
  const uid = useStore((s) => s.cloudUserId);
  const me = useCurrentProfile();
  const lv = useLevel();
  const { friendships, profiles } = useSocial();
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => profiles[f.requester === uid ? f.addressee : f.requester])
    .filter((p): p is Profile => !!p);
  const people = [...(me ? [{ ...me, level: lv.level, xp: lv.xp }] : []), ...friends].sort(
    (a, b) => (b.xp ?? 0) - (a.xp ?? 0) || (b.level ?? 0) - (a.level ?? 0),
  );
  const top = people[0]?.xp ?? 1;

  return (
    <IgnScreen title="Clasificación" back contentStyle={{ paddingHorizontal: 20, gap: 12 }}>
      <ThemedText variant="muted" size={13}>
        Tú y tus amigos ordenados por experiencia. ¡Termina juegos y consigue platinos para subir!
      </ThemedText>
      {people.map((p, i) => {
        const l = levelFromXp(p.xp ?? 0);
        const isMe = p.id === me?.id;
        return (
          <Pressable key={p.id} onPress={() => router.push(isMe ? '/level' : `/user/${p.id}`)}>
            <Card style={[styles.row, isMe ? { borderColor: c.accent, borderWidth: 2 } : null]}>
              <ThemedText variant="display" size={20} style={{ width: 30, textAlign: 'center' }}>
                {MEDALS[i] ?? i + 1}
              </ThemedText>
              <UserAvatar profile={p} size={i === 0 ? 52 : 44} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.top}>
                  <ThemedText variant="bold" size={15} numberOfLines={1} style={{ flex: 1 }}>
                    {isMe ? 'Tú' : p.displayName}
                  </ThemedText>
                  <LevelBadge level={p.level ?? l.level} size={26} />
                </View>
                <ProgressBar
                  pct={((p.xp ?? 0) / Math.max(1, top)) * 100}
                  height={5}
                  color={levelColor(p.level ?? l.level)}
                />
                <ThemedText variant="muted" size={11}>
                  {(p.xp ?? 0).toLocaleString('es-ES')} XP
                </ThemedText>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {friends.length === 0 ? (
        <ThemedText variant="muted" size={13}>
          Añade amigos para competir con ellos.
        </ThemedText>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
