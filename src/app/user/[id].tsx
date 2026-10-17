import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListCard, ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, EmptyState, StatTile } from '@/components/ui';
import { useRemote } from '@/cloud/remote';
import { OFFICIAL_LISTS, OFFICIAL_PROFILE_ID } from '@/data/catalog';
import { FINISHED } from '@/data/meta';
import { useListCount, useProfileLookup } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const profile = useProfileLookup()(id);
  const lists = useStore((s) => s.lists);
  const remoteLists = useRemote((s) => s.lists);
  const userGames = useStore((s) => s.userGames);
  const countOf = useListCount();

  const publicLists = useMemo(() => {
    if (id === OFFICIAL_PROFILE_ID) return OFFICIAL_LISTS;
    return [...Object.values(lists), ...Object.values(remoteLists)].filter(
      (l) => l.ownerId === id && l.visibility === 'public',
    );
  }, [id, lists, remoteLists]);

  const theirGames = Object.values(userGames).filter((g) => g.profileId === id);
  const finished = theirGames.filter((g) => FINISHED.includes(g.status)).length;

  if (!profile) {
    return (
      <View style={styles.flex}>
        <ScreenHeader back />
        <EmptyState icon="person-outline" title="Usuario no encontrado" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader back title={`@${profile.username}`} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.head}>
          <Avatar name={profile.displayName} color={profile.avatarColor} size={72} />
          <View style={styles.flex}>
            <ThemedText variant="display" size={26}>
              {profile.displayName}
            </ThemedText>
            <ThemedText variant="muted">@{profile.username}</ThemedText>
          </View>
        </View>
        {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
        <View style={styles.tiles}>
          <StatTile value={String(publicLists.length)} label="Listas públicas" />
          {theirGames.length > 0 ? (
            <>
              <StatTile value={String(theirGames.length)} label="Juegos" />
              <StatTile value={String(finished)} label="Terminados" />
            </>
          ) : null}
        </View>
        {publicLists.length === 0 ? (
          <EmptyState icon="lock-closed-outline" title="Sin listas públicas" />
        ) : (
          <View style={styles.grid}>
            {publicLists.map((list) => (
              <View key={list.id} style={styles.half}>
                <ListCard list={list} count={countOf(list.id)} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { width: '47.5%' },
});
