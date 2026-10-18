import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DISCOVER_META, useDiscover, type DiscoverKind } from '@/api/discover';
import { toGameRecord } from '@/api/games';
import { useGameSheets } from '@/components/gameSheets';
import { CoverTile, IgnScreen, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
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
  const tileW = (width - 20 * 2 - 14) / 2;

  return (
    <IgnScreen title={meta.title(year)} back>
      <ThemedText variant="muted" size={14} style={styles.sub}>
        {meta.subtitle(year)}
      </ThemedText>
      {loading ? <ActivityIndicator color={c.text} style={{ marginTop: 40 }} /> : null}
      <View style={styles.grid}>
        {data.map((r, i) => {
          const record = toGameRecord(r, null);
          const game = games[record.id] ? { ...record, ...games[record.id] } : record;
          const status = profileId ? userGames[userGameKey(profileId, game.id)]?.status : undefined;
          return (
            <CoverTile
              key={game.id}
              game={game}
              width={tileW}
              rank={i + 1}
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
