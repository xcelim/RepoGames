// Pantalla de arranque estilo consola: el logo de Saga Quest se enciende una vez al día.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { todayIso } from '@/hooks/useMyGames';
import { activeEvent } from '@/utils/events';

import { ThemedText } from './ThemedText';

export const BOOT_OFF = 'boot:off';
const BOOT_LAST = 'boot:last';
const WORD = 'SAGA QUEST';

export async function bootEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(BOOT_OFF).catch(() => null)) !== '1';
}

export function BootSplash() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await bootEnabled())) return;
      const today = todayIso();
      if ((await AsyncStorage.getItem(BOOT_LAST).catch(() => null)) === today) return;
      await AsyncStorage.setItem(BOOT_LAST, today).catch(() => undefined);
      if (alive) setShow(true);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!show) return null;
  return <Boot onDone={() => setShow(false)} />;
}

function Boot({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0)); // 0 → 1: encendido
  const [ring] = useState(() => new Animated.Value(0));
  const [out] = useState(() => new Animated.Value(1));
  const [letters] = useState(() => WORD.split('').map(() => new Animated.Value(0)));
  const event = activeEvent(todayIso());
  const accent = event?.event.colors[0] ?? '#7b2ff7';
  const size = Math.min(width, height) * 0.42;

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      Animated.timing(out, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
        onDone,
      );
    };
    Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.stagger(
        55,
        letters.map((l) => Animated.spring(l, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true })),
      ),
    ]).start();
    const buzz = setTimeout(() => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, 700);
    const end = setTimeout(finish, 2600);
    return () => {
      clearTimeout(buzz);
      clearTimeout(end);
    };
  }, [t, ring, out, letters, onDone]);

  const spin = ring.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinBack = ring.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: out }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityLabel="Saltar animación" />
      <View pointerEvents="none" style={styles.center}>
        <Animated.View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: t,
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <Animated.View
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderTopColor: accent,
                transform: [{ rotate: spin }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                width: size * 0.78,
                height: size * 0.78,
                borderRadius: size,
                borderBottomColor: '#2ec5ff',
                transform: [{ rotate: spinBack }],
              },
            ]}
          />
          <LinearGradient
            colors={[accent, '#2ec5ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: size * 0.52,
              height: size * 0.52,
              borderRadius: size,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: size * 0.24, lineHeight: size * 0.3 }}>{event?.event.emoji ?? '🎮'}</Text>
          </LinearGradient>
        </Animated.View>
        <View style={styles.word}>
          {WORD.split('').map((ch, i) => (
            <Animated.View
              key={i}
              style={{
                opacity: letters[i],
                transform: [
                  { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                  { scale: letters[i].interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) },
                ],
              }}
            >
              <ThemedText variant="display" size={30} style={styles.letter}>
                {ch === ' ' ? ' ' : ch}
              </ThemedText>
            </Animated.View>
          ))}
        </View>
        <Animated.View style={{ opacity: letters[letters.length - 1] }}>
          <ThemedText size={12} style={styles.tag}>
            {event ? `${event.event.name.toUpperCase()} · EVENTO ACTIVO` : 'PULSA PARA EMPEZAR'}
          </ThemedText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#05060a', zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  ring: { position: 'absolute', borderWidth: 3, borderColor: '#ffffff14' },
  word: { flexDirection: 'row' },
  letter: { color: '#fff', letterSpacing: 2 },
  tag: { color: '#ffffff99', letterSpacing: 3 },
});
