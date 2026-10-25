import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Chip } from '@/components/ui';
import { STATUS_META } from '@/data/meta';
import { useMyGames, type MyGame } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import type { PlayStatus } from '@/types';
import { formatHours, gameHours } from '@/utils/library';

type Sort = 'color' | 'title' | 'length' | 'year';
type Filter = 'all' | 'finished' | 'pending' | 'physical';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'color', label: 'Arcoíris' },
  { id: 'title', label: 'A-Z' },
  { id: 'length', label: 'Duración' },
  { id: 'year', label: 'Año' },
];
const FILTERS: { id: Filter; label: string; statuses?: PlayStatus[] }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'finished', label: 'Terminados', statuses: ['beaten', 'completed'] },
  { id: 'pending', label: 'Pendientes', statuses: ['backlog', 'paused', 'playing', 'library'] },
  { id: 'physical', label: 'En físico' },
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

type Spine = { mg: MyGame; w: number; h: number; c1: string; c2: string; hue: number };

function SpineView({ spine, onPress, active }: { spine: Spine; onPress: () => void; active: boolean }) {
  const [lift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(lift, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, lift]);
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const { w, h, c1, c2, mg } = spine;
  const done = mg.ug.status === 'beaten' || mg.ug.status === 'completed';
  return (
    <Pressable onPress={onPress}>
      <Animated.View style={{ width: w, height: h, transform: [{ translateY }] }}>
        <LinearGradient
          colors={[c1, c2, c1]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.spine, { width: w, height: h }]}
        >
          <View style={[styles.band, { top: 10, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
          <View style={[styles.band, { bottom: done ? 22 : 10, backgroundColor: 'rgba(0,0,0,0.25)' }]} />
          {/* Título en vertical, como en un lomo de verdad */}
          <View style={[styles.titleBox, { width: h - 40, height: w, left: (w - (h - 40)) / 2, top: (h - w) / 2 }]}>
            <ThemedText variant="bold" size={Math.min(12, w * 0.42)} numberOfLines={1} style={styles.spineText}>
              {mg.game.title}
            </ThemedText>
          </View>
          {done ? <View style={[styles.doneDot, { left: w / 2 - 4 }]} /> : null}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// Tu biblioteca como una estantería: cada juego es un lomo (más gordo cuanto más largo es).
export default function ShelfScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const mine = useMyGames();
  const mode = useStore((s) => s.durationMode);
  const [sort, setSort] = useState<Sort>('color');
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState<string | null>(null);

  const spines = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const list = mine.filter((m) =>
      filter === 'physical' ? m.ug.owned : f.statuses ? f.statuses.includes(m.ug.status) : m.ug.status !== 'wishlist',
    );
    const out: Spine[] = list.map((mg) => {
      const hours = gameHours(mg.game, mode);
      const hue = hash(`${mg.game.title}#`) % 360;
      const sat = 45 + (hash(mg.game.id) % 25);
      return {
        mg,
        w: Math.round(22 + Math.min(22, Math.sqrt(hours || 12) * 3)),
        h: 150 + (hash(mg.game.id) % 46),
        c1: `hsl(${hue}, ${sat}%, 32%)`,
        c2: `hsl(${hue}, ${sat + 10}%, 48%)`,
        hue,
      };
    });
    const key: Record<Sort, (s: Spine) => number | string> = {
      color: (s) => s.hue,
      title: (s) => s.mg.game.title.toLowerCase(),
      length: (s) => -gameHours(s.mg.game, mode),
      year: (s) => s.mg.game.year ?? 9999,
    };
    return out.sort((a, b) => {
      const ka = key[sort](a);
      const kb = key[sort](b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }, [mine, filter, sort, mode]);

  // Reparte los lomos en baldas según el ancho.
  const inner = width - 40 - 20;
  const shelves = useMemo(() => {
    const rows: Spine[][] = [];
    let row: Spine[] = [];
    let used = 0;
    for (const s of spines) {
      if (used + s.w + 2 > inner && row.length) {
        rows.push(row);
        row = [];
        used = 0;
      }
      row.push(s);
      used += s.w + 2;
    }
    if (row.length) rows.push(row);
    return rows;
  }, [spines, inner]);
  const shown = shelves.length; // todas las baldas (si aparecen a trozos, el scroll da saltos)
  const pick = active ? spines.find((s) => s.mg.game.id === active) : null;

  return (
    <IgnScreen title="Estantería" back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>
      <View style={styles.chips}>
        {SORTS.map((s) => (
          <Chip key={s.id} label={s.label} selected={sort === s.id} onPress={() => setSort(s.id)} />
        ))}
      </View>
      <ThemedText variant="muted" size={12}>
        {`${spines.length} lomos · más gordos cuanto más duran · el punto dorado es que lo terminaste`}
      </ThemedText>

      {pick ? (
        <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <GameCover game={pick.mg.game} width={70} />
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText variant="bold" size={15} numberOfLines={2}>
              {pick.mg.game.title}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {[
                STATUS_META[pick.mg.ug.status].label,
                pick.mg.game.year,
                gameHours(pick.mg.game, mode) ? formatHours(gameHours(pick.mg.game, mode)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <DarkButton
              label="Abrir ficha"
              onPress={() => router.push(`/game/${encodeURIComponent(pick.mg.game.id)}`)}
              style={{ marginTop: 4 }}
            />
          </View>
        </Card>
      ) : null}

      {shelves.length === 0 ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            No hay juegos con ese filtro.
          </ThemedText>
        </Card>
      ) : null}
      <View style={{ gap: 0 }}>
        {shelves.slice(0, shown).map((row, i) => (
          <View key={i} style={styles.shelf}>
            <View style={styles.books}>
              {row.map((s) => (
                <SpineView
                  key={s.mg.game.id}
                  spine={s}
                  active={active === s.mg.game.id}
                  onPress={() => setActive((a) => (a === s.mg.game.id ? null : s.mg.game.id))}
                />
              ))}
            </View>
            <LinearGradient colors={['#a8743f', '#6b4423']} style={styles.plank} />
            <View style={[styles.plankShadow, { backgroundColor: c.text }]} />
          </View>
        ))}
      </View>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shelf: { marginBottom: 18 },
  books: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 10, minHeight: 200 },
  spine: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  band: { position: 'absolute', left: 0, right: 0, height: 4 },
  titleBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  spineText: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  doneDot: { position: 'absolute', bottom: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#f5c518' },
  plank: { height: 14, borderRadius: 3 },
  plankShadow: { height: 6, marginHorizontal: 6, opacity: 0.08, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
});
