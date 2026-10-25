import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GameCover } from '@/components/games';
import { Card, IgnScreen, LightButton, RankCircle, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { useMyGames, type MyGame } from '@/hooks/useMyGames';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { ELO_START, eloUpdate } from '@/utils/elo';

const PLAYED = new Set(['playing', 'paused', 'beaten', 'completed', 'dropped', 'library', 'watched']);

function pickPair(pool: MyGame[], elo: Record<string, number>, avoid: string[]): [MyGame, MyGame] | null {
  if (pool.length < 2) return null;
  const rating = (m: MyGame) => elo[m.game.id] ?? ELO_START;
  // Primero los que menos duelos llevan (los que no tienen puntuación), luego por cercanía.
  const fresh = pool.filter((m) => elo[m.game.id] === undefined && !avoid.includes(m.game.id));
  const first =
    fresh.length && Math.random() < 0.7
      ? fresh[Math.floor(Math.random() * fresh.length)]
      : pool[Math.floor(Math.random() * pool.length)];
  const rivals = pool
    .filter((m) => m.game.id !== first.game.id && !avoid.includes(m.game.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .sort((a, b) => Math.abs(rating(a) - rating(first)) - Math.abs(rating(b) - rating(first)));
  const second = rivals[0] ?? pool.find((m) => m.game.id !== first.game.id);
  return second ? [first, second] : null;
}

function Fighter({
  mg,
  width,
  onPick,
  anim,
  side,
}: {
  mg: MyGame;
  width: number;
  onPick: () => void;
  anim: Animated.Value;
  side: 0 | 1;
}) {
  // anim: 0 = esperando, 1 = ganó este, -1 = ganó el otro
  const scale = anim.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.86, 1, 1.08] });
  const opacity = anim.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.25, 1, 1] });
  const rotate = anim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [side ? '6deg' : '-6deg', '0deg', '0deg'],
  });
  return (
    <Pressable onPress={onPick} style={{ width, alignItems: 'center', gap: 8 }}>
      <Animated.View style={{ transform: [{ scale }, { rotate }], opacity }}>
        <GameCover game={mg.game} width={width} />
      </Animated.View>
      <ThemedText variant="bold" size={14} numberOfLines={2} style={{ textAlign: 'center' }}>
        {mg.game.title}
      </ThemedText>
    </Pressable>
  );
}

