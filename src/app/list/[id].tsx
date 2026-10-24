import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadOfficialList, useOfficialStatus } from '@/api/official';
import { ListItemSheet } from '@/components/details';
import { useGameSheets } from '@/components/gameSheets';
import { Avatar } from '@/components/ui';
import { syncNow } from '@/cloud/engine';
import { addListMember, removeListMember, useSocial } from '@/cloud/social';
import {
  BlurHero,
  Card,
  DarkButton,
  DotsButton,
  EntryGrid,
  IgnScreen,
  LightButton,
  Mosaic,
  ProgressBar,
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
import { canEditList, useList, useListEntries, useProfileLookup } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import type { GameRecord, ListSort } from '@/types';
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
  const [itemGame, setItemGame] = useState<GameRecord | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  useFillBasics(entries.map((e) => e.game));
  const heroCover = useCover(entries[0]?.game);

  const visible = useMemo(() => {
    const sorted = sortEntries(entries, sort, mode);
    return query.trim() ? rankByQuery(query, sorted, (e) => e.game.title) : sorted;
  }, [entries, sort, mode, query]);
  const stats = entryStats(entries, mode);
  const pct = stats.games ? Math.round((stats.finished / stats.games) * 100) : 0;

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

  // mine = es tuya; editable = tuya o cooperativa en la que estás (puedes cambiar juegos y orden).
  const mine = list.ownerId === profileId;
  const editable = canEditList(list, profileId);
  const member = editable && !mine;
  const owner = lookupProfile(list.ownerId);
  const following = follows?.includes(list.id) ?? false;
  const myCopy = Object.values(myLists).find((l) => l.ownerId === profileId && l.forkedFrom === list.id);

  // Sin conexión solo se pueden ver tus propias listas.
  if (offline && !editable && !(follows?.includes(list.id) ?? false)) {
    return (
      <OfflineNotice
        title="Sin conexión"
        text="Las listas de otros necesitan internet. Mientras tanto puedes ver y gestionar las tuyas."
      >
        <DarkButton label="Ir a mi perfil" onPress={() => router.replace('/profile')} />
      </OfflineNotice>
    );
  }

  const share = () => {
    const lines = visible.map((e, i) => {
      const rating = e.userGame?.rating ? ` — ${e.userGame.rating}/10` : '';
      return `${i + 1}. ${e.game.title}${e.game.year ? ` (${e.game.year})` : ''}${rating}`;
    });
    Share.share({
      title: list.name,
      message: `🎮 ${list.name}\n${list.description ? `${list.description}\n` : ''}\n${lines.join('\n')}\n\nHecho con Saga Quest`,
    }).catch(() => undefined);
  };

  // Añadir a tu perfil = seguirla en vivo: si el autor la cambia, te cambia a ti (con tus datos de cada juego).
  const addToProfile = () => {
    toggleFollow(list.id);
    notify(following ? 'Quitada de tu perfil' : 'Añadida a tu perfil: verás sus cambios con tus datos');
    syncNow().catch(() => undefined);
  };

  const fork = () => {
    const newId = forkList(list.id);
    if (newId) {
      notify('Lista añadida a tu perfil');
      router.replace(`/list/${newId}`);
    }
  };

  const leave = () =>
    Alert.alert('Salir de la lista', `Dejarás de ver «${list.name}» y de poder editarla.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          removeListMember(list.id, profileId ?? '')
            .then(() => router.back())
            .catch((e: unknown) => notify(e instanceof Error ? e.message : 'No se pudo'));
        },
      },
    ]);

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
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/lists'))}
          style={styles.backRow}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
          <ThemedText size={16} style={styles.white}>
            Atrás
          </ThemedText>
        </Pressable>
        <View style={styles.topIcons}>
          {editable ? (
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
      <Pressable
        onPress={() => owner && owner.id !== 'saga-quest' && router.push(`/user/${owner.id}`)}
        style={styles.byline}
      >
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
      {list.members?.length || (mine && !list.official) ? (
        <Pressable onPress={() => setMembersOpen(true)} style={styles.members}>
          {[list.ownerId, ...(list.members ?? [])].slice(0, 6).map((pid, i) => {
            const p = lookupProfile(pid);
            return p ? (
              <View key={pid} style={{ marginLeft: i ? -10 : 0 }}>
                <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={30} />
              </View>
            ) : null;
          })}
          <ThemedText variant="bold" size={12} style={{ marginLeft: 8 }}>
            {list.members?.length ? `Cooperativa · ${list.members.length + 1} personas` : 'Hacer cooperativa'}
          </ThemedText>
          <Ionicons name="people-outline" size={16} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <IgnScreen title={list.name} header={header} collapseAt={320}>
      <View style={styles.controls}>
        {searching ? (
          <TextField value={query} onChangeText={setQuery} placeholder="Buscar en la lista…" autoFocus />
        ) : null}
        <SelectBox label={SORT_LABEL[sort]} onPress={() => setSortOpen(true)} />
        <View style={styles.actionRow}>
          {editable ? (
            <LightButton
              label={mine ? 'Editar' : 'Editar orden'}
              onPress={() => router.push(`/list/edit?id=${list.id}`)}
              style={{ flex: 1 }}
            />
          ) : following ? (
            <LightButton label="En tu perfil ✓" onPress={() => setMoreOpen(true)} style={{ flex: 1 }} />
          ) : (
            <DarkButton
              label="Añadir a mi perfil"
              icon="folder-open-outline"
              onPress={addToProfile}
              style={{ flex: 1 }}
            />
          )}
          {!mine && !member ? (
            <Pressable onPress={addToProfile} style={[styles.round, { backgroundColor: c.inverseBg }]}>
              <Ionicons name={following ? 'bookmark' : 'bookmark-outline'} size={20} color={c.inverseText} />
            </Pressable>
          ) : (
            <Pressable onPress={share} style={[styles.round, { backgroundColor: c.inverseBg }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={c.inverseText} />
            </Pressable>
          )}
          <DotsButton onPress={() => setMoreOpen(true)} />
        </View>
        <Card padded={false}>
          <View style={styles.stats}>
            <Stat value={String(stats.games)} label="JUEGOS" />
            <View style={[styles.statDivider, { backgroundColor: c.line }]} />
            <Stat value={`${pct}%`} label="COMPLETADO" />
            <View style={[styles.statDivider, { backgroundColor: c.line }]} />
            <Stat value={formatHours(stats.totalHours).replace(' h', '')} label="HORAS" />
            <View style={[styles.statDivider, { backgroundColor: c.line }]} />
            <Pressable
              disabled={!mine}
              onPress={() => updateList(list.id, { visibility: list.visibility === 'public' ? 'private' : 'public' })}
              style={styles.stat}
            >
              <Ionicons
                name={list.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                size={24}
                color={c.text}
              />
              <ThemedText variant="muted" size={10} style={styles.caps}>
                {list.official ? 'OFICIAL' : list.visibility === 'public' ? 'PÚBLICA' : 'PRIVADA'}
              </ThemedText>
            </Pressable>
          </View>
          {stats.games ? (
            <View style={styles.progress}>
              <ProgressBar pct={pct} height={8} />
              <ThemedText variant="muted" size={12}>
                {stats.finished} de {stats.games} terminados
                {stats.hoursLeft ? ` · te quedan ${formatHours(stats.hoursLeft)}` : ''}
              </ThemedText>
            </View>
          ) : null}
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
          {editable ? (
            <DarkButton label="Añadir juegos" icon="add" onPress={() => router.push(`/search?listId=${list.id}`)} />
          ) : null}
        </View>
      ) : null}

      <EntryGrid
        entries={visible.map((e) => ({
          game: e.game,
          status: e.userGame?.status,
          rank: e.rank,
          replays: e.item.replays,
          note: e.item.note,
          physical: e.userGame?.owned,
        }))}
        width={width}
        showRank
        onPress={(game) => router.push(`/game/${encodeURIComponent(game.id)}`)}
        onLongPress={mine ? setItemGame : sheets.openMore}
        onReplays={mine ? setItemGame : undefined}
      />
      {mine ? (
        <ThemedText variant="muted" size={11} style={styles.hint}>
          Toca la flecha de un juego (o mantenlo pulsado) para apuntar las veces que lo rejugaste y añadir una nota.
        </ThemedText>
      ) : null}
      {itemGame ? <ListItemSheet listId={list.id} game={itemGame} onClose={() => setItemGame(null)} /> : null}

      <SortSheet visible={sortOpen} value={sort} onChange={setSort} onClose={() => setSortOpen(false)} />
      <Sheet visible={moreOpen} title={list.name} onClose={() => setMoreOpen(false)}>
        {member ? (
          <>
            <SheetRow
              label="Añadir juegos"
              right={<Ionicons name="add-circle-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                router.push(`/search?listId=${list.id}`);
              }}
            />
            <SheetRow
              label="Editar orden"
              right={<Ionicons name="swap-vertical" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                router.push(`/list/edit?id=${list.id}`);
              }}
            />
            <SheetRow
              label="Ver quién está"
              right={<Ionicons name="people-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                setMembersOpen(true);
              }}
            />
            <SheetRow
              label="Duplicar como lista mía"
              right={<Ionicons name="copy-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                fork();
              }}
            />
            <SheetRow
              label="Salir de la lista"
              right={<Ionicons name="exit-outline" size={22} color="#e5484d" />}
              onPress={() => {
                setMoreOpen(false);
                leave();
              }}
            />
          </>
        ) : mine ? (
          <>
            <SheetRow
              label="Editar lista"
              right={<Ionicons name="create-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                router.push(`/list/edit?id=${list.id}`);
              }}
            />
            <SheetRow
              label="Añadir juegos"
              right={<Ionicons name="add-circle-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                router.push(`/search?listId=${list.id}`);
              }}
            />
            <SheetRow
              label={list.visibility === 'public' ? 'Hacer privada' : 'Hacer pública'}
              right={
                <Ionicons
                  name={list.visibility === 'public' ? 'lock-closed-outline' : 'globe-outline'}
                  size={22}
                  color={c.text}
                />
              }
              onPress={() => updateList(list.id, { visibility: list.visibility === 'public' ? 'private' : 'public' })}
            />
            {!list.official ? (
              <SheetRow
                label="Amigos que la editan"
                caption={list.members?.length ? `${list.members.length} en la lista` : 'Hazla cooperativa'}
                right={<Ionicons name="people-outline" size={22} color={c.text} />}
                onPress={() => {
                  setMoreOpen(false);
                  setMembersOpen(true);
                }}
              />
            ) : null}
            <SheetRow
              label="Duplicar lista"
              right={<Ionicons name="copy-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                fork();
              }}
            />
          </>
        ) : (
          <>
            <SheetRow
              label={following ? 'Quitar de mi perfil' : 'Añadir a mi perfil'}
              caption={following ? undefined : 'Verás los cambios del autor, con tus datos'}
              right={<Ionicons name={following ? 'bookmark' : 'bookmark-outline'} size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                addToProfile();
              }}
            />
            <SheetRow
              label={myCopy ? 'Ver mi copia' : 'Duplicar como lista mía'}
              caption={myCopy ? undefined : 'Una copia tuya que puedes cambiar'}
              right={<Ionicons name="copy-outline" size={22} color={c.text} />}
              onPress={() => {
                setMoreOpen(false);
                if (myCopy) router.push(`/list/${myCopy.id}`);
                else fork();
              }}
            />
          </>
        )}
        <SheetRow
          label="Compartir lista"
          right={<Ionicons name="share-outline" size={22} color={c.text} />}
          onPress={share}
          last={!mine}
        />
        {mine ? (
          <SheetRow
            label="Borrar lista"
            right={<Ionicons name="trash-outline" size={22} color="#e5484d" />}
            onPress={() => {
              setMoreOpen(false);
              remove();
            }}
            last
          />
        ) : null}
      </Sheet>
      {membersOpen ? (
        <MembersSheet
          listId={list.id}
          ownerId={list.ownerId}
          members={list.members ?? []}
          canManage={mine}
          onClose={() => setMembersOpen(false)}
        />
      ) : null}
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
  mosaicWrap: {
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { textAlign: 'center', marginTop: 18, paddingHorizontal: 20 },
  byline: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 6 },
  desc: { textAlign: 'center', paddingHorizontal: 28, marginTop: 8 },
  controls: { paddingHorizontal: 20, gap: 14, marginTop: 20, marginBottom: 26 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  progress: { paddingHorizontal: 18, paddingBottom: 16, gap: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40 },
  caps: { letterSpacing: 0.8 },
  hint: { paddingHorizontal: 20, marginTop: 22, textAlign: 'center' },
  members: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 12 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 20 },
});

// Amigos que editan la lista (cooperativa). El dueño añade o quita; los demás solo ven.
function MembersSheet({
  listId,
  ownerId,
  members,
  canManage,
  onClose,
}: {
  listId: string;
  ownerId: string;
  members: string[];
  canManage: boolean;
  onClose: () => void;
}) {
  const c = useIgnColors();
  const uid = useStore((s) => s.cloudUserId);
  const lookup = useProfileLookup();
  const { friendships, profiles } = useSocial();
  const [busy, setBusy] = useState<string | null>(null);
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester === uid ? f.addressee : f.requester));
  const people = canManage ? [...new Set([...members, ...friends])] : [ownerId, ...members];
  const toggle = async (pid: string) => {
    setBusy(pid);
    try {
      if (members.includes(pid)) await removeListMember(listId, pid);
      else await addListMember(listId, pid);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet visible title="Lista cooperativa" onClose={onClose}>
      <ThemedText variant="muted" size={12} style={{ marginBottom: 8 }}>
        Los que estén pueden añadir y quitar juegos y cambiar el orden, y el cambio lo ven todos. Cada uno ve sus
        propios datos de cada juego (estado, nota…).
      </ThemedText>
      {people.length === 0 ? (
        <ThemedText variant="muted" size={13}>
          Añade amigos en la pestaña Amigos para poder invitarlos.
        </ThemedText>
      ) : null}
      {people.map((pid) => {
        const p = profiles[pid] ?? lookup(pid);
        if (!p) return null;
        const inList = pid === ownerId || members.includes(pid);
        return (
          <View key={pid} style={[styles.memberRow, { borderBottomColor: c.line }]}>
            <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={38} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="bold" size={14}>
                {p.displayName}
              </ThemedText>
              <ThemedText variant="muted" size={11}>
                {pid === ownerId ? 'Creador' : inList ? 'Editor' : `@${p.username}`}
              </ThemedText>
            </View>
            {canManage && pid !== ownerId ? (
              busy === pid ? (
                <ActivityIndicator color={c.text} />
              ) : (
                <Pressable onPress={() => toggle(pid)} hitSlop={8}>
                  <Ionicons
                    name={inList ? 'checkmark-circle' : 'add-circle-outline'}
                    size={26}
                    color={inList ? c.accent : c.muted}
                  />
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}
    </Sheet>
  );
}
