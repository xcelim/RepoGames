import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onlineGameId, onlineSources, searchOnline, toGameRecord } from '@/api/games';
import type { OnlineResult } from '@/api/types';
import { Button } from '@/components/Button';
import { useGameSheets } from '@/components/gameSheets';
import { GameLine } from '@/components/ign';
import { ScreenHeader } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Chip, Panel, TextField } from '@/components/ui';
import { OFFICIAL_SERIES, officialListId } from '@/data/catalog';
import { rankByQuery } from '@/utils/fuzzy';
import { stripAccents } from '@/utils/text';
import { useList, useListCount, useProfileLookup } from '@/hooks/useLists';
import { searchPublicLists } from '@/cloud/listSearch';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { GameList, GameRecord } from '@/types';
import { uuid } from '@/utils/id';
import { itemsOfList, userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';
import { OfflineGate } from '@/components/offline';
import { HScroll } from '@/components/HScroll';

function normalize(text: string): string {
  return stripAccents(text).toLowerCase();
}

type Row = { key: string; game: GameRecord; external?: boolean; source?: string };
type ListRowItem = { key: string; list: GameList };

function SearchScreenInner() {
  const { listId, q } = useLocalSearchParams<{ listId?: string; q?: string }>();
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

  const [query, setQuery] = useState(q ?? '');
  const [remote, setRemote] = useState<OnlineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState({ igdb: false, rawg: false });
  const online = sources.igdb || sources.rawg;
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', year: '', platforms: '', hours: '', cover: '' });
  const requestId = useRef(0);
  const sheets = useGameSheets();
  // Buscar juegos o listas; y ocultar los juegos que ya tienes (para encontrar nuevos).
  const [mode, setMode] = useState<'games' | 'lists'>('games');
  const [hideOwned, setHideOwned] = useState(false);
  const [listResults, setListResults] = useState<GameList[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const countOf = useListCount();
  const lookup = useProfileLookup();

  useEffect(() => {
    if (mode !== 'lists') return;
    let alive = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setListResults([]);
        return;
      }
      setListLoading(true);
      searchPublicLists(query)
        .then((r) => alive && setListResults(r))
        .catch(() => alive && setListResults([]))
        .finally(() => alive && setListLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, mode]);

  useEffect(() => {
    onlineSources().then(setSources);
  }, []);

  // Busca en cuanto dejas de escribir y enseña los resultados según van llegando.
  useEffect(() => {
    const current = ++requestId.current;
    if (!online || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchOnline(query, (partial) => {
        if (current === requestId.current) setRemote(partial);
      })
        .then(({ results, errors }) => {
          if (current !== requestId.current) return;
          setRemote(results);
          if (errors.length && !results.length) setError(errors.join(' · '));
        })
        .catch((e: unknown) => {
          if (current === requestId.current) setError(e instanceof Error ? e.message : 'Error');
        })
        .finally(() => {
          if (current === requestId.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, online]);

  const inList = useMemo(() => new Set(listId ? itemsOfList(items, listId).map((i) => i.gameId) : []), [items, listId]);

  const local: Row[] = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    // Juegos que ya tienes en el móvil (los creados a mano y los ya descargados).
    // Búsqueda tolerante: "minecraf" encuentra "Minecraft".
    const all = Object.values(customGames);
    const plain = normalize(q);
    const ranked = rankByQuery(q, all, (game) => game.title);
    const contains = all.filter((game) => normalize(game.title).includes(plain) && !ranked.includes(game));
    return [...ranked, ...contains].slice(0, 12).map((game) => ({ key: game.id, game }));
  }, [query, customGames]);

  const external: Row[] = (query.trim().length >= 2 ? remote : [])
    .filter((r) => hideOwned || !local.some((row) => row.game.id === onlineGameId(r)))
    .map((r) => ({
      key: onlineGameId(r),
      game: customGames[onlineGameId(r)] ?? toGameRecord(r, profileId),
      external: true,
      source: r.source === 'igdb' ? 'IGDB' : 'RAWG',
    }));

  const choose = (row: Row) => {
    if (row.external && !customGames[row.game.id]) upsertGame(row.game);
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
      rawgId: null,
      igdbQuery: title,
      coverUrl: form.cover.trim() || null,
      source: 'custom',
      createdBy: profileId,
    };
    upsertGame(game);
    setCreating(false);
    setForm({ title: '', year: '', platforms: '', hours: '', cover: '' });
    choose({ key: game.id, game });
  };

  // «Los que ya tengo»: los de tu biblioteca (también si el mismo juego viene con otro id).
  const ownedTitles = useMemo(() => {
    const out = new Set<string>();
    for (const u of Object.values(userGames))
      if (u.profileId === profileId && customGames[u.gameId]) out.add(normalize(customGames[u.gameId].title));
    return out;
  }, [userGames, customGames, profileId]);
  const owned = (r: Row) =>
    !!(profileId && userGames[userGameKey(profileId, r.game.id)]) || ownedTitles.has(normalize(r.game.title));
  // Al ocultar, tampoco se enseña «Ya en tu móvil»: solo juegos nuevos de la API.
  const shownLocal = hideOwned ? [] : local;
  const shownExternal = hideOwned ? external.filter((r) => !owned(r)) : external;
  const rows: (Row | ListRowItem | { key: string; header: string })[] =
    mode === 'lists'
      ? listResults.map((list) => ({ key: `l-${list.id}`, list }))
      : [
          ...(shownLocal.length ? [{ key: 'h-local', header: 'Ya en tu móvil' }] : []),
          ...shownLocal,
          ...(shownExternal.length ? [{ key: 'h-online', header: 'IGDB · RAWG' }] : []),
          ...shownExternal,
        ];

  return (
    <View style={styles.flex}>
      <ScreenHeader back title={list ? `Añadir a ${list.name}` : 'Buscar'} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.searchRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={query}
                  onChangeText={setQuery}
                  placeholder={mode === 'lists' ? 'Busca listas por nombre…' : 'Busca cualquier juego…'}
                  autoFocus={!q}
                  returnKeyType="search"
                />
              </View>
              {Platform.OS !== 'web' ? (
                <Pressable
                  accessibilityLabel="Escanear código de barras"
                  onPress={() => router.push(listId ? `/scan?listId=${listId}` : '/scan')}
                  style={[styles.scanBtn, { borderColor: skin.colors.line, backgroundColor: skin.colors.panel }]}
                >
                  <Ionicons name="barcode-outline" size={26} color={skin.colors.text} />
                </Pressable>
              ) : null}
            </View>
            {!listId ? (
              <View style={[styles.tabs, { backgroundColor: skin.colors.panel2, borderRadius: 12 }]}>
                {(['games', 'lists'] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    style={[
                      styles.tab,
                      { borderRadius: 10, backgroundColor: mode === m ? skin.colors.text : 'transparent' },
                    ]}
                  >
                    <Ionicons
                      name={m === 'games' ? 'game-controller' : 'albums'}
                      size={16}
                      color={mode === m ? skin.colors.bg : skin.colors.text}
                    />
                    <ThemedText
                      variant="bold"
                      size={13}
                      style={{ color: mode === m ? skin.colors.bg : skin.colors.text }}
                    >
                      {m === 'games' ? 'Juegos' : 'Listas'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {mode === 'games' ? (
              <View style={{ flexDirection: 'row' }}>
                <Chip
                  label={hideOwned ? 'Ocultando los que ya tienes' : 'Ocultar los que ya tengo'}
                  icon={hideOwned ? 'eye-off' : 'eye-off-outline'}
                  selected={hideOwned}
                  onPress={() => setHideOwned((v) => !v)}
                />
              </View>
            ) : null}
            {listLoading ? <ActivityIndicator color={skin.colors.accent} /> : null}
            {mode === 'lists' && query.trim().length >= 2 && !listLoading && !listResults.length ? (
              <ThemedText variant="muted" size={13}>
                No hay listas públicas con ese nombre.
              </ThemedText>
            ) : null}
            <HScroll contentContainerStyle={styles.chips}>
              {OFFICIAL_SERIES.map((saga) => (
                <Chip
                  key={saga.id}
                  label={saga.name}
                  color={saga.color}
                  onPress={() => router.push(`/list/${officialListId(saga.id)}`)}
                />
              ))}
            </HScroll>
            {!online ? (
              <Panel>
                <ThemedText variant="muted" size={13}>
                  Esta versión de la app se compiló sin acceso a la API de juegos. Solo puedes buscar tus juegos y
                  crearlos a mano.
                </ThemedText>
              </Panel>
            ) : null}
            {loading ? <ActivityIndicator color={skin.colors.accent} /> : null}
            {online && query.trim().length === 1 ? (
              <ThemedText variant="muted" size={12}>
                Escribe al menos 2 letras para buscar en la API de juegos.
              </ThemedText>
            ) : null}
            {error ? (
              <ThemedText variant="muted" size={13}>
                {error}
              </ThemedText>
            ) : null}
          </View>
        }
        renderItem={({ item: row }) => {
          if ('list' in row) {
            const l = row.list;
            return (
              <Pressable
                onPress={() => router.push(`/list/${l.id}`)}
                style={[styles.listRow, { borderBottomColor: skin.colors.line }]}
              >
                <View style={[styles.listIcon, { backgroundColor: l.color }]}>
                  <Ionicons name={(l.icon || 'albums') as never} size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="bold" size={15} numberOfLines={1}>
                    {l.name}
                  </ThemedText>
                  <ThemedText variant="muted" size={12} numberOfLines={1}>
                    {`${l.official ? 'Saga Quest' : (lookup(l.ownerId)?.displayName ?? 'Jugador')} · ${countOf(l.id)} juegos`}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={skin.colors.muted} />
              </Pressable>
            );
          }
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
            <GameLine
              game={row.game}
              status={ug?.status}
              onPress={() => choose(row)}
              right={
                listId ? (
                  <Ionicons
                    name={added ? 'checkmark-circle' : 'add-circle-outline'}
                    size={30}
                    color={added ? skin.colors.accent : skin.colors.text}
                  />
                ) : (
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      if (row.external && !customGames[row.game.id]) upsertGame(row.game);
                      sheets.openStatus(row.game);
                    }}
                  >
                    <Ionicons
                      name={ug ? 'checkmark-circle' : 'add-circle-outline'}
                      size={30}
                      color={skin.colors.text}
                    />
                  </Pressable>
                )
              }
            />
          );
        }}
        ListFooterComponent={
          mode === 'lists' ? null : (
            <View style={styles.footer}>
              {sources.rawg && external.some((r) => r.source === 'RAWG') ? (
                <ThemedText
                  variant="muted"
                  size={11}
                  style={styles.attribution}
                  onPress={() => Linking.openURL('https://rawg.io')}
                >
                  Datos e imágenes de RAWG (rawg.io) e IGDB (igdb.com)
                </ThemedText>
              ) : null}
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
                  <TextField
                    label="Portada (enlace a una imagen, opcional)"
                    value={form.cover}
                    placeholder="https://…"
                    autoCapitalize="none"
                    keyboardType="url"
                    onChangeText={(cover) => setForm((f) => ({ ...f, cover }))}
                  />
                  <ThemedText variant="muted" size={12}>
                    Después podrás completar el resto de datos desde «Editar» en su ficha.
                  </ThemedText>
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
          )
        }
      />
      {sheets.element}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  scanBtn: { width: 50, height: 50, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 0 },
  headerBlock: { gap: 12, marginBottom: 6 },
  chips: { gap: 8, paddingRight: 16 },
  header: { letterSpacing: 2, marginTop: 8 },
  footer: { marginTop: 16, gap: 12 },
  attribution: { textAlign: 'center', textDecorationLine: 'underline' },
  twoCols: { flexDirection: 'row', gap: 8 },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  listIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

export default function SearchScreen() {
  return (
    <OfflineGate what="El buscador">
      <SearchScreenInner />
    </OfflineGate>
  );
}
