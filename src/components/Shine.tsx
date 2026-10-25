// Marco brillante de los platinos: borde plateado con un destello que pasa cada poco.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { PlatinumBadge } from './achievements';

export function Shine({
  width,
  height,
  radius = 12,
  border = 3,
  badge = 30,
  children,
}: {
  width: number;
  height: number;
  radius?: number;
  border?: number;
  badge?: number;
  children: ReactNode;
}) {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (Platform.OS === 'web') return; // en la web, animación CSS
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400 + Math.random() * 800),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const sweep = x.interpolate({ inputRange: [0, 1], outputRange: [-width * 1.2, width * 1.2] });
  const outerW = width + border * 2;
  const outerH = height + border * 2;

  return (
    <View style={[styles.glow, { width: outerW, height: outerH, borderRadius: radius + border }]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius + border, overflow: 'hidden' }]}>
        <LinearGradient
          colors={['#f6f9fd', '#a9b9d0', '#ffffff', '#7f93b2', '#e6edf7', '#9ad7ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Streak
          style={[
            styles.streak,
            Platform.OS === 'web'
              ? ({
                  height: outerH * 1.6,
                  top: -outerH * 0.3,
                  transform: [{ rotate: '18deg' }],
                  animationName: 'sq-sweep',
                  animationDuration: '3000ms',
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                } as object)
              : { height: outerH * 1.6, top: -outerH * 0.3, transform: [{ translateX: sweep }, { rotate: '18deg' }] },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Streak>
      </View>
      <View style={{ margin: border, width, height, borderRadius: radius, overflow: 'hidden' }}>
        {children}
        {/* El destello también cruza la portada, más suave */}
        <Streak
          pointerEvents="none"
          style={[
            styles.streak,
            Platform.OS === 'web'
              ? ({
                  height: height * 1.6,
                  top: -height * 0.3,
                  opacity: 0.35,
                  transform: [{ rotate: '18deg' }],
                  animationName: 'sq-sweep',
                  animationDuration: '3000ms',
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                } as object)
              : {
                  height: height * 1.6,
                  top: -height * 0.3,
                  opacity: 0.35,
                  transform: [{ translateX: sweep }, { rotate: '18deg' }],
                },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Streak>
      </View>
      {badge ? (
        <View style={[styles.badge, { right: border + 4, bottom: border + 4 }]} pointerEvents="none">
          <PlatinumBadge size={badge} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowColor: '#9ad7ff',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    backgroundColor: '#a9b9d0',
  },
  streak: { position: 'absolute', left: 0, width: 46 },
  badge: { position: 'absolute' },
});

// En la web, una View normal (Animated.View descarta las animaciones CSS).
const Streak = (Platform.OS === 'web' ? View : Animated.View) as typeof Animated.View;
