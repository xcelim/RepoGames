import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, LightButton, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { STATUS_META } from '@/data/meta';
import { useStore } from '@/store/useStore';
import type { GameRecord, PlayStatus } from '@/types';
import { formatHours } from '@/utils/library';
import { notify } from '@/utils/notify';

const PALETTE = [
  '#ff5f6d',
  '#ffc371',
  '#47cf73',
  '#2ec5ff',
  '#7b5cf0',
  '#ff7ac6',
  '#f59e0b',
  '#14b8a6',
  '#e5484d',
  '#6aa834',
  '#3b82f6',
  '#c084fc',
];
const MAX = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ruleta del backlog: gira y te dice a qué jugar.
export default function RouletteScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const mode = useStore((s) => s.durationMode);
  const setStatus = useStore((s) => s.setStatus);
  const [include, setInclude] = useState<PlayStatus[]>(['backlog', 'paused']);
  const [seed, setSeed] = useState(0);
  const [rot] = useState(() => new Animated.Value(0));
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<GameRecord | null>(null);
  const [turns, setTurns] = useState(0);

  const pool = useMemo(() => {
    void seed;
    const all = Object.values(userGames)
      .filter((u) => u.profileId === profileId && include.includes(u.status))
      .map((u) => games[u.gameId])
      .filter((g): g is GameRecord => !!g);
    return shuffle(all).slice(0, MAX);
  }, [userGames, games, profileId, include, seed]);

  const size = Math.min(width - 40, 360);
  const r = size / 2;
  const n = pool.length;
  const slice = n ? 360 / n : 360;

  const spin = () => {
    if (!n || spinning) return;
    setWinner(null);
    const target = Math.floor(Math.random() * n);
    // El puntero está arriba: giramos para que el centro del gajo ganador quede ahí.
    const end = (turns + 6) * 360 - (target * slice + slice / 2);
    setSpinning(true);
    Animated.timing(rot, {
      toValue: end,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setTurns(Math.ceil(end / 360));
      setWinner(pool[target]);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    });
  };

  const rotate = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  const seg = (i: number) => {
    const a0 = ((i * slice - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * slice - 90) * Math.PI) / 180;
    const large = slice > 180 ? 1 : 0;
    return `M${r} ${r} L${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
  };

  return (
    <IgnScreen title="Ruleta del backlog" back contentStyle={{ paddingHorizontal: 20, gap: 18, alignItems: 'stretch' }}>
      <ThemedText variant="muted" size={13}>
        ¿No sabes qué jugar? Gira la ruleta con tus juegos pendientes (si tienes muchos, entran {MAX} al azar).
      </ThemedText>
      <View style={styles.chips}>
        {(['backlog', 'paused', 'wishlist'] as PlayStatus[]).map((st) => {
          const on = include.includes(st);
          return (
            <Pressable
              key={st}
              onPress={() => setInclude((cur) => (on ? cur.filter((x) => x !== st) : [...cur, st]))}
              style={[
                styles.chip,
                {
                  borderRadius: c.radius,
                  borderColor: STATUS_META[st].color,
                  backgroundColor: on ? STATUS_META[st].color : 'transparent',
                },
              ]}
            >
              <ThemedText variant="bold" size={12} style={{ color: on ? '#fff' : c.text }}>
                {STATUS_META[st].label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {n === 0 ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            No hay juegos con esos estados. Marca algunos como «Pendiente» o «En pausa».
          </ThemedText>
        </Card>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.pointer, { borderTopColor: c.text }]} />
          <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
            <Svg width={size} height={size}>
              {pool.map((g, i) => {
                const mid = i * slice + slice / 2;
                const label = g.title.length > 16 ? `${g.title.slice(0, 15)}…` : g.title;
                return (
                  <G key={g.id}>
                    <Path
                      d={n === 1 ? `M0 ${r} A${r} ${r} 0 1 1 0 ${r + 0.01} Z` : seg(i)}
                      fill={PALETTE[i % PALETTE.length]}
                      stroke="#00000033"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={r}
                      y={r - r * 0.62}
                      fill="#fff"
                      fontSize={n > 8 ? 10 : 12}
                      fontWeight="bold"
                      textAnchor="middle"
                      transform={`rotate(${mid} ${r} ${r})`}
                    >
                      {label}
                    </SvgText>
                  </G>
                );
              })}
              <Circle cx={r} cy={r} r={r * 0.16} fill={c.card} stroke={c.text} strokeWidth={3} />
            </Svg>
          </Animated.View>
        </View>
      )}

      {n ? (
        <View style={{ gap: 10 }}>
          <DarkButton label={spinning ? 'Girando…' : '¡Girar!'} icon="sync" disabled={spinning} onPress={spin} />
          <LightButton label="Barajar otros juegos" onPress={() => setSeed((s) => s + 1)} />
        </View>
      ) : null}

      {winner ? (
        <Card style={styles.result}>
          <GameCover game={winner} width={90} />
          <View style={{ flex: 1, gap: 6 }}>
            <ThemedText variant="muted" size={11} style={{ letterSpacing: 0.8 }}>
              ¡TE TOCA!
            </ThemedText>
            <ThemedText variant="display" size={20}>
              {winner.title}
            </ThemedText>
            {winner[mode] ? (
              <ThemedText variant="muted" size={12}>
                Unas {formatHours(winner[mode] ?? 0)} para terminarlo
              </ThemedText>
            ) : null}
            <DarkButton
              label="Empezar a jugar"
              onPress={() => {
                setStatus(winner.id, 'playing');
                notify(`${winner.title}: Jugando`);
                router.push(`/game/${encodeURIComponent(winner.id)}`);
              }}
            />
          </View>
        </Card>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -12,
    zIndex: 2,
  },
  result: { flexDirection: 'row', gap: 16, alignItems: 'center' },
});
