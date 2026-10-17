import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { EmptyState, type IconName } from '@/components/ui';
import { useGame, useMyLists } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';

// Elegir en qué listas está un juego.
export default function PickListScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const id = decodeURIComponent(gameId ?? '');
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const game = useGame(id);
  const myLists = useMyLists();
  const items = useStore((s) => s.items);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);

  const containing = useMemo(
    () => new Set(Object.values(items).filter((i) => i.gameId === id).map((i) => i.listId)),
    [items, id],
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader close title={game ? `«${game.title}» en…` : 'Añadir a lista'} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Button
          label="+ Nueva lista con este juego"
          onPress={() => router.push(`/list/edit?addGame=${encodeURIComponent(id)}`)}
        />
        {myLists.length === 0 ? (
          <EmptyState icon="folder-open-outline" title="No tienes listas todavía" />
        ) : (
          myLists.map((list) => {
            const inside = containing.has(list.id);
            return (
              <Pressable
                key={list.id}
                onPress={() => (inside ? removeFromList(list.id, id) : addToList(list.id, id))}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: skin.colors.panel,
                    borderColor: inside ? skin.colors.accent : skin.colors.line,
                    borderRadius: Math.min(skin.radius, 14),
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: list.color }]}>
                  <Ionicons name={list.icon as IconName} size={18} color="#fff" />
                </View>
                <View style={styles.flex}>
                  <ThemedText variant="bold">{list.name}</ThemedText>
                  <ThemedText variant="muted" size={12}>
                    {list.visibility === 'public' ? 'Pública' : 'Privada'}
                  </ThemedText>
                </View>
                <Ionicons
                  name={inside ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={inside ? skin.colors.accent : skin.colors.muted}
                />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
