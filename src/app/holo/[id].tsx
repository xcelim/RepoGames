import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { GameCover } from '@/components/games';
import { DarkButton, IgnScreen, StatusBadge, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { formatHours, gameHours, userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';

type Rarity = { name: string; colors: [string, string, string] };

function rarity(score: number | null | undefined, mine: number | null | undefined): Rarity {
  const s = mine ? mine * 10 : (score ?? 0);
  if (s >= 90) return { name: 'LEGENDARIA', colors: ['#f7d774', '#ff8a00', '#fff3b0'] };
  if (s >= 80) return { name: 'ÉPICA', colors: ['#c471f5', '#7b2ff7', '#fa71cd'] };
  if (s >= 70) return { name: 'RARA', colors: ['#4facfe', '#00f2fe', '#a1c4fd'] };
  return { name: 'COMÚN', colors: ['#bdc3c7', '#8e9eab', '#eef2f3'] };
}

const HOLO = ['#ff0080', '#ff8c00', '#ffe600', '#00ff85', '#00c8ff', '#8a2be2', '#ff0080'] as const;

// Carta holográfica de un juego: se inclina con el móvil (o arrastrando) y brilla.
export default function HoloCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const game = useStore((s) => s.games[id]);
  const ug = useStore((s) => (profile ? s.userGames[userGameKey(profile.id, id)] : undefined));
  const mode = useStore((s) => s.durationMode);
  const [tx] = useState(() => new Animated.Value(0)); // -1..1 izquierda/derecha
  const [ty] = useState(() => new Animated.Value(0)); // -1..1 arriba/abajo
  const [dragging] = useState(() => ({ current: false }));
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  // Giroscopio: inclinar el móvil mueve la carta.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    let base: { beta: number; gamma: number } | null = null;
    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!ok) return;
        DeviceMotion.setUpdateInterval(33);
        sub = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation || dragging.current) return;
          base ??= { beta: rotation.beta, gamma: rotation.gamma };
          const clamp = (v: number) => Math.max(-1, Math.min(1, v));
          tx.setValue(clamp((rotation.gamma - base.gamma) / 0.45));
          ty.setValue(clamp((rotation.beta - base.beta) / 0.45));
        });
      })
      .catch(() => undefined);
    return () => sub?.remove();
  }, [tx, ty]);

  const cardW = Math.min(width - 60, 340);
  const cardH = cardW * 1.45;
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragging.current = true;
      },
      onPanResponderMove: (_e, g) => {
        tx.setValue(Math.max(-1, Math.min(1, g.dx / 120)));
        ty.setValue(Math.max(-1, Math.min(1, g.dy / 120)));
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(tx, { toValue: 0, friction: 4, useNativeDriver: true }),
          Animated.spring(ty, { toValue: 0, friction: 4, useNativeDriver: true }),
        ]).start(() => {
          dragging.current = false;
        });
      },
    }),
  );

  if (!game) {
    return (
      <IgnScreen title="Carta" back contentStyle={{ paddingHorizontal: 20 }}>
        <ThemedText variant="muted">No se encontró el juego.</ThemedText>
      </IgnScreen>
    );
  }

  const r = rarity(game.criticRating, ug?.rating);
  const rotateY = tx.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  const rotateX = ty.interpolate({ inputRange: [-1, 1], outputRange: ['14deg', '-14deg'] });
  const holoX = tx.interpolate({ inputRange: [-1, 1], outputRange: [-cardW * 0.6, cardW * 0.6] });
  const holoY = ty.interpolate({ inputRange: [-1, 1], outputRange: [-cardH * 0.3, cardH * 0.3] });
  const glareX = tx.interpolate({ inputRange: [-1, 1], outputRange: [cardW * 0.9, -cardW * 0.9] });
  const hours = ug?.hoursPlayed ?? gameHours(game, mode);

  const share = async () => {
    if (Platform.OS === 'web') {
      notify('Compartir la carta funciona en el móvil.');
      return;
    }
    try {
      setBusy(true);
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: game.title });
    } catch {
      notify('No se pudo compartir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IgnScreen title="Carta holográfica" back contentStyle={{ alignItems: 'center', gap: 22, paddingHorizontal: 20 }}>
      <ThemedText variant="muted" size={13} style={{ textAlign: 'center' }}>
        {Platform.OS === 'web'
          ? 'Arrastra la carta para verla brillar.'
          : 'Inclina el móvil (o arrastra la carta) para verla brillar.'}
      </ThemedText>
      <View {...pan.panHandlers}>
        <Animated.View style={{ transform: [{ perspective: 800 }, { rotateX }, { rotateY }] }}>
          <View ref={card} collapsable={false} style={[styles.card, { width: cardW, height: cardH }]}>
            <LinearGradient
              colors={r.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.inner, { backgroundColor: '#0d0d14' }]}>
              <View style={styles.top}>
                <ThemedText variant="bold" size={11} style={{ color: r.colors[0], letterSpacing: 2 }}>
                  {r.name}
                </ThemedText>
                {ug?.rating ? (
                  <ThemedText variant="display" size={20} style={{ color: '#fff' }}>
                    {ug.rating}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.coverWrap}>
                <GameCover game={game} width={Math.min(cardW - 44, (cardH - 160) * 0.75)} plain radius={10} />
              </View>
              <ThemedText variant="display" size={20} style={{ color: '#fff' }} numberOfLines={2}>
                {game.title}
              </ThemedText>
              <View style={styles.meta}>
                {ug ? <StatusBadge status={ug.status} /> : null}
                <ThemedText size={12} style={{ color: '#ffffffaa' }}>
                  {[game.year, hours ? formatHours(hours) : null].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
            </View>
            {/* Brillo holográfico y reflejo que se mueven con la inclinación */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.holo,
                {
                  width: cardW * 2.2,
                  height: cardH * 1.6,
                  left: -cardW * 0.6,
                  top: -cardH * 0.3,
                  transform: [{ translateX: holoX }, { translateY: holoY }, { rotate: '25deg' }],
                },
              ]}
            >
              <LinearGradient
                colors={HOLO}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glare,
                {
                  height: cardH * 1.6,
                  top: -cardH * 0.3,
                  left: cardW * 0.35,
                  transform: [{ translateX: glareX }, { rotate: '20deg' }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
      <DarkButton
        label={busy ? 'Preparando…' : 'Compartir carta'}
        icon="share-outline"
        onPress={share}
        disabled={busy}
        style={{ alignSelf: 'stretch' }}
      />
      <ThemedText variant="muted" size={12} style={{ textAlign: 'center', color: c.muted }}>
        La rareza sale de tu nota (o de la de la crítica): común, rara, épica o legendaria.
      </ThemedText>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', padding: 6 },
  inner: { flex: 1, borderRadius: 17, padding: 16, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coverWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  holo: { position: 'absolute', opacity: 0.22 },
  glare: { position: 'absolute', width: 90 },
});
