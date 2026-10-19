// Celebraciones: confeti temático al terminar un juego y ceremonia al conseguir un platino.
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { create } from 'zustand';

import { DECOR, decorColor } from '@/theme/decor';
import { useSkin } from '@/theme/useSkin';

import { PlatinumBadge } from './achievements';
import { shape } from './Backdrop';
import { ThemedText } from './ThemedText';

type Event = { kind: 'finish' | 'platinum'; title: string; onDone?: () => void };
export const useCelebration = create<{ event: Event | null; show: (e: Event) => void; close: () => void }>(
  (set, get) => ({
    event: null,
    show: (event) => set({ event }),
    close: () => {
      const done = get().event?.onDone;
      set({ event: null });
      done?.();
    },
  }),
);
export const celebrate = (e: Event) => useCelebration.getState().show(e);

function Particle({
  i,
  w,
  h,
  color,
  motif,
}: {
  i: number;
  w: number;
  h: number;
  color: string;
  motif: Parameters<typeof shape>[0];
}) {
  const [t] = useState(() => new Animated.Value(0));
  // Pseudoaleatorio a partir del número de partícula (el render debe ser puro).
  const cfg = useMemo(() => {
    const rnd = (k: number) => {
      const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      x: rnd(1) * w,
      drift: (rnd(2) - 0.5) * 140,
      size: 12 + rnd(3) * 16,
      spin: (rnd(4) - 0.5) * 720,
      delay: rnd(5) * 500,
      dur: 1800 + rnd(6) * 1400,
    };
  }, [i, w]);
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: cfg.dur,
      delay: cfg.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [t, cfg]);
  const ty = t.interpolate({ inputRange: [0, 1], outputRange: [-40, h + 40] });
  const tx = t.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.drift] });
  const rot = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${cfg.spin}deg`] });
  const op = t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View
      key={i}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cfg.x,
        top: 0,
        opacity: op,
        transform: [{ translateY: ty }, { translateX: tx }, { rotate: rot }],
      }}
    >
      <Svg width={cfg.size} height={cfg.size} viewBox="0 0 24 24">
        <G>{shape(motif, { fill: color, stroke: 'none', sw: 0 })}</G>
      </Svg>
    </Animated.View>
  );
}

function Confetti({ count = 46 }: { count?: number }) {
  const skin = useSkin();
  const { width, height } = useWindowDimensions();
  const decor = DECOR[skin.id];
  const motifs = decor?.motifs.length ? decor.motifs : (['star', 'sparkle'] as const);
  const colors = [
    skin.colors.accent,
    skin.colors.accent2,
    '#ffffff',
    ...(decor ? decor.colors.map((c) => decorColor(skin, c)) : []),
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Particle
          key={i}
          i={i}
          w={width}
          h={height}
          color={colors[i % colors.length]}
          motif={motifs[i % motifs.length]}
        />
      ))}
    </View>
  );
}

function FinishBanner({ title }: { title: string }) {
  const skin = useSkin();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: skin.colors.panel, borderColor: skin.colors.accent, transform: [{ scale: t }] },
      ]}
    >
      <ThemedText variant="display" size={26} style={{ textAlign: 'center' }}>
        ¡Terminado!
      </ThemedText>
      <ThemedText size={15} style={{ textAlign: 'center' }} numberOfLines={2}>
        {title}
      </ThemedText>
    </Animated.View>
  );
}

function PlatinumCeremony({ title }: { title: string }) {
  const [enter] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [flip] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(flip, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flip, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [enter, spin, flip]);
  const rays = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.25, 1] });
  return (
    <View style={styles.center} pointerEvents="none">
      <Animated.View style={{ position: 'absolute', transform: [{ rotate: rays }] }}>
        <Svg width={420} height={420} viewBox="-210 -210 420 420">
          {Array.from({ length: 16 }, (_, i) => (
            <Path
              key={i}
              d="M-14 -40 L0 -205 L14 -40 Z"
              fill="#cfe6ff"
              opacity={0.18}
              transform={`rotate(${i * 22.5})`}
            />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: enter }, { scaleX }] }}>
        <PlatinumBadge size={170} />
      </Animated.View>
      <Animated.View style={{ opacity: enter, alignItems: 'center', marginTop: 26, gap: 6 }}>
        <ThemedText variant="display" size={28} style={styles.white}>
          ¡PLATINO!
        </ThemedText>
        <ThemedText variant="bold" size={13} style={[styles.white, { letterSpacing: 2 }]}>
          SAGA QUEST
        </ThemedText>
        <ThemedText size={16} style={[styles.white, { marginTop: 10, textAlign: 'center', paddingHorizontal: 30 }]}>
          {title}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

export function CelebrationHost() {
  const event = useCelebration((s) => s.event);
  const close = useCelebration((s) => s.close);
  useEffect(() => {
    if (!event) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (event.kind === 'platinum')
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), 450);
    }
    // El confeti de terminar se va solo; el platino espera a que toques.
    if (event.kind === 'finish') {
      const t = setTimeout(close, 3200);
      return () => clearTimeout(t);
    }
  }, [event, close]);
  if (!event) return null;
  return (
    <Pressable onPress={close} style={[StyleSheet.absoluteFill, event.kind === 'platinum' ? styles.dim : styles.clear]}>
      {event.kind === 'platinum' ? (
        <PlatinumCeremony title={event.title} />
      ) : (
        <View style={styles.center}>
          <FinishBanner title={event.title} />
        </View>
      )}
      <Confetti count={event.kind === 'platinum' ? 70 : 46} />
      {event.kind === 'platinum' ? (
        <ThemedText size={12} style={[styles.white, styles.tap]}>
          Toca para continuar
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(5,8,20,0.88)', zIndex: 1000 },
  clear: { backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { paddingHorizontal: 30, paddingVertical: 20, borderRadius: 22, borderWidth: 2, gap: 6, maxWidth: 320 },
  white: { color: '#ffffff' },
  tap: { position: 'absolute', bottom: 60, alignSelf: 'center', opacity: 0.7 },
});
