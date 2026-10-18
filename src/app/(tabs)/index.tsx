import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DISCOVER_META, useDiscover, type DiscoverKind } from '@/api/discover';
import { toGameRecord } from '@/api/games';
import type { OnlineResult } from '@/api/types';
import { GameCover } from '@/components/games';
import { useGameSheets } from '@/components/gameSheets';
import { Card, Collage, CoverTile, formatUsDate, HeaderIcon, IgnScreen, RankCircle, SectionHeader, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { OFFICIAL_LISTS, OFFICIAL_PROFILE } from '@/data/catalog';
import { useCommunityLists, useListCount, useListPreview, useProfileLookup } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import type { GameList, GameRecord } from '@/types';
import { userGameKey } from '@/utils/library';

function useOpenOnline() {
  const upsertGame = useStore((s) => s.upsertGame);
  return (game: GameRecord) => {
    if (!useStore.getState().games[game.id]) upsertGame(game);
    router.push(`/game/${encodeURIComponent(game.id)}`);
  };
}

export default function DiscoverScreen() {
  const { width } = useWindowDimensions();
  const preview = useListPreview();
  const count = useListCount();
  const community = useCommunityLists();
  const lookup = useProfileLookup();
  const sheets = useGameSheets();
  const year = new Date().getFullYear();
  const cardW = Math.min(width - 64, 420);

  return (
    <IgnScreen title="Descubrir" right={<HeaderIcon icon="search" label="Buscar" onPress={() => router.push('/search')} />}>
      <SectionHeader title="Listas destacadas" subtitle="Los canónicos de cada saga en su mejor versión, elegidos por Saga Quest." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow} snapToInterval={cardW + 14} decelerationRate="fast">
        {OFFICIAL_LISTS.map((list) => (
          <FeaturedCard key={list.id} list={list} games={preview(list.id)} count={count(list.id)} width={cardW} author={OFFICIAL_PROFILE.displayName} />
        ))}
      </ScrollView>

      <CoverSection kind="best" year={year} onAdd={sheets.openStatus} />
      <RankedColumns kind="popular" year={year} width={width} onAdd={sheets.openStatus} />
      <CoverSection kind="upcoming" year={year} onAdd={sheets.openStatus} />

      {community.length ? (
        <View style={styles.section}>
          <SectionHeader title="Listas de la comunidad" subtitle="Listas públicas de otros jugadores. Síguelas o cópialas a tu perfil." />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {community.slice(0, 12).map((list) => (
              <FeaturedCard
                key={list.id}
                list={list}
                games={preview(list.id)}
                count={count(list.id)}
                width={cardW * 0.8}
                author={lookup(list.ownerId)?.displayName ?? 'Jugador'}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <CoverSection kind="best-last" year={year} onAdd={sheets.openStatus} />
      {sheets.element}
    </IgnScreen>
  );
}

function FeaturedCard({ list, games, count, width, author }: { list: GameList; games: GameRecord[]; count: number; width: number; author: string }) {
  return (
    <Pressable onPress={() => router.push(`/list/${list.id}`)} style={({ pressed }) => ({ width, opacity: pressed ? 0.85 : 1 })}>
      <Collage list={list} games={games} width={width} height={width * 0.72} />
      <ThemedText size={16} numberOfLines={1} style={{ marginTop: 10 }}>
        {list.name}
      </ThemedText>
      <ThemedText variant="muted" size={11} style={styles.caps}>
        {`${author} · ${count} ${count === 1 ? 'juego' : 'juegos'}`.toUpperCase()}
      </ThemedText>
    </Pressable>
  );
}

function useResultRecords(results: OnlineResult[]) {
  const games = useStore((s) => s.games);
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  return results.map((r) => {
    const record = toGameRecord(r, null);
    const stored = games[record.id];
    const game = stored ? { ...record, ...stored, developer: stored.developer ?? record.developer } : record;
    const status = profileId ? userGames[userGameKey(profileId, game.id)]?.status : undefined;
    return { game, status };
  });
}

function CoverSection({ kind, year, onAdd }: { kind: DiscoverKind; year: number; onAdd: (g: GameRecord) => void }) {
  const { data, loading, error } = useDiscover(kind, 20);
  const records = useResultRecords(data);
  const open = useOpenOnline();
  const c = useIgnColors();
  if (!loading && !data.length) {
    return kind === 'best' && !error ? <NoApiCard /> : null;
  }
  return (
    <View style={styles.section}>
      <SectionHeader title={DISCOVER_META[kind].title(year)} subtitle={DISCOVER_META[kind].subtitle(year)} onPress={() => router.push(`/discover/${kind}`)} />
      {loading ? (
        <ActivityIndicator color={c.text} style={{ marginVertical: 40 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {records.map(({ game, status }) => (
            <CoverTile key={game.id} game={game} width={150} status={status} onPress={() => open(game)} onAdd={() => onAdd(game)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// "Lo que se juega esta semana": columnas de 5 filas numeradas que se deslizan.
function RankedColumns({ kind, year, width, onAdd }: { kind: DiscoverKind; year: number; width: number; onAdd: (g: GameRecord) => void }) {
  const { data, loading } = useDiscover(kind, 15);
  const records = useResultRecords(data);
  const open = useOpenOnline();
  const c = useIgnColors();
  if (!loading && !data.length) return null;
  const colW = Math.min(width - 70, 400);
  const columns: (typeof records)[] = [];
  for (let i = 0; i < records.length; i += 5) columns.push(records.slice(i, i + 5));
  return (
    <View style={styles.section}>
      <SectionHeader title={DISCOVER_META[kind].title(year)} onPress={() => router.push(`/discover/${kind}`)} />
      {loading ? (
        <ActivityIndicator color={c.text} style={{ marginVertical: 40 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow} snapToInterval={colW + 14} decelerationRate="fast">
          {columns.map((col, ci) => (
            <View key={ci} style={{ width: colW, gap: 14 }}>
              {col.map(({ game, status }, i) => (
                <Pressable key={game.id} onPress={() => open(game)} style={styles.rankRow}>
                  <View>
                    <GameCover game={game} width={70} square radius={6} />
                    <Pressable onPress={() => onAdd(game)} hitSlop={8} style={styles.rankAdd}>
                      <Ionicons name={status ? 'checkmark-circle' : 'add-circle'} size={24} color="#fff" />
                    </Pressable>
                  </View>
                  <RankCircle rank={ci * 5 + i + 1} />
                  <View style={{ flex: 1 }}>
                    <ThemedText size={15} numberOfLines={2}>
                      {game.title}
                    </ThemedText>
                    <ThemedText variant="muted" size={12} numberOfLines={1}>
                      {[formatUsDate(game.releaseDate), game.developer].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function NoApiCard() {
  return (
    <View style={styles.section}>
      <Card style={{ marginHorizontal: 20 }}>
        <ThemedText variant="bold" size={15}>
          Sin conexión con la API de juegos
        </ThemedText>
        <ThemedText variant="muted" size={13} style={{ marginTop: 6 }}>
          No se han podido cargar las novedades. Revisa tu conexión; si sigue igual, esta versión de la app se compiló sin
          las claves de IGDB (Ajustes → API de juegos).
        </ThemedText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  hRow: { paddingHorizontal: 20, gap: 14 },
  section: { marginTop: 34 },
  caps: { letterSpacing: 0.8, marginTop: 3 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankAdd: { position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14 },
});
