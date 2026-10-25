// Cromo coleccionable de un juego: marco según la rareza y, si es brillante, reflejo holográfico.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { RARITY_META, type Rarity } from '@/cloud/cards';
import type { GameRecord } from '@/types';

import { GameCover } from './games';
import { ThemedText } from './ThemedText';

const HOLO = ['#ff008055', '#ff8c0055', '#ffe60055', '#00ff8555', '#00c8ff55', '#8a2be255', '#ff008055'] as const;

function FoilSweep({ width, height }: { width: number; height: number }) {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 1.5, width * 1.5],
  });
  const style =
    Platform.OS === 'web'
      ? ({
          left: '-70%',
          animationName: 'sq-sweep',
          animationDuration: '2600ms',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        } as object)
      : { transform: [{ translateX }] };
  const Sweep = (Platform.OS === 'web' ? View : Animated.View) as typeof Animated.View;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <LinearGradient colors={HOLO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Sweep
        style={[
          {
            position: 'absolute',
            top: -height * 0.2,
            width: width * 0.45,
            height: height * 1.4,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { transform: [{ rotate: '20deg' }] }]}
        />
      </Sweep>
    </View>
  );
}

export function GameCard({
  game,
  rarity,
  foil,
  width,
  count,
  locked,
}: {
  game: GameRecord | undefined;
  rarity: Rarity;
  foil?: boolean;
  width: number;
  count?: number; // copias (×2, ×3…)
  locked?: boolean; // hueco vacío del álbum
}) {
  const meta = RARITY_META[rarity];
  const height = width * 1.42;
  const pad = Math.max(4, width * 0.045);
  const coverW = width - pad * 2 - 8;
  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          borderRadius: width * 0.08,
          opacity: locked ? 0.35 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={meta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { margin: pad, borderRadius: width * 0.06, padding: 4 }]}>
        <View style={styles.top}>
          <ThemedText variant="bold" size={Math.max(8, width * 0.06)} style={{ color: meta.color, letterSpacing: 1 }}>
            {meta.label.toUpperCase()}
          </ThemedText>
          {count && count > 1 ? (
            <View style={[styles.count, { backgroundColor: meta.color }]}>
              <ThemedText variant="bold" size={Math.max(8, width * 0.06)} style={{ color: '#111' }}>
                ×{count}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          {game ? (
            <GameCover
              game={game}
              width={Math.min(coverW, (height - pad * 2 - width * 0.38) * 0.75)}
              plain
              radius={4}
            />
          ) : null}
        </View>
        <ThemedText variant="bold" size={Math.max(9, width * 0.075)} style={{ color: '#fff' }} numberOfLines={2}>
          {game?.title ?? '…'}
        </ThemedText>
        <ThemedText size={Math.max(8, width * 0.055)} style={{ color: '#ffffff99' }} numberOfLines={1}>
          {[game?.year, foil ? '✦ Brillante' : null].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {foil && !locked ? <FoilSweep width={width} height={height} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  inner: { flex: 1, backgroundColor: '#0d0d14', gap: 3 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 14,
  },
  count: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
});
