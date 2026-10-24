import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Profile } from '@/types';

import { useIgnColors } from './ign';
import { LevelBadge } from './LevelBadge';
import { ThemedText } from './ThemedText';
import { UserAvatar } from './UserAvatar';

export function PersonRow({
  profile,
  onPress,
  children,
}: {
  profile?: Profile;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const c = useIgnColors();
  if (!profile) return null;
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/user/${profile.id}`))}
      style={[styles.row, { borderBottomColor: c.line }]}
    >
      <UserAvatar profile={profile} size={46} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <ThemedText variant="bold" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>
            {profile.displayName}
          </ThemedText>
          {profile.level != null ? <LevelBadge level={profile.level} size={22} /> : null}
        </View>
        <ThemedText variant="muted" size={12}>
          @{profile.username}
        </ThemedText>
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
