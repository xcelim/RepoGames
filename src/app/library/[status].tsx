import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useGameSheets } from '@/components/gameSheets';
import { EntryGrid, HeaderIcon, IgnScreen, SelectBox } from '@/components/ign';
import { SortSheet } from '@/components/sortSheet';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { LIBRARY_ROW_META, SORT_LABEL, statusesOfRow, type LibraryRow } from '@/data/meta';
import { useStore } from '@/store/useStore';
import type { ListItem, ListSort } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { sortEntries, type Entry } from '@/utils/library';

// Los juegos de la biblioteca con un estado (o todos), como en IGN.
export default function LibraryStatusScreen() {
  const { status = 'all' } = useLocalSearchParams<{ status: LibraryRow }>();
  const row: LibraryRow = status in LIBRARY_ROW_META ? status : 'all';
  const meta = LIBRARY_ROW_META[row];
  const { width } = useWindowDimensions();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const mode = useStore((s) => s.durationMode);
  const [sort, setSort] = useState<ListSort>('updated-new');
  const [sortOpen, setSortOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const sheets = useGameSheets();

  const entries = useMemo(() => {
    const statuses = statusesOfRow(row);
    const mine = Object.values(userGames)
      .filter((u) => u.profileId === profileId && (!statuses || statuses.includes(u.status)))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    const list: Entry[] = [];
    mine.forEach((ug, index) => {
      const game = games[ug.gameId];
      if (!game) return;
      const item: ListItem = { id: ug.id, listId: 'library', gameId: game.id, position: index, addedAt: ug.addedAt };
      list.push({ item, game, rank: list.length + 1, userGame: ug });
    });
    const sorted = sortEntries(list, sort, mode);
    return query.trim() ? rankByQuery(query, sorted, (e) => e.game.title) : sorted;
  }, [userGames, games, profileId, row, sort, mode, query]);

  return (
    <IgnScreen title={meta.label} back right={<HeaderIcon icon="search" onPress={() => setSearching((s) => !s)} />}>
      <View style={styles.controls}>
        <ThemedText variant="muted" size={12} style={styles.caps}>
          {`${entries.length} ${entries.length === 1 ? 'JUEGO' : 'JUEGOS'} · ${meta.caption}`}
        </ThemedText>
        {searching ? <TextField value={query} onChangeText={setQuery} placeholder="Buscar en esta lista…" autoFocus /> : null}
        <SelectBox label={sort === 'manual' ? 'Orden en que los añadiste' : SORT_LABEL[sort]} onPress={() => setSortOpen(true)} />
      </View>
      {entries.length === 0 ? (
        <ThemedText variant="muted" size={14} style={styles.empty}>
          Aún no hay juegos aquí. Abre un juego y pulsa «Editar estado».
        </ThemedText>
      ) : null}
      <EntryGrid
        entries={entries.map((e) => ({ game: e.game, status: e.userGame?.status, rank: e.rank }))}
        width={width}
        showRank={sort === 'manual'}
        onPress={(game) => router.push(`/game/${encodeURIComponent(game.id)}`)}
        onLongPress={sheets.openStatus}
      />
      <SortSheet visible={sortOpen} value={sort} onChange={setSort} onClose={() => setSortOpen(false)} manualLabel="Orden en que los añadiste" />
      {sheets.element}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  caps: { letterSpacing: 0.8 },
  empty: { paddingHorizontal: 20, marginBottom: 20 },
});
