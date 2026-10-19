import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Achievement } from '@/api/achievements';
import { AchievementIcon } from '@/components/AchievementIcon';
import { PlatinumBadge } from '@/components/achievements';
import { formatDay } from '@/components/details';
import { GameCover } from '@/components/games';
import { IgnScreen, Sheet, useIgnColors } from '@/components/ign';
import { Shine } from '@/components/Shine';
import { ThemedText } from '@/components/ThemedText';
import { usePlatinums } from '@/hooks/usePlatinums';

// Los logros de un juego platinado: solo los logros, en cuadrícula o en lista.
export default function PlatinumGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = decodeURIComponent(id ?? '');
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const { list, loading } = usePlatinums();
  const p = list.find((x) => x.game.id === gameId);
  const [grid, setGrid] = useState(true);
  const [picked, setPicked] = useState<Achievement | null>(null);
  const cols = 4;
  const tile = (width - 40 - (cols - 1) * 14) / cols;

  return (
    <IgnScreen
      title={p?.game.title ?? 'Platino'}
      back
      right={
        <View style={[styles.switch, { backgroundColor: c.soft, borderRadius: c.radius }]}>
          {(['list', 'grid'] as const).map((mode) => {
            const active = (mode === 'grid') === grid;
            return (
              <Pressable
                key={mode}
                onPress={() => setGrid(mode === 'grid')}
                accessibilityLabel={mode === 'grid' ? 'Ver en cuadrícula' : 'Ver en lista'}
                style={[
                  styles.switchBtn,
                  { borderRadius: c.radius - 2, backgroundColor: active ? c.inverseBg : 'transparent' },
                ]}
              >
                <Ionicons name={mode === 'grid' ? 'grid' : 'list'} size={18} color={active ? c.inverseText : c.text} />
              </Pressable>
            );
          })}
        </View>
      }
    >
      {!p ? (
        <ThemedText variant="muted" style={{ paddingHorizontal: 20 }}>
          {loading ? 'Cargando…' : 'Este juego aún no está platinado.'}
        </ThemedText>
      ) : (
        <>
          <Pressable onPress={() => router.push(`/game/${encodeURIComponent(p.game.id)}`)} style={styles.head}>
            <Shine width={70} height={70 * (4 / 3)} radius={6} border={2} badge={22}>
              <GameCover game={p.game} width={70} radius={0} plain />
            </Shine>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.titleRow}>
                <PlatinumBadge size={22} />
                <ThemedText variant="bold" size={13} style={{ letterSpacing: 0.6 }}>
                  PLATINO SAGA QUEST
                </ThemedText>
              </View>
              <ThemedText variant="muted" size={12}>
                {p.total} de {p.total} logros{p.ug.finishedAt ? ` · terminado el ${formatDay(p.ug.finishedAt)}` : ''}
              </ThemedText>
              <ThemedText variant="muted" size={11} style={{ textDecorationLine: 'underline' }}>
                Ver la ficha del juego
              </ThemedText>
            </View>
          </Pressable>

          {grid ? (
            <View style={styles.grid}>
              {p.list.map((a) => (
                <Pressable key={a.id} onPress={() => setPicked(a)} style={{ width: tile, alignItems: 'center' }}>
                  <AchievementIcon a={a} size={tile} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              {p.list.map((a) => (
                <View key={a.id} style={[styles.row, { borderBottomColor: c.line }]}>
                  <AchievementIcon a={a} size={52} />
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="bold" size={14}>
                      {a.name}
                    </ThemedText>
                    {a.description ? (
                      <ThemedText variant="muted" size={12}>
                        {a.description}
                      </ThemedText>
                    ) : null}
                    {a.percent != null ? (
                      <ThemedText variant="muted" size={10}>
                        {a.percent < 10 ? a.percent.toFixed(1).replace('.', ',') : Math.round(a.percent)} % de jugadores
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
      {picked ? (
        <Sheet visible title={picked.name} onClose={() => setPicked(null)}>
          <View style={{ alignItems: 'center', gap: 12, paddingBottom: 10 }}>
            <AchievementIcon a={picked} size={96} />
            <ThemedText size={14} style={{ textAlign: 'center' }}>
              {picked.description || 'Sin descripción'}
            </ThemedText>
            {picked.percent != null ? (
              <ThemedText variant="muted" size={12}>
                Lo tiene el{' '}
                {picked.percent < 10 ? picked.percent.toFixed(1).replace('.', ',') : Math.round(picked.percent)} % de
                los jugadores
              </ThemedText>
            ) : null}
          </View>
        </Sheet>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', padding: 3, gap: 2 },
  switchBtn: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginBottom: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
