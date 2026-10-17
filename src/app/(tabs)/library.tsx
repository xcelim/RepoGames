import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameRow } from '@/components/games';
import { ThemedText } from '@/components/ThemedText';
import { Chip, EmptyState, IconButton, TextField, type IconName } from '@/components/ui';
import { STATUS_META, STATUS_ORDER } from '@/data/meta';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { ListSort, PlayStatus } from '@/types';
import {
  entryStats,
  filterEntries,
  findGame,
  formatHours,
  gameHours,
  sortEntries,
  type Entry,
} from '@/utils/library';

const SORTS: { value: ListSort; label: string }[] = [
  { value: 'added', label: 'Recientes' },
  { value: 'rating', label: 'Mi nota' },
  { value: 'title', label: 'Título' },
  { value: 'release', label: 'Lanzamiento' },
  { value: 'duration', label: 'Duración' },
  { value: 'status', label: 'Estado' },
];

export default function LibraryScreen() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const mode = useStore((s) => s.durationMode);

  const [status, setStatus] = useState<PlayStatus | 'all'>('all');
  const [sort, setSort] = useState<ListSort>('added');
  const [descending, setDescending] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showTools, setShowTools] = useState(false);

  const all = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    Object.values(userGames)
      .filter((ug) => ug.profileId === profileId)
      .forEach((ug, index) => {
        const game = findGame(games, ug.gameId);
        if (!game) return;
        list.push({
          item: { id: ug.id, listId: 'library', gameId: ug.gameId, position: index, addedAt: ug.addedAt },
          game,
          rank: index + 1,
          userGame: ug,
        });
      });
    return list;
  }, [userGames, games, profileId]);

  const counts = useMemo(() => {
    const result: Partial<Record<PlayStatus, number>> = {};
    for (const entry of all) {
      const s = entry.userGame!.status;
      result[s] = (result[s] ?? 0) + 1;
    }
    return result;
  }, [all]);

  const platforms = useMemo(
    () =>
      [...new Set(all.map((e) => e.userGame?.platform).filter((p): p is string => !!p))].sort(),
    [all],
  );

  const visible = useMemo(
    () =>
      sortEntries(
        filterEntries(all, {
          statuses: status === 'all' ? [] : [status],
          includeUntracked: false,
          platform,
          query,
        }),
        sort,
        mode,
        descending,
      ),
    [all, status, platform, query, sort, mode, descending],
  );
  const stats = entryStats(visible, mode);

  return (
    <View style={styles.flex}>
      <FlatList
        data={visible}
        keyExtractor={(entry) => entry.item.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <ThemedText variant="display" size={32} style={styles.flex}>
                Biblioteca
              </ThemedText>
              <IconButton
                icon={showTools ? 'options' : 'options-outline'}
                label="Ordenar y filtrar"
                filled
                onPress={() => setShowTools((v) => !v)}
              />
              <IconButton icon="add" label="Añadir juego" filled onPress={() => router.push('/search')} />
            </View>
            <ThemedText variant="muted" size={13}>
              {stats.games} juegos · {stats.finished} terminados
              {stats.averageRating !== null ? ` · nota media ${stats.averageRating}` : ''}
              {stats.hoursPlayed > 0 ? ` · ${formatHours(stats.hoursPlayed)} jugadas` : ''}
            </ThemedText>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Todos" count={all.length} selected={status === 'all'} onPress={() => setStatus('all')} />
              {STATUS_ORDER.map((s) => (
                <Chip
                  key={s}
                  label={STATUS_META[s].short}
                  icon={STATUS_META[s].icon as IconName}
                  color={STATUS_META[s].color}
                  count={counts[s] ?? 0}
                  selected={status === s}
                  onPress={() => setStatus(status === s ? 'all' : s)}
                />
              ))}
            </ScrollView>

            {showTools ? (
              <View style={styles.tools}>
                <TextField value={query} onChangeText={setQuery} placeholder="Buscar en tu biblioteca" />
                <View style={styles.sortRow}>
                  <ThemedText variant="muted" size={12}>
                    Ordenar
                  </ThemedText>
                  <Pressable onPress={() => setDescending((v) => !v)} hitSlop={8} style={styles.dir}>
                    <Ionicons
                      name={descending ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={skin.colors.accent}
                    />
                    <ThemedText variant="bold" size={12} style={{ color: skin.colors.accent }}>
                      {descending ? 'Invertido' : 'Normal'}
                    </ThemedText>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {SORTS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={sort === option.value}
                      onPress={() => setSort(option.value)}
                    />
                  ))}
                </ScrollView>
                {platforms.length > 0 ? (
                  <>
                    <ThemedText variant="muted" size={12}>
                      Plataforma
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      <Chip label="Todas" selected={!platform} onPress={() => setPlatform(null)} />
                      {platforms.map((p) => (
                        <Chip key={p} label={p} selected={platform === p} onPress={() => setPlatform(p)} />
                      ))}
                    </ScrollView>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: entry, index }) => (
          <GameRow
            game={entry.game}
            userGame={entry.userGame}
            rank={sort === 'rating' && !descending ? index + 1 : undefined}
            hours={gameHours(entry.game, mode) || null}
          />
        )}
        ListEmptyComponent={
          all.length === 0 ? (
            <EmptyState
              icon="game-controller-outline"
              title="Tu biblioteca está vacía"
              text="Abre cualquier juego y elige su estado (Jugando, Pendiente, Terminado…) para guardarlo aquí."
            />
          ) : (
            <EmptyState icon="filter-outline" title="Nada con estos filtros" />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  headerBlock: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { gap: 8, paddingRight: 16 },
  tools: { gap: 10 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
