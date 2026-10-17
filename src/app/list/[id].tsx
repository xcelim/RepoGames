import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameRow } from '@/components/games';
import { Segmented } from '@/components/Segmented';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, Chip, EmptyState, IconButton, TextField, type IconName } from '@/components/ui';
import { SORT_LABEL, STATUS_META, STATUS_ORDER } from '@/data/meta';
import { useList, useListEntries, useProfileLookup } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import type { ListSort, PlayStatus } from '@/types';
import {
  entryStats,
  filterEntries,
  formatHours,
  gameHours,
  sortEntries,
  type EntryFilter,
} from '@/utils/library';
import { notify } from '@/utils/notify';

const SORTS: ListSort[] = ['manual', 'release', 'rating', 'duration', 'title', 'status', 'added'];

function ActionButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const skin = useSkin();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: active ? skin.colors.accent : skin.colors.panel,
          borderColor: active ? skin.colors.accent : skin.colors.line,
          borderRadius: Math.min(skin.radius, 14),
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={active ? skin.colors.onAccent : skin.colors.accent} />
      <ThemedText
        variant="bold"
        size={11}
        numberOfLines={1}
        style={{ color: active ? skin.colors.onAccent : skin.colors.text }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  const list = useList(id);
  const entries = useListEntries(id);
  const lookupProfile = useProfileLookup();

  const profileId = useStore((s) => s.currentProfileId);
  const mode = useStore((s) => s.durationMode);
  const setMode = useStore((s) => s.setDurationMode);
  const follows = useStore((s) => (s.currentProfileId ? s.follows[s.currentProfileId] : undefined));
  const myLists = useStore((s) => s.lists);
  const forkList = useStore((s) => s.forkList);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const moveInList = useStore((s) => s.moveInList);
  const removeFromList = useStore((s) => s.removeFromList);
  const setStatus = useStore((s) => s.setStatus);

  const [sort, setSort] = useState<ListSort>('manual');
  const [descending, setDescending] = useState(false);
  const [filter, setFilter] = useState<EntryFilter>({
    statuses: [],
    includeUntracked: true,
    platform: null,
    query: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [statusMenu, setStatusMenu] = useState(false);

  const visible = useMemo(
    () => sortEntries(filterEntries(entries, filter), sort, mode, descending),
    [entries, filter, sort, mode, descending],
  );
  const stats = entryStats(entries, mode);
  const platforms = useMemo(
    () => [...new Set(entries.map((e) => e.userGame?.platform).filter((p): p is string => !!p))],
    [entries],
  );

  if (!list) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + 40 }]}>
        <EmptyState icon="alert-circle-outline" title="Esta lista no existe">
          <ThemedText variant="bold" onPress={() => router.back()} style={{ color: skin.colors.accent }}>
            Volver
          </ThemedText>
        </EmptyState>
      </View>
    );
  }

  const mine = list.ownerId === profileId;
  const owner = lookupProfile(list.ownerId);
  const following = follows?.includes(list.id) ?? false;
  const myCopy = Object.values(myLists).find(
    (l) => l.ownerId === profileId && l.forkedFrom === list.id,
  );
  const filtersActive =
    filter.statuses.length > 0 || !!filter.platform || filter.query.trim().length > 0;
  const canReorder = mine && sort === 'manual' && !filtersActive;

  const toggleStatusFilter = (status: PlayStatus) =>
    setFilter((f) => ({
      ...f,
      statuses: f.statuses.includes(status)
        ? f.statuses.filter((s) => s !== status)
        : [...f.statuses, status],
    }));

  const share = () => {
    const lines = entries.map((e) => {
      const rating = e.userGame?.rating ? ` — ${e.userGame.rating}/10` : '';
      return `${e.rank}. ${e.game.title}${e.game.year ? ` (${e.game.year})` : ''}${rating}`;
    });
    Share.share({
      title: list.name,
      message: `🎮 ${list.name}\n${list.description ? `${list.description}\n` : ''}\n${lines.join('\n')}\n\nHecho con Saga Quest`,
    });
  };

  const fork = () => {
    const newId = forkList(list.id);
    if (newId) {
      notify('Lista añadida a tu perfil');
      router.replace(`/list/${newId}`);
    }
  };

  const toggleSelected = (itemId: string) =>
    setSelected((s) => (s.includes(itemId) ? s.filter((x) => x !== itemId) : [...s, itemId]));

  const selectedEntries = entries.filter((e) => selected.includes(e.item.id));

  const applyStatus = (status: PlayStatus) => {
    selectedEntries.forEach((e) => setStatus(e.game.id, status));
    notify(`${selectedEntries.length} juegos → ${STATUS_META[status].short}`);
    setStatusMenu(false);
    setSelecting(false);
    setSelected([]);
  };

  const removeSelected = () => {
    Alert.alert('Quitar de la lista', `¿Quitar ${selectedEntries.length} juegos de «${list.name}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          selectedEntries.forEach((e) => removeFromList(list.id, e.game.id));
          setSelecting(false);
          setSelected([]);
        },
      },
    ]);
  };

  const header = (
    <View style={styles.headerBlock}>
      <View style={[styles.hero, { borderRadius: Math.min(skin.radius, 20) }]}>
        <LinearGradient
          colors={[list.color, list.color2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons
          name={list.icon as IconName}
          size={150}
          color="rgba(255,255,255,0.18)"
          style={styles.heroIcon}
        />
        <View style={styles.heroTop}>
          <IconButton icon="chevron-back" label="Volver" color="#fff" onPress={() => router.back()} />
          <View style={styles.flex} />
          {mine ? (
            <IconButton
              icon="create-outline"
              label="Editar lista"
              color="#fff"
              onPress={() => router.push(`/list/edit?id=${list.id}`)}
            />
          ) : null}
        </View>
        <View style={styles.heroBottom}>
          <View style={styles.badge}>
            <Ionicons
              name={list.visibility === 'public' ? 'globe-outline' : 'lock-closed'}
              size={12}
              color="#fff"
            />
            <ThemedText variant="bold" size={11} style={styles.white}>
              {list.official ? 'OFICIAL' : list.visibility === 'public' ? 'PÚBLICA' : 'PRIVADA'}
            </ThemedText>
          </View>
          <ThemedText variant="display" size={32} style={styles.white}>
            {list.name}
          </ThemedText>
          {owner ? (
            <Pressable onPress={() => router.push(`/user/${owner.id}`)} style={styles.owner}>
              <Avatar name={owner.displayName} color={owner.avatarColor} size={22} />
              <ThemedText variant="bold" size={13} style={styles.white}>
                {owner.displayName}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {list.description ? <ThemedText variant="muted">{list.description}</ThemedText> : null}

      <View style={styles.statLine}>
        <ThemedText variant="bold">{stats.games} juegos</ThemedText>
        <ThemedText variant="muted">· {stats.finished} terminados</ThemedText>
        <ThemedText variant="muted">· {formatHours(stats.totalHours)} en total</ThemedText>
        <ThemedText variant="muted">· te faltan {formatHours(stats.hoursLeft)}</ThemedText>
        {stats.averageRating !== null ? (
          <ThemedText variant="muted">· nota media {stats.averageRating}</ThemedText>
        ) : null}
      </View>
      <View style={[styles.progressTrack, { backgroundColor: skin.colors.panel2 }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${stats.games ? (stats.finished / stats.games) * 100 : 0}%`,
              backgroundColor: skin.colors.accent,
            },
          ]}
        />
      </View>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'main', label: 'Historia' },
          { value: 'extra', label: '+ Secundarias' },
          { value: 'full', label: '100 %' },
        ]}
      />

      <View style={styles.actions}>
        {mine ? (
          <>
            <ActionButton icon="add" label="Añadir" onPress={() => router.push(`/search?listId=${list.id}`)} />
            <ActionButton
              icon="swap-vertical"
              label="Ordenar"
              active={reorder}
              onPress={() => {
                if (!canReorder && !reorder) {
                  setSort('manual');
                  setDescending(false);
                  setFilter({ statuses: [], includeUntracked: true, platform: null, query: '' });
                }
                setSelecting(false);
                setReorder((v) => !v);
              }}
            />
          </>
        ) : (
          <>
            <ActionButton
              icon={myCopy ? 'checkmark-done' : 'folder-open'}
              label={myCopy ? 'Mi copia' : 'A mi perfil'}
              onPress={myCopy ? () => router.push(`/list/${myCopy.id}`) : fork}
            />
            <ActionButton
              icon={following ? 'bookmark' : 'bookmark-outline'}
              label={following ? 'Siguiendo' : 'Seguir'}
              active={following}
              onPress={() => toggleFollow(list.id)}
            />
          </>
        )}
        <ActionButton
          icon="checkbox-outline"
          label="Seleccionar"
          active={selecting}
          onPress={() => {
            setReorder(false);
            setSelecting((v) => !v);
            setSelected([]);
          }}
        />
        <ActionButton icon="share-social-outline" label="Compartir" onPress={share} />
      </View>

      <View style={styles.sortHeader}>
        <ThemedText variant="muted" size={12}>
          Ordenar por
        </ThemedText>
        <View style={styles.flex} />
        <Pressable onPress={() => setDescending((v) => !v)} hitSlop={8} style={styles.inline}>
          <Ionicons name={descending ? 'arrow-up' : 'arrow-down'} size={14} color={skin.colors.accent} />
          <ThemedText variant="bold" size={12} style={{ color: skin.colors.accent }}>
            {descending ? 'Invertido' : 'Normal'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setShowFilters((v) => !v)} hitSlop={8} style={styles.inline}>
          <Ionicons name="funnel-outline" size={14} color={skin.colors.accent} />
          <ThemedText variant="bold" size={12} style={{ color: skin.colors.accent }}>
            Filtros{filtersActive ? ' •' : ''}
          </ThemedText>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SORTS.map((s) => (
          <Chip
            key={s}
            label={SORT_LABEL[s]}
            selected={sort === s}
            onPress={() => {
              setSort(s);
              if (s !== 'manual') setReorder(false);
            }}
          />
        ))}
      </ScrollView>

      {showFilters ? (
        <View style={styles.filters}>
          <TextField
            value={filter.query}
            onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
            placeholder="Buscar en esta lista"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_ORDER.map((s) => (
              <Chip
                key={s}
                label={STATUS_META[s].short}
                icon={STATUS_META[s].icon as IconName}
                color={STATUS_META[s].color}
                selected={filter.statuses.includes(s)}
                onPress={() => toggleStatusFilter(s)}
              />
            ))}
          </ScrollView>
          {filter.statuses.length > 0 ? (
            <Chip
              label="Incluir juegos sin estado"
              selected={filter.includeUntracked}
              onPress={() => setFilter((f) => ({ ...f, includeUntracked: !f.includeUntracked }))}
            />
          ) : null}
          {platforms.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip
                label="Todas las plataformas"
                selected={!filter.platform}
                onPress={() => setFilter((f) => ({ ...f, platform: null }))}
              />
              {platforms.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  selected={filter.platform === p}
                  onPress={() => setFilter((f) => ({ ...f, platform: p }))}
                />
              ))}
            </ScrollView>
          ) : null}
          {filtersActive ? (
            <ThemedText
              variant="bold"
              size={13}
              style={{ color: skin.colors.accent }}
              onPress={() => setFilter({ statuses: [], includeUntracked: true, platform: null, query: '' })}
            >
              Quitar filtros
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {reorder ? (
        <ThemedText variant="muted" size={12}>
          Usa las flechas para mover cada juego. Tu orden se guarda al momento.
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={visible}
        keyExtractor={(entry) => entry.item.id}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + (selecting ? 140 : 40) },
        ]}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: entry, index }) => {
          const isSelected = selected.includes(entry.item.id);
          return (
            <GameRow
              game={entry.game}
              userGame={entry.userGame}
              rank={sort === 'manual' ? entry.rank : index + 1}
              hours={gameHours(entry.game, mode) || null}
              selected={selecting && isSelected}
              onPress={
                selecting
                  ? () => toggleSelected(entry.item.id)
                  : () => router.push(`/game/${encodeURIComponent(entry.game.id)}`)
              }
              right={
                selecting ? (
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSelected ? skin.colors.accent : skin.colors.muted}
                  />
                ) : reorder && canReorder ? (
                  <View style={styles.reorder}>
                    <IconButton
                      icon="chevron-up"
                      label="Subir"
                      size={20}
                      disabled={entry.rank === 1}
                      onPress={() => moveInList(list.id, entry.rank - 1, entry.rank - 2)}
                    />
                    <IconButton
                      icon="chevron-down"
                      label="Bajar"
                      size={20}
                      disabled={entry.rank === entries.length}
                      onPress={() => moveInList(list.id, entry.rank - 1, entry.rank)}
                    />
                  </View>
                ) : undefined
              }
            />
          );
        }}
        ListEmptyComponent={
          entries.length === 0 ? (
            <EmptyState
              icon="albums-outline"
              title="Lista vacía"
              text={mine ? 'Añade juegos con el botón «Añadir».' : 'Esta lista todavía no tiene juegos.'}
            />
          ) : (
            <EmptyState icon="filter-outline" title="Ningún juego con estos filtros" />
          )
        }
      />

      {selecting ? (
        <View
          style={[
            styles.selectionBar,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: skin.colors.panel,
              borderTopColor: skin.colors.line,
            },
          ]}
        >
          {statusMenu ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {STATUS_ORDER.map((s) => (
                <Chip
                  key={s}
                  label={STATUS_META[s].short}
                  icon={STATUS_META[s].icon as IconName}
                  color={STATUS_META[s].color}
                  onPress={() => applyStatus(s)}
                />
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.selectionRow}>
            <ThemedText variant="bold" style={styles.flex}>
              {selected.length} seleccionados
            </ThemedText>
            <Chip
              label={selected.length === visible.length ? 'Ninguno' : 'Todos'}
              onPress={() =>
                setSelected(selected.length === visible.length ? [] : visible.map((e) => e.item.id))
              }
            />
            <Chip
              label="Estado"
              icon="flag-outline"
              selected={statusMenu}
              onPress={() => selected.length > 0 && setStatusMenu((v) => !v)}
            />
            {mine ? (
              <IconButton
                icon="trash-outline"
                label="Quitar de la lista"
                color="#e5484d"
                disabled={selected.length === 0}
                onPress={removeSelected}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#ffffff' },
  content: { paddingHorizontal: 16, gap: 10 },
  headerBlock: { gap: 12, marginBottom: 4 },
  hero: { height: 230, overflow: 'hidden', justifyContent: 'space-between' },
  heroIcon: { position: 'absolute', right: -20, bottom: -20 },
  heroTop: { flexDirection: 'row', padding: 6 },
  heroBottom: { padding: 16, gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderWidth: 1 },
  sortHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chips: { gap: 8, paddingRight: 16 },
  filters: { gap: 10 },
  reorder: { gap: 0 },
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  selectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
