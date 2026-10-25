import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// Emojis de temporada flotando hacia arriba (calabazas, copos...), detrás del contenido.
export function SeasonParticles({ emojis, count = 10, height }: { emojis: string[]; count?: number; height: number }) {
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: ((i * 37) % 100) / 100,
        size: 14 + ((i * 7) % 12),
        delay: (i * 530) % 4000,
        duration: 5200 + ((i * 911) % 3000),
        emoji: emojis[i % emojis.length],
      })),
    [count, emojis],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {seeds.map((s, i) => (
        <Particle key={i} {...s} height={height} />
      ))}
    </View>
  );
}

function Particle({
  left,
  size,
  delay,
  duration,
  emoji,
  height,
}: {
  left: number;
  size: number;
  delay: number;
  duration: number;
  emoji: string;
  height: number;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay, duration]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${left * 100}%`,
        bottom: -size,
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.6, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -height - size * 2] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '20deg'] }) },
        ],
      }}
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}
