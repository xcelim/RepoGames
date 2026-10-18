import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CoverTile, HeaderIcon, IgnScreen, StatusIcon, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { LIBRARY_ROW_META, LIBRARY_ROWS, statusesOfRow } from '@/data/meta';
import { useStore } from '@/store/useStore';
import type { PlayStatus } from '@/types';

export default function LibraryScreen() {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);

  const mine = useMemo(() => Object.values(userGames).filter((u) => u.profileId === profileId), [userGames, profileId]);
  const playing = useMemo(
    () =>
      mine
        .filter((u) => u.status === 'playing')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((u) => ({ ug: u, game: games[u.gameId] }))
        .filter((x) => !!x.game),
    [mine, games],
  );
  const countOf = (statuses: PlayStatus[] | null) =>
    statuses ? mine.filter((u) => statuses.includes(u.status)).length : mine.length;

  return (
    <IgnScreen
      title="Biblioteca"
      right={
        <>
          <HeaderIcon icon="add-circle-outline" label="Añadir juego" onPress={() => router.push('/search')} />
          <HeaderIcon icon="copy-outline" label="Todos mis juegos" onPress={() => router.push('/library/all')} />
        </>
      }
    >
      <ThemedText variant="display" size={22} style={styles.h2}>
        Jugando ahora
      </ThemedText>
      {playing.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {playing.map(({ ug, game }) => (
            <CoverTile key={ug.id} game={game!} width={150} status={ug.status} onPress={() => router.push(`/game/${encodeURIComponent(game!.id)}`)} />
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={() => router.push('/search')} style={[styles.empty, { borderColor: c.line, borderRadius: c.radius }]}>
          <Ionicons name="game-controller-outline" size={26} color={c.muted} />
          <ThemedText variant="muted" size={13} style={{ flex: 1 }}>
            No estás jugando a nada. Busca un juego y márcalo como «Jugando».
          </ThemedText>
        </Pressable>
      )}

      <View style={[styles.card, { backgroundColor: c.card, borderRadius: c.radius + 6, borderColor: c.line }]}>
        {LIBRARY_ROWS.map((row, i) => {
          const meta = LIBRARY_ROW_META[row];
          return (
            <Pressable
              key={row}
              onPress={() => router.push(`/library/${row}`)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: c.line, borderBottomWidth: i === LIBRARY_ROWS.length - 1 ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <StatusIcon status={row === 'all' ? 'library' : row} size={36} />
              <View style={{ flex: 1 }}>
                <ThemedText size={16}>{meta.label}</ThemedText>
                <ThemedText variant="muted" size={10} style={styles.caps}>
                  {meta.caption}
                </ThemedText>
              </View>
              <ThemedText size={15}>{countOf(statusesOfRow(row))}</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          );
        })}
      </View>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  h2: { paddingHorizontal: 20, marginTop: 6, marginBottom: 14 },
  hRow: { paddingHorizontal: 20, gap: 14 },
  empty: { marginHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  card: { marginHorizontal: 20, marginTop: 34, paddingHorizontal: 16, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  caps: { letterSpacing: 0.8, marginTop: 2 },
});
