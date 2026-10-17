import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasIgdbCredentials, searchGames, type IgdbSearchResult } from '@/api/igdb';
import { Button } from '@/components/Button';
import { GameRow } from '@/components/games';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Chip, Panel, TextField } from '@/components/ui';
import { CATALOG_GAMES, SAGAS, stripAccents } from '@/data/catalog';
import { useList } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { GameRecord } from '@/types';
import { uuid } from '@/utils/id';
import { itemsOfList, userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';

function normalize(text: string): string {
  return stripAccents(text).toLowerCase();
}

function fromIgdb(result: IgdbSearchResult, profileId: string | null): GameRecord {
  return {
    id: `igdb-${result.igdbId}`,
    title: result.title,
    year: result.year,
    platforms: result.platforms,
    version: null,
    series: null,
    main: null,
    extra: null,
    full: null,
    synopsis: result.summary,
    note: null,
    igdbId: result.igdbId,
    igdbQuery: null,
    coverUrl: result.coverUrl,
    source: 'igdb',
    createdBy: profileId,
  };
}

type Row = { key: string; game: GameRecord; external?: boolean };

export default function SearchScreen() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const list = useList(listId ?? '');
  const profileId = useStore((s) => s.currentProfileId);
  const customGames = useStore((s) => s.games);
  const items = useStore((s) => s.items);
  const userGames = useStore((s) => s.userGames);
  const upsertGame = useStore((s) => s.upsertGame);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);

  const [query, setQuery] = useState('');
  const [series, setSeries] = useState<string | null>(null);
  const [remote, setRemote] = useState<IgdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [igdbReady, setIgdbReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', year: '', platforms: '', hours: '' });
  const requestId = useRef(0);

  useEffect(() => {
    hasIgdbCredentials().then(setIgdbReady);
  }, []);

  // Busca en IGDB medio segundo después de dejar de escribir.
  useEffect(() => {
    const current = ++requestId.current;
    if (!igdbReady || query.trim().length < 3) return;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchGames(query)
        .then((results) => {
          if (current === requestId.current) setRemote(results);
        })
        .catch((e: unknown) => {
          if (current === requestId.current) setError(e instanceof Error ? e.message : 'Error');
        })
        .finally(() => {
          if (current === requestId.current) setLoading(false);
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [query, igdbReady]);

  const inList = useMemo(
    () => new Set(listId ? itemsOfList(items, listId).map((i) => i.gameId) : []),
    [items, listId],
  );

  const local: Row[] = useMemo(() => {
    const q = normalize(query.trim());
    if (!q && !series) return [];
    return [...Object.values(CATALOG_GAMES), ...Object.values(customGames)]
      .filter((game) => (!series || game.series === series) && (!q || normalize(game.title).includes(q)))
      .slice(0, 60)
      .map((game) => ({ key: game.id, game }));
  }, [query, series, customGames]);

  const external: Row[] = (query.trim().length >= 3 ? remote : [])
    .filter((r) => !local.some((row) => row.game.igdbId === r.igdbId))
    .map((r) => ({ key: `igdb-${r.igdbId}`, game: customGames[`igdb-${r.igdbId}`] ?? fromIgdb(r, profileId), external: true }));

  const choose = (row: Row) => {
    if (row.external) upsertGame(row.game);
    if (!listId) {
      router.push(`/game/${encodeURIComponent(row.game.id)}`);
      return;
    }
    if (inList.has(row.game.id)) {
      removeFromList(listId, row.game.id);
    } else {
      addToList(listId, row.game.id);
      notify(`Añadido a ${list?.name ?? 'la lista'}`);
    }
  };

  const createManual = () => {
    const title = form.title.trim();
    if (!title) return;
    const hours = parseFloat(form.hours.replace(',', '.'));
    const year = parseInt(form.year, 10);
    const game: GameRecord = {
      id: uuid(),
      title,
      year: Number.isFinite(year) ? year : null,
      platforms: form.platforms.trim(),
      version: null,
      series: null,
      main: Number.isFinite(hours) ? hours : null,
      extra: null,
      full: null,
      synopsis: null,
      note: null,
      igdbId: null,
      igdbQuery: title,
      coverUrl: null,
      source: 'custom',
      createdBy: profileId,
    };
    upsertGame(game);
    setCreating(false);
    setForm({ title: '', year: '', platforms: '', hours: '' });
    choose({ key: game.id, game });
  };

  const rows: (Row | { key: string; header: string })[] = [
    ...(local.length ? [{ key: 'h-local', header: 'Catálogo y tus juegos' }] : []),
    ...local,
    ...(external.length ? [{ key: 'h-igdb', header: 'Desde IGDB' }] : []),
    ...external,
  ];

  return (
    <View style={styles.flex}>
      <ScreenHeader back title={list ? `Añadir a ${list.name}` : 'Buscar juegos'} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Busca cualquier juego…"
              autoFocus
              returnKeyType="search"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SAGAS.map((saga) => (
                <Chip
                  key={saga.id}
                  label={saga.name}
                  color={saga.color}
                  selected={series === saga.id}
                  onPress={() => setSeries(series === saga.id ? null : saga.id)}
                />
              ))}
            </ScrollView>
            {!igdbReady ? (
              <Panel>
                <ThemedText variant="muted" size={13}>
                  Ahora buscas en las {Object.keys(CATALOG_GAMES).length} entradas del catálogo. Para
                  buscar cualquier juego existente, pega tus claves de IGDB en Ajustes.
                </ThemedText>
                <Button kind="ghost" label="Ir a Ajustes" onPress={() => router.push('/settings')} />
              </Panel>
            ) : null}
            {loading ? <ActivityIndicator color={skin.colors.accent} /> : null}
            {error ? (
              <ThemedText variant="muted" size={13}>
                {error}
              </ThemedText>
            ) : null}
          </View>
        }
        renderItem={({ item: row }) => {
          if ('header' in row) {
            return (
              <ThemedText variant="bold" size={12} style={[styles.header, { color: skin.colors.accent2 }]}>
                {row.header.toUpperCase()}
              </ThemedText>
            );
          }
          const added = inList.has(row.game.id);
          const ug = profileId ? userGames[userGameKey(profileId, row.game.id)] : undefined;
          return (
            <GameRow
              game={row.game}
              userGame={ug}
              hours={row.game.main}
              onPress={() => choose(row)}
              right={
                listId ? (
                  <Ionicons
                    name={added ? 'checkmark-circle' : 'add-circle-outline'}
                    size={28}
                    color={added ? skin.colors.accent : skin.colors.muted}
                  />
                ) : undefined
              }
            />
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {creating ? (
              <Panel>
                <ThemedText variant="display" size={18}>
                  Crear juego a mano
                </ThemedText>
                <TextField
                  label="Título"
                  value={form.title}
                  onChangeText={(title) => setForm((f) => ({ ...f, title }))}
                />
                <View style={styles.twoCols}>
                  <View style={styles.flex}>
                    <TextField
                      label="Año"
                      keyboardType="numeric"
                      value={form.year}
                      onChangeText={(year) => setForm((f) => ({ ...f, year }))}
                    />
                  </View>
                  <View style={styles.flex}>
                    <TextField
                      label="Horas (historia)"
                      keyboardType="numeric"
                      value={form.hours}
                      onChangeText={(hours) => setForm((f) => ({ ...f, hours }))}
                    />
                  </View>
                </View>
                <TextField
                  label="Plataformas"
                  value={form.platforms}
                  placeholder="Switch, PS5…"
                  onChangeText={(platforms) => setForm((f) => ({ ...f, platforms }))}
                />
                <Button label="Crear" onPress={createManual} />
              </Panel>
            ) : (
              <Button
                kind="ghost"
                label="¿No lo encuentras? Créalo a mano"
                onPress={() => {
                  setForm((f) => ({ ...f, title: query }));
                  setCreating(true);
                }}
              />
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 8 },
  headerBlock: { gap: 12, marginBottom: 6 },
  chips: { gap: 8, paddingRight: 16 },
  header: { letterSpacing: 2, marginTop: 8 },
  footer: { marginTop: 16 },
  twoCols: { flexDirection: 'row', gap: 8 },
});
