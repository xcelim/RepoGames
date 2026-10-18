import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadOfficialList, useOfficialStatus } from '@/api/official';
import { useGameSheets } from '@/components/gameSheets';
import {
  BlurHero,
  Card,
  DarkButton,
  DotsButton,
  EntryGrid,
  IgnScreen,
  LightButton,
  Mosaic,
  SelectBox,
  Sheet,
  SheetRow,
  timeAgo,
  useIgnColors,
} from '@/components/ign';
import { OfflineNotice, useOfflineMode } from '@/components/offline';
import { SortSheet } from '@/components/sortSheet';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { seriesOfList } from '@/data/catalog';
import { SORT_LABEL } from '@/data/meta';
import { useCover, useFillBasics } from '@/hooks/useIgdb';
import { useList, useListEntries, useProfileLookup } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import type { ListSort } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { entryStats, formatHours, sortEntries } from '@/utils/library';
import { notify } from '@/utils/notify';

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useIgnColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const list = useList(id);
  const entries = useListEntries(id);
  const lookupProfile = useProfileLookup();
  const profileId = useStore((s) => s.currentProfileId);
  const mode = useStore((s) => s.durationMode);
  const follows = useStore((s) => (s.currentProfileId ? s.follows[s.currentProfileId] : undefined));
  const myLists = useStore((s) => s.lists);
  const forkList = useStore((s) => s.forkList);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const updateList = useStore((s) => s.updateList);
  const deleteList = useStore((s) => s.deleteList);
  const pendingSeeds = useStore((s) => s.pendingSeeds);
  const officialStatus = useOfficialStatus();
  const sheets = useGameSheets();
  const offline = useOfflineMode();

  const [sort, setSort] = useState<ListSort>('manual');
  const [sortOpen, setSortOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  useFillBasics(entries.map((e) => e.game));
  const heroCover = useCover(entries[0]?.game);

  const visible = useMemo(() => {
    const sorted = sortEntries(entries, sort, mode);
    return query.trim() ? rankByQuery(query, sorted, (e) => e.game.title) : sorted;
  }, [entries, sort, mode, query]);
  const stats = entryStats(entries, mode);

  if (!list) {
    return (
      <IgnScreen title="Lista" back>
        <ThemedText variant="muted" style={{ paddingHorizontal: 20 }}>
          Esta lista no existe o ya no es pública.
        </ThemedText>
      </IgnScreen>
    );
  }

  const sourceId = list.official ? list.id : list.forkedFrom;
  const officialSeries = sourceId ? seriesOfList(sourceId) : undefined;
  const officialLoading = !!(sourceId && officialStatus.loading[sourceId]);
  const officialError = sourceId ? officialStatus.errors[sourceId] : undefined;
  const pendingCopy = pendingSeeds.includes(list.id) && !officialError;

  const mine = list.ownerId === profileId;
  const owner = lookupProfile(list.ownerId);
  const following = follows?.includes(list.id) ?? false;
  const myCopy = Object.values(myLists).find((l) => l.ownerId === profileId && l.forkedFrom === list.id);

  // Sin conexión solo se pueden ver tus propias listas.
  if (offline && !mine) {
    return (
      <OfflineNotice title="Sin conexión" text="Las listas de otros necesitan internet. Mientras tanto puedes ver y gestionar las tuyas.">
        <DarkButton label="Ir a mi perfil" onPress={() => router.replace('/profile')} />
      </OfflineNotice>
    );
  }

  const share = () => {
    const lines = visible.map((e, i) => {
      const rating = e.userGame?.rating ? ` — ${e.userGame.rating}/10` : '';
      return `${i + 1}. ${e.game.title}${e.game.year ? ` (${e.game.year})` : ''}${rating}`;
    });
    Share.share({ title: list.name, message: `🎮 ${list.name}\n${list.description ? `${list.description}\n` : ''}\n${lines.join('\n')}\n\nHecho con Saga Quest` }).catch(
      () => undefined,
    );
  };

  const fork = () => {
    const newId = forkList(list.id);
    if (newId) {
      notify('Lista añadida a tu perfil');
      router.replace(`/list/${newId}`);
    }
  };

  const remove = () =>
    Alert.alert('Borrar lista', `¿Borrar «${list.name}»? Los juegos seguirán en tu biblioteca.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          deleteList(list.id);
          router.back();
        },
      },
    ]);

  const heroH = insets.top + 330;
  const header = (
    <View style={{ paddingTop: insets.top + 6 }}>
      <BlurHero url={heroCover} colors={[list.color, list.color2]} height={heroH} />
      <View style={styles.topBar}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/lists'))} style={styles.backRow} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
          <ThemedText size={16} style={styles.white}>
            Atrás
          </ThemedText>
        </Pressable>
        <View style={styles.topIcons}>
          {mine ? (
            <Pressable onPress={() => router.push(`/search?listId=${list.id}`)} hitSlop={8}>
              <Ionicons name="add-circle-outline" size={27} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable onPress={share} hitSlop={8}>
            <Ionicons name="share-outline" size={25} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setSearching((s) => !s)} hitSlop={8}>
            <Ionicons name="search" size={25} color="#fff" />
          </Pressable>
        </View>
      </View>
      <View style={styles.mosaicWrap}>
        <Mosaic list={list} games={entries.slice(0, 4).map((e) => e.game)} size={210} radius={c.radius} />
      </View>
      <ThemedText variant="display" size={26} style={styles.title}>
        {list.name}
      </ThemedText>
      <Pressable onPress={() => owner && owner.id !== 'saga-quest' && router.push(`/user/${owner.id}`)} style={styles.byline}>
        <ThemedText variant="bold" size={14}>
          {owner?.displayName ?? 'Jugador'}
        </ThemedText>
        <ThemedText variant="muted" size={14}>
          {timeAgo(list.updatedAt)}
        </ThemedText>
      </Pressable>
      {list.description ? (
        <ThemedText variant="muted" size={13} style={styles.desc}>
          {list.description}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <IgnScreen title={list.name} header={header} collapseAt={320}>
      <View style={styles.controls}>
        {searching ? <TextField value={query} onChangeText={setQuery} placeholder="Buscar en la lista…" autoFocus /> : null}
        <SelectBox label={SORT_LABEL[sort]} onPress={() => setSortOpen(true)} />
        <View style={styles.actionRow}>
          {mine ? (
            <LightButton label="Editar" onPress={() => router.push(`/list/edit?id=${list.id}`)} style={{ flex: 1 }} />
          ) : myCopy ? (
            <LightButton label="Ver mi copia" onPress={() => router.push(`/list/${myCopy.id}`)} style={{ flex: 1 }} />
          ) : (
            <DarkButton label="Añadir a mi perfil" icon="folder-open-outline" onPress={fork} style={{ flex: 1 }} />
          )}
          {!mine ? (
            <Pressable
              onPress={() => {
                toggleFollow(list.id);
                notify(following ? 'Has dejado de seguir la lista' : 'Siguiendo la lista');
              }}
              style={[styles.round, { backgroundColor: c.inverseBg }]}
            >
              <Ionicons name={following ? 'bookmark' : 'bookmark-outline'} size={20} color={c.inverseText} />
            </Pressable>
          ) : (
            <Pressable onPress={share} style={[styles.round, { backgroundColor: c.inverseBg }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={c.inverseText} />
            </Pressable>
          )}
          <DotsButton onPress={() => setMoreOpen(true)} />
        </View>
        <Card style={styles.stats} padded={false}>
          <Stat value={String(stats.games)} label="JUEGOS" />
          <View style={[styles.statDivider, { backgroundColor: c.line }]} />
          <Stat value={formatHours(stats.totalHours).replace(' h', '')} label="HORAS" />
          <View style={[styles.statDivider, { backgroundColor: c.line }]} />
          <Pressable
            disabled={!mine}
            onPress={() => updateList(list.id, { visibility: list.visibility === 'public' ? 'private' : 'public' })}
            style={styles.stat}
          >
            <Ionicons name={list.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'} size={24} color={c.text} />
            <ThemedText variant="muted" size={10} style={styles.caps}>
              {list.official ? 'OFICIAL' : list.visibility === 'public' ? 'PÚBLICA' : 'PRIVADA'}
            </ThemedText>
          </Pressable>
        </Card>
      </View>

      {officialSeries && (officialLoading || pendingCopy) && entries.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.text} />
          <ThemedText variant="muted" size={13}>
            Descargando los juegos de {officialSeries.name} desde la API…
          </ThemedText>
        </View>
      ) : null}
      {officialSeries && officialError && entries.length === 0 ? (
        <Card style={{ marginHorizontal: 20, gap: 10 }}>
          <ThemedText variant="muted" size={13}>
            No se pudo descargar la lista: {officialError}
          </ThemedText>
          <DarkButton label="Reintentar" onPress={() => loadOfficialList(officialSeries, true)} />
        </Card>
      ) : null}
      {!officialSeries && entries.length === 0 ? (
        <View style={styles.loading}>
          <ThemedText variant="muted" size={14}>
            Esta lista está vacía.
          </ThemedText>
          {mine ? <DarkButton label="Añadir juegos" icon="add" onPress={() => router.push(`/search?listId=${list.id}`)} /> : null}
        </View>
      ) : null}

      <EntryGrid
        entries={visible.map((e) => ({ game: e.game, status: e.userGame?.status, rank: e.rank }))}
        width={width}
        showRank
        onPress={(game) => router.push(`/game/${encodeURIComponent(game.id)}`)}
        onLongPress={sheets.openMore}
      />

      <SortSheet visible={sortOpen} value={sort} onChange={setSort} onClose={() => setSortOpen(false)} />
      <Sheet visible={moreOpen} title={list.name} onClose={() => setMoreOpen(false)}>
        {mine ? (
          <>
            <SheetRow label="Editar lista" right={<Ionicons name="create-outline" size={22} color={c.text} />} onPress={() => { setMoreOpen(false); router.push(`/list/edit?id=${list.id}`); }} />
            <SheetRow label="Añadir juegos" right={<Ionicons name="add-circle-outline" size={22} color={c.text} />} onPress={() => { setMoreOpen(false); router.push(`/search?listId=${list.id}`); }} />
            <SheetRow
              label={list.visibility === 'public' ? 'Hacer privada' : 'Hacer pública'}
              right={<Ionicons name={list.visibility === 'public' ? 'lock-closed-outline' : 'globe-outline'} size={22} color={c.text} />}
              onPress={() => updateList(list.id, { visibility: list.visibility === 'public' ? 'private' : 'public' })}
            />
            <SheetRow label="Duplicar lista" right={<Ionicons name="copy-outline" size={22} color={c.text} />} onPress={() => { setMoreOpen(false); fork(); }} />
          </>
        ) : (
          <>
            <SheetRow label={myCopy ? 'Ver mi copia' : 'Añadir a mi perfil'} right={<Ionicons name="folder-open-outline" size={22} color={c.text} />} onPress={() => { setMoreOpen(false); if (myCopy) router.push(`/list/${myCopy.id}`); else fork(); }} />
            <SheetRow label={following ? 'Dejar de seguir' : 'Seguir lista'} right={<Ionicons name={following ? 'bookmark' : 'bookmark-outline'} size={22} color={c.text} />} onPress={() => toggleFollow(list.id)} />
          </>
        )}
        <SheetRow label="Compartir lista" right={<Ionicons name="share-outline" size={22} color={c.text} />} onPress={share} last={!mine} />
        {mine ? (
          <SheetRow label="Borrar lista" right={<Ionicons name="trash-outline" size={22} color="#e5484d" />} onPress={() => { setMoreOpen(false); remove(); }} last />
        ) : null}
      </Sheet>
      {sheets.element}
    </IgnScreen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="bold" size={22}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={10} style={styles.caps}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  white: { color: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  topIcons: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  mosaicWrap: { alignItems: 'center', marginTop: 14, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  title: { textAlign: 'center', marginTop: 18, paddingHorizontal: 20 },
  byline: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 6 },
  desc: { textAlign: 'center', paddingHorizontal: 28, marginTop: 8 },
  controls: { paddingHorizontal: 20, gap: 14, marginTop: 20, marginBottom: 26 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40 },
  caps: { letterSpacing: 0.8 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 20 },
});
