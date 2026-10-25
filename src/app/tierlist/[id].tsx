import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { GameCover } from '@/components/games';
import { Card, DarkButton, HeaderIcon, IgnScreen, LightButton, Sheet, SheetRow, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { STATUS_META } from '@/data/meta';
import { useMyGames } from '@/hooks/useMyGames';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { GameRecord, TierList } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { notify } from '@/utils/notify';
import { locate, moveTo, removeGame } from '@/utils/tierlist';
import { shareImage } from '@/utils/shareImage';
import { goBack } from '@/utils/nav';

const COLS = 5;

// Una portada de la tier list: no se vuelve a crear al tocar otra (así no parpadea).
const TierCover = memo(function TierCover({
  game,
  width,
  on,
  onTap,
  accent,
}: {
  game: GameRecord;
  width: number;
  on: boolean;
  onTap: (id: string) => void;
  accent: string;
}) {
  return (
    <Pressable onPress={() => onTap(game.id)} style={{ transform: [{ scale: on ? 1.08 : 1 }] }}>
      <GameCover game={game} width={width} plain radius={4} />
      {on ? <View pointerEvents="none" style={[styles.selected, { borderColor: accent }]} /> : null}
    </Pressable>
  );
});

// Editor de una tier list: toca un juego para elegirlo y toca una fila para colocarlo.
export default function TierEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const games = useStore((s) => s.games);
  const updateProfile = useStore((s) => s.updateProfile);
  const mine = useMyGames();
  const lists = useMemo(() => profile?.tierlists ?? [], [profile?.tierlists]);
  const t = lists.find((x) => x.id === id) ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const board = useRef<View>(null);
  // El título se guarda al terminar de escribir (no con cada letra).
  const [title, setTitle] = useState<string | null>(null);

  const save = (next: TierList) => updateProfile({ tierlists: lists.map((x) => (x.id === next.id ? next : x)) });

  const candidates = useMemo(() => {
    const order = (s: string) => ['completed', 'beaten', 'playing', 'paused', 'watched', 'dropped'].indexOf(s);
    const sorted = [...mine].sort((a, b) => {
      const oa = order(a.ug.status);
      const ob = order(b.ug.status);
      return (oa < 0 ? 9 : oa) - (ob < 0 ? 9 : ob) || a.game.title.localeCompare(b.game.title);
    });
    return (query.trim() ? rankByQuery(query, sorted, (m) => m.game.title) : sorted).slice(0, 80);
  }, [mine, query]);

  if (!t) {
    return (
      <IgnScreen title="Tier list" back contentStyle={{ paddingHorizontal: 20 }}>
        <ThemedText variant="muted">Esta tier list ya no existe.</ThemedText>
      </IgnScreen>
    );
  }

  const labelW = 54;
  const cell = Math.floor((width - 40 - labelW - 12 - (COLS - 1) * 4) / COLS);
  const where = selected ? locate(t, selected) : null;

  const tap = (gameId: string) => setSelected((s) => (s === gameId ? null : gameId));
  const commitTitle = () => {
    if (title !== null && title.trim() && title !== t.title)
      save({ ...t, title: title.trim(), updatedAt: new Date().toISOString() });
    setTitle(null);
  };
  const drop = (tier: number) => {
    if (!selected) return;
    save(moveTo(t, selected, tier));
    setSelected(null);
  };

  const share = async () => {
    try {
      setSharing(true);
      setSelected(null);
      await new Promise((r) => setTimeout(r, 60));
      await shareImage(board, t.title);
    } catch {
      notify('No se pudo compartir');
    } finally {
      setSharing(false);
    }
  };

  return (
    <IgnScreen
      title={t.title}
      back
      right={
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <HeaderIcon icon="share-outline" onPress={share} label="Compartir" />
          <HeaderIcon icon="add-circle-outline" onPress={() => setPicking(true)} label="Añadir juegos" />
        </View>
      }
      contentStyle={{ paddingHorizontal: 20, gap: 14 }}
    >
      <TextInput
        value={title ?? t.title}
        onChangeText={setTitle}
        onEndEditing={commitTitle}
        onBlur={commitTitle}
        style={[styles.title, { color: c.text, borderColor: c.line, borderRadius: c.radius }]}
        placeholder="Título"
        placeholderTextColor={c.muted}
        maxLength={60}
      />

      <View ref={board} collapsable={false} style={[styles.board, { backgroundColor: c.bg }]}>
        {sharing ? (
          <ThemedText variant="display" size={20} style={{ marginBottom: 6 }}>
            {t.title}
          </ThemedText>
        ) : null}
        {t.tiers.map((tier, i) => (
          <Pressable
            key={tier.label}
            onPress={() => drop(i)}
            style={[
              styles.tierRow,
              {
                borderColor: selected && where !== i ? tier.color : c.line,
                backgroundColor: c.card,
                borderStyle: selected && where !== i ? 'dashed' : 'solid',
              },
            ]}
          >
            <View style={[styles.tierLabel, { width: labelW, backgroundColor: tier.color }]}>
              <ThemedText variant="display" size={24} style={{ color: '#111' }}>
                {tier.label}
              </ThemedText>
            </View>
            <View style={styles.tierGames}>
              {tier.gameIds.map((gid) =>
                games[gid] ? (
                  <TierCover
                    key={gid}
                    game={games[gid]}
                    width={cell}
                    on={selected === gid}
                    onTap={tap}
                    accent={c.accent}
                  />
                ) : null,
              )}
            </View>
          </Pressable>
        ))}
        {sharing ? (
          <ThemedText variant="muted" size={11} style={{ textAlign: 'right' }}>
            SAGA QUEST
          </ThemedText>
        ) : null}
      </View>

      {selected ? (
        <Card style={{ gap: 10 }}>
          <ThemedText variant="bold" size={13}>
            {`${games[selected]?.title ?? ''}: toca una fila para moverlo`}
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {where !== null && where >= 0 ? (
              <LightButton label="Sin colocar" onPress={() => drop(-1)} style={{ flex: 1 }} />
            ) : null}
            <LightButton
              label="Quitar"
              onPress={() => {
                save(removeGame(t, selected));
                setSelected(null);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : null}

      <ThemedText variant="bold" size={12} style={styles.caps}>
        {`Sin colocar (${(t.pool ?? []).length})`}
      </ThemedText>
      <Pressable onPress={() => drop(-1)} style={[styles.pool, { borderColor: c.line, borderRadius: c.radius }]}>
        {(t.pool ?? []).map((gid) =>
          games[gid] ? (
            <TierCover key={gid} game={games[gid]} width={cell} on={selected === gid} onTap={tap} accent={c.accent} />
          ) : null,
        )}
        {!(t.pool ?? []).length ? (
          <ThemedText variant="muted" size={13} style={{ padding: 8 }}>
            Pulsa ⊕ arriba para añadir juegos de tu biblioteca.
          </ThemedText>
        ) : null}
      </Pressable>
      <DarkButton label="Añadir juegos" icon="add" onPress={() => setPicking(true)} />

      <Pressable
        onPress={() => {
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          updateProfile({ tierlists: lists.filter((x) => x.id !== t.id) });
          goBack();
        }}
        style={styles.delete}
      >
        <Ionicons name="trash-outline" size={16} color="#e5484d" />
        <ThemedText variant="bold" size={13} style={{ color: '#e5484d' }}>
          {confirmDelete ? 'Toca otra vez para borrarla' : 'Borrar tier list'}
        </ThemedText>
      </Pressable>

      <Sheet visible={picking} title="Añadir a la tier list" onClose={() => setPicking(false)}>
        <TextField value={query} onChangeText={setQuery} placeholder="Buscar en tu biblioteca…" />
        {candidates.map((m, i) => {
          const at = locate(t, m.game.id);
          return (
            <SheetRow
              key={m.game.id}
              label={m.game.title}
              caption={
                at === null ? STATUS_META[m.ug.status].label : at === -1 ? 'Sin colocar' : `En ${t.tiers[at].label}`
              }
              left={<GameCover game={m.game} width={30} plain radius={3} />}
              selected={at !== null}
              last={i === candidates.length - 1}
              onPress={() => save(at === null ? moveTo(t, m.game.id, -1) : removeGame(t, m.game.id))}
            />
          );
        })}
      </Sheet>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  title: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  board: { gap: 6, paddingVertical: 4 },
  tierRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden', minHeight: 72 },
  tierLabel: { alignItems: 'center', justifyContent: 'center' },
  tierGames: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 6 },
  selected: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 5, borderWidth: 2.5 },
  pool: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: 80,
  },
  caps: { letterSpacing: 0.8, textTransform: 'uppercase' },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
});
