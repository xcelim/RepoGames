import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  claimFinishCards,
  groupAlbum,
  packAvailable,
  RARITY_META,
  refreshCards,
  useCards,
  type AlbumEntry,
  type Rarity,
} from '@/cloud/cards';
import { GameCard } from '@/components/GameCard';
import { Card, DarkButton, HeaderIcon, IgnScreen, LightButton, Sheet, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Chip } from '@/components/ui';
import { useGameLookup } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import { notify } from '@/utils/notify';

// Álbum de cromos: tus cromos agrupados por juego, el sobre del día e intercambios.
export default function AlbumScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const { loaded, missing, mine, lastPack, trades } = useCards();
  const uid = useStore((s) => s.cloudUserId);
  const lookup = useGameLookup();
  const [filter, setFilter] = useState<Rarity | 'all' | 'foil' | 'dupes'>('all');
  const [open, setOpen] = useState<AlbumEntry | null>(null);

  useEffect(() => {
    refreshCards()
      .then(() => claimFinishCards())
      .then(
        (n) =>
          n.length &&
          notify(`¡${n.length} ${n.length === 1 ? 'cromo nuevo' : 'cromos nuevos'} por tus juegos terminados!`),
      )
      .catch(() => undefined);
  }, []);

  const album = useMemo(() => groupAlbum(mine), [mine]);
  const shown = album.filter((e) =>
    filter === 'all'
      ? true
      : filter === 'foil'
        ? e.copies.some((x) => x.foil)
        : filter === 'dupes'
          ? e.copies.length > 1
          : e.best.rarity === filter,
  );
  const incoming = trades.filter((t) => t.status === 'pending' && t.to === uid).length;
  const canOpen = packAvailable(lastPack);
  const cols = Math.max(3, Math.floor((width - 40 + 10) / (130 + 10)));
  const cardW = (width - 40 - 10 * (cols - 1)) / cols;
  const counts = (r: Rarity) => album.filter((e) => e.best.rarity === r).length;

  if (loaded && missing) {
    return (
      <IgnScreen title="Cromos" back contentStyle={{ paddingHorizontal: 20 }}>
        <Card>
          <ThemedText variant="muted" size={14}>
            Para los cromos hay que ejecutar una vez el SQL de cromos en Supabase
            (supabase/migrations/2026-10-26-cromos.sql).
          </ThemedText>
        </Card>
      </IgnScreen>
    );
  }

  return (
    <IgnScreen
      title="Cromos"
      back
      onRefresh={() => refreshCards()}
      right={
        <View>
          <HeaderIcon icon="swap-horizontal" label="Intercambios" onPress={() => router.push('/cards/trades')} />
          {incoming ? (
            <View style={styles.badge}>
              <ThemedText variant="bold" size={10} style={{ color: '#fff' }}>
                {incoming}
              </ThemedText>
            </View>
          ) : null}
        </View>
      }
      contentStyle={{ paddingHorizontal: 20, gap: 16 }}
    >
      <Pressable onPress={() => (canOpen ? router.push('/cards/open') : null)} disabled={!canOpen}>
        <LinearGradient
          colors={canOpen ? ['#ff512f', '#dd2476', '#7b2ff7'] : [c.soft, c.soft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pack}
        >
          <Ionicons name="gift" size={40} color={canOpen ? '#fff' : c.muted} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="display" size={20} style={{ color: canOpen ? '#fff' : c.text }}>
              {canOpen ? '¡Tu sobre del día!' : 'Sobre abierto'}
            </ThemedText>
            <ThemedText size={12} style={{ color: canOpen ? '#ffffffdd' : c.muted }}>
              {canOpen
                ? '3 cromos al azar · toca para abrirlo'
                : 'Mañana tendrás otro. Terminar juegos también te da su cromo.'}
            </ThemedText>
          </View>
          {canOpen ? <Ionicons name="chevron-forward" size={22} color="#fff" /> : null}
        </LinearGradient>
      </Pressable>

      <View style={styles.stats}>
        {(['legendary', 'epic', 'rare', 'common'] as Rarity[]).map((r) => (
          <View key={r} style={[styles.stat, { borderColor: RARITY_META[r].color, borderRadius: c.radius }]}>
            <ThemedText variant="display" size={20} style={{ color: RARITY_META[r].color }}>
              {counts(r)}
            </ThemedText>
            <ThemedText variant="muted" size={10}>
              {RARITY_META[r].label.toUpperCase()}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText variant="muted" size={12}>
        {`${mine.length} cromos · ${album.length} juegos distintos`}
      </ThemedText>

      <View style={styles.chips}>
        <Chip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Brillantes" selected={filter === 'foil'} onPress={() => setFilter('foil')} />
        <Chip label="Repetidos" selected={filter === 'dupes'} onPress={() => setFilter('dupes')} />
        {(['legendary', 'epic', 'rare', 'common'] as Rarity[]).map((r) => (
          <Chip
            key={r}
            label={RARITY_META[r].label}
            color={RARITY_META[r].color}
            selected={filter === r}
            onPress={() => setFilter(r)}
          />
        ))}
      </View>

      {!loaded ? <ActivityIndicator color={c.text} /> : null}
      {loaded && !album.length ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            Aún no tienes cromos. Abre tu sobre del día o termina un juego.
          </ThemedText>
        </Card>
      ) : null}
      <View style={styles.grid}>
        {shown.map((e) => (
          <Pressable key={e.gameId} onPress={() => setOpen(e)}>
            <GameCard
              game={lookup(e.gameId)}
              rarity={e.best.rarity}
              foil={e.best.foil}
              width={cardW}
              count={e.copies.length}
            />
          </Pressable>
        ))}
      </View>

      <Sheet visible={!!open} title={open ? (lookup(open.gameId)?.title ?? 'Cromo') : ''} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ alignItems: 'center', gap: 14 }}>
            <GameCard game={lookup(open.gameId)} rarity={open.best.rarity} foil={open.best.foil} width={200} />
            <ThemedText variant="muted" size={13} style={{ textAlign: 'center' }}>
              {`Tienes ${open.copies.length} ${open.copies.length === 1 ? 'copia' : 'copias'}${
                open.copies.some((x) => x.foil) ? ' (alguna brillante)' : ''
              }.`}
            </ThemedText>
            <DarkButton
              label="Intercambiar con un amigo"
              icon="swap-horizontal"
              onPress={() => {
                const pick = [...open.copies].sort((a, b) => Number(a.foil) - Number(b.foil))[0];
                setOpen(null);
                router.push(`/cards/trade?offer=${pick.id}`);
              }}
              style={{ alignSelf: 'stretch' }}
            />
            <LightButton
              label="Ver el juego"
              onPress={() => {
                setOpen(null);
                router.push(`/game/${encodeURIComponent(open.gameId)}`);
              }}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}
      </Sheet>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  pack: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e5484d',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
