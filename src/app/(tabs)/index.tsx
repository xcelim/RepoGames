import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameCover, GameRow } from '@/components/games';
import { ListCard, SectionTitle } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { IconButton, Panel, StatTile } from '@/components/ui';
import { OFFICIAL_LISTS } from '@/data/catalog';
import { FINISHED } from '@/data/meta';
import { useCommunityLists, useListCount, useMyLists, useProfileLookup } from '@/hooks/useLists';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { findGame } from '@/utils/library';

export default function HomeScreen() {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const profile = useCurrentProfile();
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const myLists = useMyLists();
  const community = useCommunityLists();
  const countOf = useListCount();
  const lookupProfile = useProfileLookup();

  const mine = useMemo(
    () => Object.values(userGames).filter((g) => g.profileId === profile?.id),
    [userGames, profile?.id],
  );
  const playing = mine.filter((g) => g.status === 'playing');
  const backlog = mine.filter((g) => g.status === 'backlog').length;
  const year = String(new Date().getFullYear());
  const finishedThisYear = mine.filter(
    (g) => FINISHED.includes(g.status) && g.finishedAt?.startsWith(year),
  ).length;
  const recent = mine
    .filter((g) => FINISHED.includes(g.status))
    .sort((a, b) => (b.finishedAt ?? b.updatedAt).localeCompare(a.finishedAt ?? a.updatedAt))
    .slice(0, 5);
  const forkedOfficial = new Set(myLists.map((l) => l.forkedFrom));

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <ThemedText variant="muted" size={11}>
            {'// REGISTRO DE PARTIDAS'}
          </ThemedText>
          <ThemedText variant="display" size={34}>
            Saga
            <ThemedText variant="display" size={34} style={{ color: skin.colors.accent }}>
              {'//'}
            </ThemedText>
            Quest
          </ThemedText>
        </View>
        <IconButton icon="search" label="Buscar juegos" filled onPress={() => router.push('/search')} />
        <IconButton
          icon="settings-outline"
          label="Ajustes"
          filled
          onPress={() => router.push('/settings')}
        />
      </View>

      <ThemedText variant="bold" size={17}>
        Hola, {profile?.displayName ?? 'jugador'}
      </ThemedText>

      <View style={styles.stats}>
        <StatTile value={String(playing.length)} label="Jugando" />
        <StatTile value={String(backlog)} label="Pendientes" />
        <StatTile value={String(finishedThisYear)} label={`Terminados ${year}`} />
      </View>

      <SectionTitle
        title="Jugando ahora"
        action="Biblioteca"
        onAction={() => router.push('/library')}
      />
      {playing.length === 0 ? (
        <Panel>
          <ThemedText variant="muted">
            Marca un juego como «Jugando» y aparecerá aquí para tenerlo a mano.
          </ThemedText>
        </Panel>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {playing.map((entry) => {
            const game = findGame(games, entry.gameId);
            if (!game) return null;
            return (
              <Pressable
                key={entry.id}
                onPress={() => router.push(`/game/${encodeURIComponent(game.id)}`)}
                style={styles.playing}
              >
                <GameCover game={game} width={110} />
                <ThemedText variant="bold" size={12} numberOfLines={2}>
                  {game.title}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <SectionTitle title="Bibliotecas oficiales" />
      <ThemedText variant="muted" size={13}>
        Las sagas completas en orden y en su mejor versión. Añádelas a tu perfil o síguelas.
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {OFFICIAL_LISTS.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            count={countOf(list.id)}
            width={200}
            subtitle={`${countOf(list.id)} juegos${forkedOfficial.has(list.id) ? ' · en tu perfil ✓' : ''}`}
          />
        ))}
      </ScrollView>

      <SectionTitle title="De la comunidad" />
      {community.length === 0 ? (
        <Panel>
          <ThemedText variant="muted">
            Aquí aparecen las listas públicas de otros usuarios. Crea otra cuenta en Perfil →
            Cuentas o conecta Supabase en Ajustes para ver las de todo el mundo.
          </ThemedText>
        </Panel>
      ) : (
        <View style={styles.grid}>
          {community.slice(0, 10).map((list) => (
            <View key={list.id} style={styles.half}>
              <ListCard
                list={list}
                count={countOf(list.id)}
                owner={lookupProfile(list.ownerId)?.displayName}
              />
            </View>
          ))}
        </View>
      )}

      {recent.length > 0 ? (
        <>
          <SectionTitle title="Terminados hace poco" />
          {recent.map((entry) => {
            const game = findGame(games, entry.gameId);
            return game ? <GameRow key={entry.id} game={game} userGame={entry} /> : null;
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  stats: { flexDirection: 'row', gap: 8 },
  row: { gap: 12, paddingRight: 16 },
  playing: { width: 110, gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { width: '47.5%' },
});
