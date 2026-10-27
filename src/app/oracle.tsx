import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, LightButton, useIgnColors, useScreenWidth } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { STATUS_META } from '@/data/meta';
import { daysBetween, todayIso, useMyGames, type MyGame } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import type { DurationMode } from '@/types';
import { formatHours, gameHours } from '@/utils/library';
import { notify } from '@/utils/notify';

type Time = 'short' | 'medium' | 'long' | 'any';
type Mood = 'best' | 'finish' | 'forgotten' | 'surprise';

const TIMES: { id: Time; label: string; caption: string; icon: string }[] = [
  { id: 'short', label: 'Un rato', caption: 'Hasta 10 h', icon: 'cafe' },
  { id: 'medium', label: 'Unas semanas', caption: '10 a 30 h', icon: 'calendar' },
  { id: 'long', label: 'Algo largo', caption: 'Más de 30 h', icon: 'planet' },
  { id: 'any', label: 'Me da igual', caption: 'Lo que sea', icon: 'infinite' },
];

const MOODS: { id: Mood; label: string; icon: string }[] = [
  { id: 'best', label: 'Algo muy bueno', icon: 'star' },
  { id: 'finish', label: 'Acabar lo empezado', icon: 'flag' },
  { id: 'forgotten', label: 'Una joya olvidada', icon: 'diamond' },
  { id: 'surprise', label: 'Sorpréndeme', icon: 'shuffle' },
];

type Pick = { mg: MyGame; reason: string };

function fits(hours: number, time: Time): number {
  if (time === 'any' || !hours) return 0.5;
  if (time === 'short') return hours <= 10 ? 1 : hours <= 15 ? 0.4 : 0;
  if (time === 'medium') return hours > 8 && hours <= 30 ? 1 : hours <= 40 ? 0.4 : 0.1;
  return hours > 30 ? 1 : hours > 22 ? 0.4 : 0;
}

function oracle(mine: MyGame[], time: Time, mood: Mood, mode: DurationMode, seed: number): Pick[] {
  const today = todayIso();
  let rnd = seed * 9301 + 49297;
  const rand = () => {
    rnd = (rnd * 9301 + 49297) % 233280;
    return rnd / 233280;
  };
  const pool = mine.filter((m) => ['backlog', 'paused', 'playing', 'library', 'wishlist'].includes(m.ug.status));
  const scored = pool.map((m) => {
    const h = gameHours(m.game, mode);
    const age = daysBetween(m.ug.addedAt, today);
    const critic = m.game.criticRating ?? 70;
    let score = fits(h, time) * 3;
    let reason = h ? `Te dura unas ${formatHours(h)}` : 'Sin duración conocida';
    if (m.ug.status === 'wishlist') score -= 1.2; // aún no lo tienes
    if (mood === 'best') {
      score += (critic - 70) / 8;
      if (m.game.criticRating) reason = `Nota de la crítica: ${Math.round(critic)}. ${reason}`;
    } else if (mood === 'finish') {
      score += m.ug.status === 'playing' ? 3 : m.ug.status === 'paused' ? 2.4 : -2;
      if (m.ug.status === 'playing' || m.ug.status === 'paused')
        reason = `Lo tienes ${STATUS_META[m.ug.status].short.toLowerCase()}${m.ug.startedAt ? ` desde hace ${daysBetween(m.ug.startedAt, today)} días` : ''}. ${reason}`;
    } else if (mood === 'forgotten') {
      score += Math.min(4, age / 120);
      reason = `Lleva ${age} días esperándote. ${reason}`;
    } else {
      score += rand() * 4;
    }
    return { mg: m, reason, score: score + rand() * 0.6 };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ mg, reason }) => ({ mg, reason }));
}

function Orb({ active }: { active: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: active ? 380 : 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: active ? 380 : 1600, useNativeDriver: true }),
      ]),
    );
    const b = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: active ? 900 : 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [active, pulse, spin]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.12 : 1.04] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={styles.orbWrap}>
      <Animated.View style={[styles.orbGlow, { transform: [{ scale }], opacity: active ? 0.8 : 0.45 }]} />
      <Animated.View style={[styles.orb, { transform: [{ scale }, { rotate }] }]}>
        <LinearGradient
          colors={['#f107a3', '#7b2ff7', '#2ec5ff', '#f107a3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.orbShine} />
      </Animated.View>
      <Ionicons name="sparkles" size={34} color="#fff" style={{ position: 'absolute' }} />
    </View>
  );
}

