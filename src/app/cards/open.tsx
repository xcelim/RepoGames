import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { openDailyPack, RARITY_META, type GameCardItem } from '@/cloud/cards';
import { GameCard } from '@/components/GameCard';
import { DarkButton, IgnScreen, LightButton, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { useGameLookup } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import { notify } from '@/utils/notify';

const buzz = (strong = false) => {
  if (Platform.OS === 'web') return;
  (strong
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  ).catch(() => undefined);
};

function FlipCard({ card, width, index }: { card: GameCardItem; width: number; index: number }) {
  const lookup = useGameLookup();
  const [flip] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(false);
  const meta = RARITY_META[card.rarity];
  const special = card.rarity === 'legendary' || card.rarity === 'epic' || card.foil;

  const reveal = () => {
    if (shown) return;
    setShown(true);
    buzz(special);
    Animated.sequence([
      Animated.timing(flip, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        { iterations: special ? -1 : 1 },
      ),
    ]).start();
  };

  // Se dan la vuelta solas una detrás de otra (o al tocarlas).
  useEffect(() => {
    const t = setTimeout(reveal, 700 + index * 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const height = width * 1.42;
  const front = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['90deg', '90deg', '0deg'],
  });
  const back = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-90deg', '-90deg'],
  });
  const scale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, special ? 1.18 : 1.05],
  });

  return (
    <Pressable onPress={reveal} style={{ width, height }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            width: width * 1.25,
            height: height * 1.15,
            left: -width * 0.125,
            top: -height * 0.075,
            backgroundColor: meta.color,
          },
          {
            opacity: Animated.multiply(glow, special ? 0.55 : 0.25),
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY: back }] }]}>
        <LinearGradient
          colors={['#1d1b3a', '#3b1d6e', '#1d1b3a']}
          style={[styles.back, { borderRadius: width * 0.08 }]}
        >
          <ThemedText variant="display" size={width * 0.16} style={{ color: '#ffffffcc' }}>
            SQ
          </ThemedText>
          <Ionicons name="sparkles" size={width * 0.18} color="#ffffff88" />
        </LinearGradient>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY: front }] }]}>
        <GameCard game={lookup(card.gameId)} rarity={card.rarity} foil={card.foil} width={width} />
      </Animated.View>
    </Pressable>
  );
}

// Abrir el sobre del día: el sobre tiembla, se rompe y salen 3 cromos que se dan la vuelta.
export default function OpenPackScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const upsertGame = useStore((s) => s.upsertGame);
  const lookup = useGameLookup();
  const [phase, setPhase] = useState<'idle' | 'opening' | 'reveal'>('idle');
  const [cards, setCards] = useState<GameCardItem[]>([]);
  const [shake] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (phase !== 'idle') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, shake]);

  const open = async () => {
    if (phase !== 'idle') return;
    setPhase('opening');
    buzz();
    try {
      const got = await openDailyPack();
      Animated.timing(burst, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setCards(got);
        setPhase('reveal');
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo abrir el sobre');
      setPhase('idle');
      router.back();
    }
  };

  const rotate = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-6deg', '6deg'],
  });
  const packScale = burst.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });
  const packOpacity = burst.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.3, 0],
  });
  const cardW = Math.min(150, (width - 40 - 24) / 3);

  return (
    <IgnScreen title="Sobre del día" back contentStyle={{ paddingHorizontal: 20, gap: 24, alignItems: 'center' }}>
      {phase !== 'reveal' ? (
        <Pressable onPress={open} style={{ alignItems: 'center', gap: 18, marginTop: 20 }}>
          <Animated.View
            style={{
              transform: [{ rotate }, { scale: packScale }],
              opacity: packOpacity,
            }}
          >
            <LinearGradient colors={['#ff512f', '#dd2476', '#7b2ff7']} style={styles.pack}>
              <View style={styles.packStripe} />
              <ThemedText variant="display" size={34} style={{ color: '#fff' }}>
                SAGA
              </ThemedText>
              <ThemedText variant="display" size={34} style={{ color: '#fff' }}>
                QUEST
              </ThemedText>
              <ThemedText variant="bold" size={12} style={{ color: '#ffffffcc', letterSpacing: 2 }}>
                3 CROMOS
              </ThemedText>
              <View style={[styles.packStripe, { top: undefined, bottom: 18 }]} />
            </LinearGradient>
          </Animated.View>
          <ThemedText variant="bold" size={15}>
            {phase === 'opening' ? 'Abriendo…' : 'Toca el sobre para abrirlo'}
          </ThemedText>
        </Pressable>
      ) : (
        <>
          <View style={styles.row}>
            {cards.map((card, i) => (
              <FlipCard key={card.id} card={card} width={cardW} index={i} />
            ))}
          </View>
          <ThemedText variant="muted" size={13} style={{ textAlign: 'center' }}>
            {cards.some((x) => x.rarity === 'legendary')
              ? '¡LEGENDARIO! 🔥'
              : cards.some((x) => x.foil)
                ? '¡Te ha tocado uno brillante! ✦'
                : 'Toca un cromo si no se ha dado la vuelta.'}
          </ThemedText>
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            {cards.map((card) => {
              const g = lookup(card.gameId);
              return g ? (
                <Pressable
                  key={card.id}
                  onPress={() => {
                    if (!useStore.getState().games[g.id]) upsertGame(g);
                    router.push(`/game/${encodeURIComponent(g.id)}`);
                  }}
                  style={[styles.line, { borderColor: c.line, borderRadius: c.radius }]}
                >
                  <View style={[styles.dot, { backgroundColor: RARITY_META[card.rarity].color }]} />
                  <ThemedText size={14} style={{ flex: 1 }} numberOfLines={1}>
                    {g.title}
                  </ThemedText>
                  <ThemedText variant="muted" size={12}>
                    Ver juego ›
                  </ThemedText>
                </Pressable>
              ) : null;
            })}
          </View>
          <DarkButton label="Ver mi álbum" onPress={() => router.replace('/cards')} style={{ alignSelf: 'stretch' }} />
          <LightButton label="Volver" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </>
      )}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  pack: {
    width: 200,
    height: 290,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  packStripe: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#ffffff55',
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  aura: { position: 'absolute', borderRadius: 24 },
  back: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#ffffff33',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