// Duelos: eliges entre dos juegos que has jugado y sale tu ranking personal (sistema Elo).
export default function VersusScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const mine = useMyGames();
  const pool = useMemo(() => mine.filter((m) => PLAYED.has(m.ug.status)), [mine]);
  const elo = useMemo(() => profile?.elo ?? {}, [profile?.elo]);
  const [tab, setTab] = useState<'duel' | 'rank'>('duel');
  const [pair, setPair] = useState<[MyGame, MyGame] | null>(null);
  const [left] = useState(() => new Animated.Value(0));
  const [right] = useState(() => new Animated.Value(0));
  const [vs] = useState(() => new Animated.Value(0));
  const [streak, setStreak] = useState(0);
  const busy = useRef(false);

  // Hasta el primer duelo, los dos primeros juegos; luego, parejas elegidas por puntuación.
  const fallback = useMemo<[MyGame, MyGame] | null>(() => (pool.length >= 2 ? [pool[0], pool[1]] : null), [pool]);
  const current = pair ?? fallback;

  useEffect(() => {
    vs.setValue(0);
    Animated.spring(vs, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [current, vs]);

  const choose = (winnerSide: 0 | 1) => {
    if (!current || busy.current || !profile) return;
    busy.current = true;
    const [a, b] = winnerSide === 0 ? current : [current[1], current[0]];
    const [wa, lb] = eloUpdate(elo[a.game.id] ?? ELO_START, elo[b.game.id] ?? ELO_START);
    updateProfile({ elo: { ...elo, [a.game.id]: wa, [b.game.id]: lb }, duels: (profile.duels ?? 0) + 1 });
    setStreak((s) => s + 1);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Animated.parallel([
      Animated.timing(winnerSide === 0 ? left : right, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(winnerSide === 0 ? right : left, { toValue: -1, duration: 260, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        left.setValue(0);
        right.setValue(0);
        setPair(pickPair(pool, { ...elo, [a.game.id]: wa, [b.game.id]: lb }, [a.game.id, b.game.id]));
        busy.current = false;
      }, 280);
    });
  };

  const ranking = useMemo(
    () =>
      pool.filter((m) => elo[m.game.id] !== undefined).sort((x, y) => (elo[y.game.id] ?? 0) - (elo[x.game.id] ?? 0)),
    [pool, elo],
  );

  const coverW = Math.min(260, (width - 40 - 50) / 2);
  const vsScale = vs.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <IgnScreen title="Duelos" back contentStyle={{ paddingHorizontal: 20, gap: 18 }}>
      <View style={[styles.tabs, { backgroundColor: c.soft, borderRadius: c.radius }]}>
        {(['duel', 'rank'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, { borderRadius: c.radius, backgroundColor: tab === t ? c.inverseBg : 'transparent' }]}
          >
            <ThemedText variant="bold" size={13} style={{ color: tab === t ? c.inverseText : c.text }}>
              {t === 'duel' ? '¿Cuál prefieres?' : `Tu ranking (${ranking.length})`}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {pool.length < 2 ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            Necesitas al menos dos juegos jugados (terminados, jugando, en pausa…) para los duelos.
          </ThemedText>
        </Card>
      ) : tab === 'duel' && current ? (
        <>
          <ThemedText variant="muted" size={13} style={{ textAlign: 'center' }}>
            Toca el que más te guste. Cuantos más duelos, más fino sale tu ranking.
          </ThemedText>
          <View style={styles.arena}>
            <Fighter
              key={`l-${current[0].game.id}`}
              mg={current[0]}
              width={coverW}
              onPick={() => choose(0)}
              anim={left}
              side={0}
            />
            <Animated.View style={[styles.vs, { transform: [{ scale: vsScale }, { rotate: '-8deg' }] }]}>
              <LinearGradient colors={['#ff512f', '#dd2476']} style={styles.vsBubble}>
                <ThemedText variant="display" size={18} style={{ color: '#fff' }}>
                  VS
                </ThemedText>
              </LinearGradient>
            </Animated.View>
            <Fighter
              key={`r-${current[1].game.id}`}
              mg={current[1]}
              width={coverW}
              onPick={() => choose(1)}
              anim={right}
              side={1}
            />
          </View>
          <View style={styles.footer}>
            <ThemedText variant="muted" size={12}>
              {`${profile?.duels ?? 0} duelos en total${streak ? ` · ${streak} en esta sesión` : ''}`}
            </ThemedText>
            <LightButton
              label="Saltar"
              onPress={() =>
                setPair(
                  pickPair(
                    pool,
                    elo,
                    current.map((p) => p.game.id),
                  ),
                )
              }
            />
          </View>
        </>
      ) : tab === 'rank' ? (
        ranking.length ? (
          <Card padded={false}>
            {ranking.map((m, i) => (
              <Pressable
                key={m.game.id}
                onPress={() => router.push(`/game/${encodeURIComponent(m.game.id)}`)}
                style={[
                  styles.rankRow,
                  {
                    borderBottomColor: c.line,
                    borderBottomWidth: i < ranking.length - 1 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                {i < 3 ? (
                  <Ionicons
                    name="trophy"
                    size={24}
                    color={['#f5c518', '#c0c7d1', '#cd7f32'][i]}
                    style={{ width: 28 }}
                  />
                ) : (
                  <View style={{ width: 28 }}>
                    <RankCircle rank={i + 1} size={24} />
                  </View>
                )}
                <GameCover game={m.game} width={36} plain />
                <ThemedText variant="bold" size={14} style={{ flex: 1 }} numberOfLines={1}>
                  {m.game.title}
                </ThemedText>
                <ThemedText variant="muted" size={12}>
                  {elo[m.game.id]}
                </ThemedText>
              </Pressable>
            ))}
          </Card>
        ) : (
          <Card>
            <ThemedText variant="muted" size={14}>
              Juega unos cuantos duelos y aquí aparecerá tu ranking.
            </ThemedText>
          </Card>
        )
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  arena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vs: { width: 50, alignItems: 'center', zIndex: 2 },
  vsBubble: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
});