function RevealCard({ pick, index, width }: { pick: Pick; index: number; width: number }) {
  const c = useIgnColors();
  const setStatus = useStore((s) => s.setStatus);
  const [flip] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(flip, {
      toValue: 1,
      duration: 650,
      delay: 180 * index,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [flip, index]);
  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });
  const { game, ug } = pick.mg;
  return (
    <Animated.View style={{ opacity: flip, transform: [{ perspective: 900 }, { rotateY }] }}>
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Pressable onPress={() => router.push(`/game/${encodeURIComponent(game.id)}`)}>
          <GameCover game={game} width={Math.min(96, width * 0.24)} />
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          <ThemedText variant="muted" size={11} style={{ letterSpacing: 1 }}>
            {index === 0 ? 'EL ORÁCULO HA HABLADO' : `OPCIÓN ${index + 1}`}
          </ThemedText>
          <ThemedText variant="bold" size={16} numberOfLines={2}>
            {game.title}
          </ThemedText>
          <ThemedText variant="muted" size={12} numberOfLines={3}>
            {pick.reason}
          </ThemedText>
          {ug.status !== 'playing' ? (
            <Pressable
              onPress={() => {
                setStatus(game.id, 'playing');
                notify(`¡A por ${game.title}!`);
                router.push(`/game/${encodeURIComponent(game.id)}`);
              }}
              style={[styles.playBtn, { backgroundColor: c.inverseBg, borderRadius: c.radius }]}
            >
              <Ionicons name="play" size={14} color={c.inverseText} />
              <ThemedText variant="bold" size={12} style={{ color: c.inverseText }}>
                Empezar a jugar
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

// El oráculo: eliges tiempo y ganas, y te recomienda tres juegos de tu biblioteca.
export default function OracleScreen() {
  const c = useIgnColors();
  const width = useScreenWidth(780);
  const mine = useMyGames();
  const mode = useStore((s) => s.durationMode);
  const [time, setTime] = useState<Time>('any');
  const [mood, setMood] = useState<Mood>('best');
  const [thinking, setThinking] = useState(false);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [round, setRound] = useState(0);

  const ask = () => {
    setThinking(true);
    setPicks(null);
    const next = round + 1;
    setRound(next);
    setTimeout(() => {
      setPicks(oracle(mine, time, mood, mode, Date.now() % 9973));
      setThinking(false);
    }, 1300);
  };

  const chip = (on: boolean) => [
    styles.chip,
    { borderRadius: c.radius, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.card },
  ];

  return (
    <IgnScreen narrow={780} title="El oráculo" back contentStyle={{ paddingHorizontal: 20, gap: 18 }}>
      <Orb active={thinking} />
      <ThemedText variant="bold" size={13} style={styles.caps}>
        ¿Cuánto tiempo tienes?
      </ThemedText>
      <View style={styles.wrap}>
        {TIMES.map((t) => (
          <Pressable key={t.id} onPress={() => setTime(t.id)} style={chip(time === t.id)}>
            <Ionicons name={t.icon as never} size={16} color={time === t.id ? '#fff' : c.text} />
            <View>
              <ThemedText variant="bold" size={13} style={time === t.id ? styles.white : null}>
                {t.label}
              </ThemedText>
              <ThemedText size={11} style={{ color: time === t.id ? '#ffffffcc' : c.muted }}>
                {t.caption}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
      <ThemedText variant="bold" size={13} style={styles.caps}>
        ¿Qué te apetece?
      </ThemedText>
      <View style={styles.wrap}>
        {MOODS.map((m) => (
          <Pressable key={m.id} onPress={() => setMood(m.id)} style={chip(mood === m.id)}>
            <Ionicons name={m.icon as never} size={16} color={mood === m.id ? '#fff' : c.text} />
            <ThemedText variant="bold" size={13} style={mood === m.id ? styles.white : null}>
              {m.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      {mine.length < 2 ? (
        <Card>
          <ThemedText variant="muted" size={14}>
            El oráculo necesita juegos pendientes en tu biblioteca para elegir.
          </ThemedText>
        </Card>
      ) : picks ? (
        <View style={{ gap: 12 }}>
          {picks.map((p, i) => (
            <RevealCard key={`${round}-${p.mg.game.id}`} pick={p} index={i} width={width} />
          ))}
          {!picks.length ? (
            <Card>
              <ThemedText variant="muted" size={14}>
                No hay nada pendiente que encaje. Prueba con «Me da igual».
              </ThemedText>
            </Card>
          ) : null}
          <LightButton label="Preguntar otra vez" onPress={ask} />
        </View>
      ) : (
        <DarkButton
          label={thinking ? 'El oráculo está pensando…' : 'Consultar al oráculo'}
          icon="sparkles"
          onPress={ask}
          disabled={thinking}
        />
      )}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  caps: { letterSpacing: 0.8, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  white: { color: '#fff' },
  orbWrap: { alignItems: 'center', justifyContent: 'center', height: 170 },
  orbGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: '#b14cff' },
  orb: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden' },
  orbShine: {
    position: 'absolute',
    top: 16,
    left: 22,
    width: 40,
    height: 26,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
    transform: [{ rotate: '-30deg' }],
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
});
