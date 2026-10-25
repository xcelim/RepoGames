import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DISCOVER_META, useDiscover, type DiscoverKind } from '@/api/discover';
import { toGameRecord } from '@/api/games';
import { useGameSheets } from '@/components/gameSheets';
import { CoverTile, GameLine, IgnScreen, useIgnColors } from '@/components/ign';
import { fullDate, shortDate, untilLabel } from '@/hooks/useMyGames';
import { ThemedText } from '@/components/ThemedText';
import { Chip } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { userGameKey } from '@/utils/library';
import { OfflineGate } from '@/components/offline';

// Una sección de Descubrir entera, en rejilla de dos columnas.
function DiscoverListScreenInner() {
  const { kind = 'best' } = useLocalSearchParams<{ kind: DiscoverKind }>();
  const { width } = useWindowDimensions();
  const c = useIgnColors();
  const year = new Date().getFullYear();
  const meta = DISCOVER_META[kind] ?? DISCOVER_META.best;
  const { data, loading } = useDiscover(kind, 50);
  const games = useStore((s) => s.games);
  const userGames = useStore((s) => s.userGames);
  const profileId = useStore((s) => s.currentProfileId);
  const upsertGame = useStore((s) => s.upsertGame);
  const sheets = useGameSheets();
  const [hideOwned, setHideOwned] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // Próximos: en orden de salida.
  const sorted =
    kind === 'upcoming' ? [...data].sort((a, b) => (a.releaseDate ?? '9').localeCompare(b.releaseDate ?? '9')) : data;
  const cols = Math.max(2, Math.floor((width - 40 + 14) / (196 + 14)));
  const tileW = (width - 20 * 2 - 14 * (cols - 1)) / cols;

  return (
    <IgnScreen title={meta.title(year)} back>
      <ThemedText variant="muted" size={14} style={styles.sub}>
        {meta.subtitle(year)}
      </ThemedText>
      <View style={styles.filterRow}>
        <Chip
          label={view === 'grid' ? 'Cuadrícula' : 'Lista'}
          icon={view === 'grid' ? 'grid' : 'list'}
          onPress={() => setView((v) => (v === 'grid' ? 'list' : 'grid'))}
        />
        <Chip
          label={hideOwned ? 'Ocultando los que ya tienes' : 'Ocultar los que ya tengo'}
          icon={hideOwned ? 'eye-off' : 'eye-off-outline'}
          selected={hideOwned}
          onPress={() => setHideOwned((v) => !v)}
        />
      </View>
      {loading ? <ActivityIndicator color={c.text} style={{ marginTop: 40 }} /> : null}
      <View style={view === 'grid' ? styles.grid : styles.list}>
        {sorted.map((r, i) => {
          const record = toGameRecord(r, null);
          const game = games[record.id] ? { ...record, ...games[record.id] } : record;
          const status = profileId ? userGames[userGameKey(profileId, game.id)]?.status : undefined;
          if (hideOwned && status) return null;
          const countdown =
            kind === 'upcoming' && game.releaseDate
              ? `${untilLabel(game.releaseDate)} · ${fullDate(game.releaseDate)}`
              : undefined;
          const open = () => {
            if (!games[game.id]) upsertGame(game);
            router.push(`/game/${encodeURIComponent(game.id)}`);
          };
          if (view === 'list')
            return (
              <GameLine
                key={game.id}
                game={game}
                rank={kind === 'upcoming' ? undefined : i + 1}
                status={status}
                caption={countdown}
                onPress={open}
                right={
                  <Pressable hitSlop={8} onPress={() => sheets.openStatus(game)}>
                    <Ionicons name={status ? 'checkmark-circle' : 'add-circle-outline'} size={30} color={c.text} />
                  </Pressable>
                }
              />
            );
          return (
            <CoverTile
              subtitle={
                kind === 'upcoming' && game.releaseDate
                  ? `${untilLabel(game.releaseDate)} · ${shortDate(game.releaseDate)}`
                  : undefined
              }
              key={game.id}
              game={game}
              width={tileW}
              rank={kind === 'upcoming' ? undefined : i + 1}
              status={status}
              onAdd={() => sheets.openStatus(game)}
              onPress={() => {
                if (!games[game.id]) upsertGame(game);
                router.push(`/game/${encodeURIComponent(game.id)}`);
              }}
            />
          );
        })}
      </View>
      {sheets.element}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  list: { paddingHorizontal: 20 },
  sub: { paddingHorizontal: 20, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 22, paddingHorizontal: 20 },
});

export default function DiscoverListScreen() {
  return (
    <OfflineGate what="Descubrir">
      <DiscoverListScreenInner />
    </OfflineGate>
  );
}
