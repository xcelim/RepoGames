import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { friendIds, useSocial } from '@/cloud/social';
import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { UserAvatar } from '@/components/UserAvatar';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';
import { formatHours, gameHours } from '@/utils/library';

type Mode = 'rating' | 'hours';
const MODES: { id: Mode; label: string; icon: string; question: string }[] = [
  {
    id: 'rating',
    label: 'Nota de la crítica',
    icon: 'star',
    question: '¿Tiene más o menos nota?',
  },
  {
    id: 'hours',
    label: 'Duración',
    icon: 'time',
    question: '¿Dura más o menos?',
  },
];

// ¿Más o menos?: adivina si el siguiente juego tiene más nota (o dura más) que el anterior.
export default function HigherLowerScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const games = useStore((s) => s.games);
  const durationMode = useStore((s) => s.durationMode);
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const { profiles, friendships } = useSocial(
    useShallow((s) => ({ profiles: s.profiles, friendships: s.friendships })),
  );
  const [mode, setMode] = useState<Mode>('rating');
  const value = (g: GameRecord) => (mode === 'rating' ? (g.criticRating ?? 0) : gameHours(g, durationMode));
  const pool = useMemo(
    () =>
      Object.values(games).filter(
        (g) => g.coverUrl && (mode === 'rating' ? (g.criticRating ?? 0) > 0 : gameHours(g, durationMode) > 0),
      ),
    [games, mode, durationMode],
  );
  const [pair, setPair] = useState<[GameRecord, GameRecord] | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'play' | 'reveal' | 'over'>('play');
  const [shown, setShown] = useState<number | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const best = profile?.hilo?.[mode] ?? 0;

  const draw = (exclude: string[] = []): GameRecord | null => {
    const options = pool.filter((g) => !exclude.includes(g.id));
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  };
  const start = () => {
    const a = draw();
    // Que no sean iguales (si no, no hay respuesta).
    const b = a
      ? (pool.filter((g) => g.id !== a.id && value(g) !== value(a)).sort(() => Math.random() - 0.5)[0] ?? null)
      : null;
    setPair(a && b ? [a, b] : null);
    setScore(0);
    setShown(null);
    setPhase('play');
  };
  useEffect(() => {
    // Nueva partida al cambiar de modo o cuando llegan juegos (fuera del render del efecto).
    const t = setTimeout(start, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pool.length]);

  const guess = (higher: boolean) => {
    if (!pair || phase !== 'play') return;
    const [a, b] = pair;
    const ok = higher ? value(b) > value(a) : value(b) < value(a);
    setPhase('reveal');
    // El número sube contando hasta su valor.
    const target = value(b);
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v * target * 10) / 10));
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      anim.removeListener(id);
      setShown(target);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(
          ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
        ).catch(() => undefined);
      setTimeout(
        () => {
          if (!ok) {
            setPhase('over');
            if (score > best && profile)
              updateProfile({
                hilo: { ...(profile.hilo ?? {}), [mode]: score },
              });
            return;
          }
          const next = pool.filter((g) => g.id !== b.id && g.id !== a.id && value(g) !== value(b));
          const n = next[Math.floor(Math.random() * next.length)];
          setScore((s) => s + 1);
          setShown(null);
          if (!n) {
            setPhase('over');
            return;
          }
          setPair([b, n]);
          setPhase('play');
        },
        ok ? 700 : 900,
      );
    });
  };

  const fmt = (g: GameRecord, v: number | null) =>
    v == null ? '?' : mode === 'rating' ? String(Math.round(v)) : formatHours(Math.round(v * 10) / 10);
  const coverW = Math.min(150, (width - 40 - 40) / 2);
  const friends = useMemo(() => {
    void friendships;
    return friendIds()
      .map((id) => profiles[id])
      .filter((p) => p?.hilo?.[mode])
      .sort((x, y) => (y.hilo?.[mode] ?? 0) - (x.hilo?.[mode] ?? 0))
      .slice(0, 5);
  }, [friendships, profiles, mode]);

  return (
    <IgnScreen title="¿Más o menos?" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <View style={[styles.tabs, { backgroundColor: c.soft, borderRadius: c.radius }]}>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMode(m.id)}
            style={[
              styles.tab,
              {
                borderRadius: c.radius,
                backgroundColor: mode === m.id ? c.inverseBg : 'transparent',
              },
            ]}
          >
            <Ionicons name={m.icon as never} size={15} color={mode === m.id ? c.inverseText : c.text} />
            <ThemedText variant="bold" size={13} style={{ color: mode === m.id ? c.inverseText : c.text }}>
              {m.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <View style={styles.scores}>
        <ThemedText variant="display" size={28}>{`Racha ${score}`}</ThemedText>
        <ThemedText variant="muted" size={13}>{`Récord: ${Math.max(best, phase === 'over' ? score : 0)}`}</ThemedText>
      </View>

      {pool.length < 2 || !pair ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            Hace falta tener más juegos descargados con {mode === 'rating' ? 'nota de la crítica' : 'duración'}. Date
            una vuelta por Descubrir y vuelve.
          </ThemedText>
        </Card>
      ) : (
        <>
          <View style={styles.duel}>
            {pair.map((g, i) => (
              <View key={`${g.id}-${i}`} style={{ width: coverW, alignItems: 'center', gap: 8 }}>
                <GameCover game={g} width={coverW} plain />
                <ThemedText variant="bold" size={13} numberOfLines={2} style={{ textAlign: 'center' }}>
                  {g.title}
                </ThemedText>
                <View style={[styles.value, { backgroundColor: c.soft, borderRadius: c.radius }]}>
                  <ThemedText variant="display" size={22}>
                    {i === 0 ? fmt(g, value(g)) : fmt(g, phase === 'play' ? null : shown)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
          {phase === 'over' ? (
            <Card style={{ alignItems: 'center', gap: 10 }}>
              <ThemedText variant="display" size={22}>
                {score > best ? '¡Nuevo récord!' : 'Fin de la partida'}
              </ThemedText>
              <ThemedText variant="muted" size={13}>{`${pair[1].title}: ${fmt(pair[1], value(pair[1]))}`}</ThemedText>
              <DarkButton label="Otra vez" icon="refresh" onPress={start} style={{ alignSelf: 'stretch' }} />
            </Card>
          ) : (
            <>
              <ThemedText variant="bold" size={15} style={{ textAlign: 'center' }}>
                {MODES.find((m) => m.id === mode)!.question}
              </ThemedText>
              <View style={styles.buttons}>
                <Pressable
                  onPress={() => guess(true)}
                  style={[styles.big, { backgroundColor: '#2fd18b', borderRadius: c.radius }]}
                >
                  <Ionicons name="arrow-up" size={22} color="#fff" />
                  <ThemedText variant="bold" size={16} style={{ color: '#fff' }}>
                    Más
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => guess(false)}
                  style={[styles.big, { backgroundColor: '#e5484d', borderRadius: c.radius }]}
                >
                  <Ionicons name="arrow-down" size={22} color="#fff" />
                  <ThemedText variant="bold" size={16} style={{ color: '#fff' }}>
                    Menos
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </>
      )}

      {friends.length ? (
        <Card style={{ gap: 10 }}>
          <ThemedText variant="bold" size={13}>
            Récords de tus amigos
          </ThemedText>
          {friends.map((p, i) => (
            <View key={p.id} style={styles.friend}>
              <ThemedText variant="bold" size={14} style={{ width: 22 }}>
                {i + 1}
              </ThemedText>
              <UserAvatar profile={p} size={30} frame={false} />
              <ThemedText size={14} style={{ flex: 1 }} numberOfLines={1}>
                {p.displayName}
              </ThemedText>
              <ThemedText variant="bold" size={14}>
                {p.hilo?.[mode]}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  scores: { alignItems: 'center', gap: 2 },
  duel: { flexDirection: 'row', justifyContent: 'space-around' },
  value: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  buttons: { flexDirection: 'row', gap: 12 },
  big: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
