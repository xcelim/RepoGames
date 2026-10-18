import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DarkButton, HeaderIcon, IgnScreen, Mosaic, ProgressBar, useIgnColors } from '@/components/ign';
import { useOfflineMode } from '@/components/offline';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import {
  useCommunityLists,
  useFollowedLists,
  useListCount,
  useListPreview,
  useListProgress,
  useMyLists,
  useProfileLookup,
} from '@/hooks/useLists';
import type { GameList } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';

export default function ListsScreen() {
  const c = useIgnColors();
  const mine = useMyLists();
  const followed = useFollowedLists();
  const community = useCommunityLists();
  const preview = useListPreview();
  const count = useListCount();
  const lookup = useProfileLookup();
  const progress = useListProgress();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const offline = useOfflineMode();

  const found = useMemo(() => {
    if (!query.trim()) return [];
    const seen = new Set<string>();
    const all = [...mine, ...followed, ...community].filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
    return rankByQuery(query, all, (l) => l.name);
  }, [query, mine, followed, community]);

  const shownMine = showAll ? mine : mine.slice(0, 6);

  return (
    <IgnScreen
      title="Listas"
      right={
        <>
          <HeaderIcon icon="add-circle-outline" label="Nueva lista" onPress={() => router.push('/list/edit')} />
          {!offline ? (
            <HeaderIcon icon="download-outline" label="Importar lista" onPress={() => router.push('/list/import')} />
          ) : null}
          {!offline ? <HeaderIcon icon="search" label="Buscar listas" onPress={() => setSearching((s) => !s)} /> : null}
        </>
      }
    >
      {searching ? (
        <View style={styles.search}>
          <TextField value={query} onChangeText={setQuery} placeholder="Buscar listas…" autoFocus />
          {found.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              preview={preview(list.id)}
              count={count(list.id)}
              author={lookup(list.ownerId)?.displayName}
            />
          ))}
        </View>
      ) : null}

      <ThemedText variant="display" size={22} style={styles.h2}>
        Actualizadas recientemente
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {mine.slice(0, 10).map((list) => (
          <Pressable
            key={list.id}
            onPress={() => router.push(`/list/${list.id}`)}
            style={({ pressed }) => ({
              width: 150,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Mosaic list={list} games={preview(list.id)} size={150} />
            <ThemedText size={14} numberOfLines={2} style={{ marginTop: 8 }}>
              {list.name}
            </ThemedText>
            <View style={styles.tileProgress}>
              <View style={{ flex: 1 }}>
                <ProgressBar pct={progress(list.id).pct} height={4} />
              </View>
              <ThemedText variant="muted" size={11}>
                {progress(list.id).pct}%
              </ThemedText>
            </View>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push('/list/edit')}
          style={[styles.newTile, { borderColor: c.line, borderRadius: c.radius }]}
        >
          <Ionicons name="add" size={36} color={c.muted} />
          <ThemedText variant="muted" size={13}>
            Nueva lista
          </ThemedText>
        </Pressable>
      </ScrollView>

      <View
        style={[
          styles.card,
          {
            backgroundColor: c.card,
            borderRadius: c.radius + 6,
            borderColor: c.line,
          },
        ]}
      >
        <View style={styles.cardHead}>
          <ThemedText variant="display" size={20} style={{ flex: 1 }}>
            Mis listas
          </ThemedText>
          {mine.length > 6 ? (
            <Pressable onPress={() => setShowAll((s) => !s)} hitSlop={8}>
              <ThemedText variant="bold" size={13} style={{ textDecorationLine: 'underline' }}>
                {showAll ? 'Ver menos' : 'Ver todas'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {shownMine.map((list) => (
          <ListRow key={list.id} list={list} preview={preview(list.id)} count={count(list.id)} />
        ))}
        {mine.length === 0 ? (
          <ThemedText variant="muted" size={13}>
            Aún no tienes listas. Crea una con el botón ⊕ o importa una pegando los títulos.
          </ThemedText>
        ) : null}
      </View>

      {offline ? (
        <ThemedText variant="muted" size={13} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          Sin conexión: las listas que sigues y las de la comunidad volverán cuando tengas internet.
        </ThemedText>
      ) : (
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderRadius: c.radius + 6,
              borderColor: c.line,
            },
          ]}
        >
          <View style={styles.cardHead}>
            <ThemedText variant="display" size={20} style={{ flex: 1 }}>
              Listas que sigues
            </ThemedText>
          </View>
          {followed.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              preview={preview(list.id)}
              count={count(list.id)}
              author={lookup(list.ownerId)?.displayName}
            />
          ))}
          {followed.length === 0 ? (
            <View style={{ gap: 14 }}>
              <ThemedText variant="muted" size={13}>
                Sigue listas de otros jugadores para tenerlas siempre a mano.
              </ThemedText>
              <DarkButton label="Ir a Descubrir" onPress={() => router.navigate('/')} />
            </View>
          ) : null}
        </View>
      )}
    </IgnScreen>
  );
}

function ListRow({
  list,
  preview,
  count,
  author,
}: {
  list: GameList;
  preview: Parameters<typeof Mosaic>[0]['games'];
  count: number;
  author?: string;
}) {
  const progress = useListProgress()(list.id);
  const c = useIgnColors();
  return (
    <Pressable
      onPress={() => router.push(`/list/${list.id}`)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Mosaic list={list} games={preview} size={56} radius={8} />
      <View style={{ flex: 1 }}>
        <ThemedText size={16} numberOfLines={1}>
          {list.name}
        </ThemedText>
        <ThemedText variant="muted" size={12}>
          {author ? `${author} · ` : ''}
          {count} {count === 1 ? 'juego' : 'juegos'} · {progress.pct}% completado
        </ThemedText>
        <View style={{ marginTop: 6 }}>
          <ProgressBar pct={progress.pct} height={4} />
        </View>
      </View>
      {list.visibility === 'private' ? (
        <Ionicons name="lock-closed" size={16} color={c.muted} />
      ) : (
        <Ionicons name="globe-outline" size={16} color={c.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tileProgress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  search: { paddingHorizontal: 20, gap: 4, marginBottom: 20 },
  h2: { paddingHorizontal: 20, marginTop: 6, marginBottom: 14 },
  hRow: { paddingHorizontal: 20, gap: 14 },
  newTile: {
    width: 150,
    height: 150,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 30,
    padding: 18,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
});
