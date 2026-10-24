import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/games';
import { Card, IgnScreen, useIgnColors, useProgressive } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { finishedDay, shortDate, useMyGames, type MyGame } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import { formatHours, gameHours } from '@/utils/library';

type Year = { year: number; games: MyGame[]; hours: number; best: MyGame | null };

// Tu vida gamer: una línea del tiempo con lo que terminaste cada año.
export default function TimelineScreen() {
  const c = useIgnColors();
  const mine = useMyGames();
  const mode = useStore((s) => s.durationMode);

  const { years, first } = useMemo(() => {
    const byYear = new Map<number, MyGame[]>();
    for (const m of mine) {
      const d = finishedDay(m.ug);
      if (!d) continue;
      const y = Number(d.slice(0, 4));
      byYear.set(y, [...(byYear.get(y) ?? []), m]);
    }
    const out: Year[] = [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, games]) => {
        const sorted = [...games].sort((a, b) => (finishedDay(b.ug) ?? '').localeCompare(finishedDay(a.ug) ?? ''));
        const best = [...games].sort((a, b) => (b.ug.rating ?? 0) - (a.ug.rating ?? 0))[0] ?? null;
        return {
          year,
          games: sorted,
          hours: games.reduce((a, m) => a + (m.ug.hoursPlayed ?? gameHours(m.game, mode)), 0),
          best: best?.ug.rating ? best : null,
        };
      });
    const firstAdded = [...mine].sort((a, b) => a.ug.addedAt.localeCompare(b.ug.addedAt))[0] ?? null;
    return { years: out, first: firstAdded };
  }, [mine, mode]);
  const shown = useProgressive(years.length, 4, 3);

  return (
    <IgnScreen title="Tu vida gamer" back contentStyle={{ paddingHorizontal: 20 }}>
      {!years.length ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            Cuando termines juegos (o marques la fecha en que los terminaste) aparecerán aquí, año a año.
          </ThemedText>
        </Card>
      ) : null}
      {years.slice(0, shown).map((y, i) => (
        <View key={y.year} style={styles.year}>
          <View style={styles.rail}>
            <LinearGradient colors={['#7b2ff7', '#f107a3']} style={styles.node}>
              <ThemedText variant="bold" size={11} style={{ color: '#fff' }}>
                {String(y.year).slice(2)}
              </ThemedText>
            </LinearGradient>
            {i < years.length - 1 || first ? <View style={[styles.line, { backgroundColor: c.line }]} /> : null}
          </View>
          <View style={styles.body}>
            <ThemedText variant="display" size={26}>
              {y.year}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {`${y.games.length} ${y.games.length === 1 ? 'terminado' : 'terminados'} · ${formatHours(y.hours)}${y.best ? ` · tu favorito: ${y.best.game.title}` : ''}`}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.covers}>
              {y.games.map((m) => (
                <Pressable key={m.game.id} onPress={() => router.push(`/game/${encodeURIComponent(m.game.id)}`)}>
                  <GameCover game={m.game} width={78} plain />
                  <ThemedText variant="muted" size={10} style={{ width: 78, marginTop: 4 }} numberOfLines={1}>
                    {shortDate(finishedDay(m.ug)!)}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ))}
      {first && shown >= years.length ? (
        <View style={styles.year}>
          <View style={styles.rail}>
            <View style={[styles.node, { backgroundColor: c.soft }]}>
              <ThemedText size={14}>🌱</ThemedText>
            </View>
          </View>
          <View style={[styles.body, { paddingBottom: 10 }]}>
            <ThemedText variant="bold" size={15}>
              Aquí empezó todo
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {`${shortDate(first.ug.addedAt)}: añadiste ${first.game.title}, tu primer juego en Saga Quest.`}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  year: { flexDirection: 'row', gap: 14 },
  rail: { width: 34, alignItems: 'center' },
  node: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginVertical: 4 },
  body: { flex: 1, gap: 4, paddingBottom: 26 },
  covers: { gap: 10, paddingTop: 8 },
});
