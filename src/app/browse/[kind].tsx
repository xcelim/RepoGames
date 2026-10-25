import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { IgnScreen } from '@/components/ign';
import { ListCard } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { OFFICIAL_LISTS } from '@/data/catalog';
import { useCommunityLists, useListCount, useProfileLookup } from '@/hooks/useLists';

const META = {
  featured: {
    title: 'Listas destacadas',
    subtitle: 'Los canónicos de cada saga en su mejor versión, elegidos por Saga Quest.',
  },
  community: {
    title: 'Listas de la comunidad',
    subtitle: 'Listas públicas de otros jugadores. Añádelas a tu perfil para seguirlas.',
  },
} as const;

// Un apartado de listas a pantalla completa (desde «Ver todo» en Descubrir).
export default function BrowseListsScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const k: keyof typeof META = kind === 'community' ? 'community' : 'featured';
  const { width } = useWindowDimensions();
  const community = useCommunityLists();
  const count = useListCount();
  const lookup = useProfileLookup();
  const lists = k === 'featured' ? OFFICIAL_LISTS : community;
  const cols = Math.max(2, Math.floor((width - 40 + 12) / (300 + 12)));
  const cardW = (width - 40 - 12 * (cols - 1)) / cols;
  return (
    <IgnScreen title={META[k].title} back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <ThemedText variant="muted" size={13}>
        {META[k].subtitle}
      </ThemedText>
      <View style={styles.grid}>
        {lists.map((list) => (
          <View key={list.id} style={{ width: cardW }}>
            <ListCard
              list={list}
              count={count(list.id)}
              subtitle={k === 'community' ? `de ${lookup(list.ownerId)?.displayName ?? 'un jugador'}` : undefined}
            />
          </View>
        ))}
      </View>
      {!lists.length ? (
        <ThemedText variant="muted" size={14}>
          Aún no hay listas aquí.
        </ThemedText>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
