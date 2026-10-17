import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ListCard, SectionTitle } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { EmptyState, IconButton } from '@/components/ui';
import { OFFICIAL_LISTS } from '@/data/catalog';
import { FINISHED } from '@/data/meta';
import { useRemote } from '@/cloud/remote';
import { useMyLists, useProfileLookup } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import type { GameList } from '@/types';
import { userGameKey } from '@/utils/library';

export default function ListsScreen() {
  const insets = useSafeAreaInsets();
  const myLists = useMyLists();
  const profileId = useStore((s) => s.currentProfileId);
  const items = useStore((s) => s.items);
  const userGames = useStore((s) => s.userGames);
  const lists = useStore((s) => s.lists);
  const follows = useStore((s) => (s.currentProfileId ? s.follows[s.currentProfileId] : undefined));
  const remote = useRemote((s) => s.lists);
  const remoteItems = useRemote((s) => s.items);
  const lookupProfile = useProfileLookup();

  // Juegos y terminados de cada lista, para la barra de progreso.
  const progress = useMemo(() => {
    const result: Record<string, { count: number; done: number }> = {};
    const all = [...Object.values(items), ...Object.values(remoteItems)];
    for (const item of all) {
      const entry = (result[item.listId] ??= { count: 0, done: 0 });
      entry.count += 1;
      const ug = profileId ? userGames[userGameKey(profileId, item.gameId)] : undefined;
      if (ug && FINISHED.includes(ug.status)) entry.done += 1;
    }
    return result;
  }, [items, remoteItems, userGames, profileId]);

  const followed: GameList[] = (follows ?? [])
    .map((id) => lists[id] ?? OFFICIAL_LISTS.find((l) => l.id === id) ?? remote[id])
    .filter((l): l is GameList => !!l);

  const card = (list: GameList, showOwner: boolean) => {
    const p = progress[list.id] ?? { count: 0, done: 0 };
    return (
      <View key={list.id} style={styles.half}>
        <ListCard
          list={list}
          count={p.count}
          progress={p.count > 0 ? p.done / p.count : 0}
          subtitle={`${p.count} juegos · ${p.done} terminados${
            showOwner ? ` · ${lookupProfile(list.ownerId)?.displayName ?? ''}` : ''
          }`}
        />
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <View style={styles.titleRow}>
        <ThemedText variant="display" size={32} style={styles.flex}>
          Listas
        </ThemedText>
        <IconButton icon="add" label="Nueva lista" filled onPress={() => router.push('/list/edit')} />
      </View>
      <ThemedText variant="muted" size={13}>
        Tus bibliotecas son carpetas: ordénalas a mano, filtra por nota o plataforma y decide si son
        públicas o privadas.
      </ThemedText>

      <SectionTitle title={`Mis listas (${myLists.length})`} />
      {myLists.length === 0 ? (
        <EmptyState icon="folder-open-outline" title="Aún no tienes listas">
          <Button label="Crear lista" onPress={() => router.push('/list/edit')} />
        </EmptyState>
      ) : (
        <View style={styles.grid}>{myLists.map((list) => card(list, false))}</View>
      )}

      <SectionTitle title={`Siguiendo (${followed.length})`} />
      {followed.length === 0 ? (
        <ThemedText variant="muted" size={13}>
          Sigue listas públicas desde Inicio para tenerlas aquí sin copiarlas.
        </ThemedText>
      ) : (
        <View style={styles.grid}>{followed.map((list) => card(list, true))}</View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { width: '47.5%' },
});
