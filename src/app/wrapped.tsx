import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlatinumBadge } from '@/components/achievements';
import { AvatarFrame } from '@/components/AvatarFrame';
import { GameCover } from '@/components/games';
import { LevelBadge } from '@/components/LevelBadge';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { useLevel } from '@/hooks/useLevel';
import { useAchievementData } from '@/hooks/usePlatinums';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { funFact } from '@/utils/fun';
import { formatHours, replayTotals } from '@/utils/library';
import { buildWrapped, MONTHS, wrappedYears, type WrappedData } from '@/utils/wrapped';
import { shareImage } from '@/utils/shareImage';
import { goBack } from '@/utils/nav';

const DURATION = 6500;
const PALETTES: [string, string][] = [
  ['#7b2ff7', '#f107a3'],
  ['#ff512f', '#dd2476'],
  ['#11998e', '#38ef7d'],
  ['#1e3c72', '#2a5298'],
  ['#f7971e', '#ffd200'],
  ['#c94b4b', '#4b134f'],
  ['#00c6ff', '#0072ff'],
  ['#8e2de2', '#4a00e0'],
  ['#ee0979', '#ff6a00'],
  ['#232526', '#414345'],
];

// Tu año en juegos, en formato historias.
export default function WrappedScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const profile = useCurrentProfile();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const mode = useStore((s) => s.durationMode);
  const lv = useLevel();
  const { platinums } = useAchievementData();
  const mine = useMemo(() => Object.values(userGames).filter((u) => u.profileId === profileId), [userGames, profileId]);
  const years = useMemo(() => wrappedYears(mine), [mine]);
  const [year, setYear] = useState(() => years[0] ?? new Date().getFullYear());
  const data = useMemo(() => {
    const totals = profileId ? replayTotals({ lists, items, userGames }, profileId) : new Map<string, number>();
    return buildWrapped(year, mine, games, mode, (gid) => totals.get(gid) ?? 0);
  }, [year, mine, games, mode, lists, items, userGames, profileId]);
  const yearPlats = platinums.filter((p) => p.ug.updatedAt.startsWith(String(year)));
  const slides = useMemo(() => makeSlides(data, yearPlats.length), [data, yearPlats.length]);
  const [index, setIndex] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const shotRef = useRef<View>(null);

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setIndex((i) => Math.min(slides.length - 1, i + 1));
    });
    return () => anim.stop();
  }, [index, progress, slides.length]);

  const go = (d: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + d)));

  const share = async () => {
    try {
      await shareImage(shotRef, `Mi ${year} en Saga Quest`);
    } catch {
      // nada
    }
  };

  if (!profile) return null;
  const slide = slides[index];
  const [c1, c2] = PALETTES[index % PALETTES.length];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View ref={shotRef} collapsable={false} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.slide, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 90 }]}>
          <Enter key={`${year}-${index}`}>
            {slide.render({
              data,
              width,
              height,
              profile,
              lv,
              plats: yearPlats.length,
              years,
              year,
              setYear: (y) => {
                setYear(y);
                setIndex(0);
              },
            })}
          </Enter>
        </View>
        <ThemedText variant="bold" size={11} style={[styles.brand, { bottom: insets.bottom + 24 }]}>
          SAGA QUEST · {year}
        </ThemedText>
      </View>

      {/* Zonas para pasar historias */}
      <Pressable style={[styles.tapLeft]} onPress={() => go(-1)} />
      <Pressable style={[styles.tapRight]} onPress={() => go(1)} />

      <View style={[styles.bars, { top: insets.top + 10 }]}>
        {slides.map((_, i) => (
          <View key={i} style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={[styles.topRow, { top: insets.top + 22 }]}>
        <ThemedText variant="bold" size={13} style={styles.white}>
          Tu {year}
        </ThemedText>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>
      {index === slides.length - 1 ? (
        <Pressable onPress={share} style={[styles.share, { bottom: insets.bottom + 46 }]}>
          <Ionicons name="share-social" size={18} color="#000" />
          <ThemedText variant="bold" size={14} style={{ color: '#000' }}>
            Compartir
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Enter({ children }: { children: ReactNode }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: t,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

type Ctx = {
  data: WrappedData;
  width: number;
  height: number;
  profile: NonNullable<ReturnType<typeof useCurrentProfile>>;
  lv: ReturnType<typeof useLevel>;
  plats: number;
  years: number[];
  year: number;
  setYear: (y: number) => void;
};
type Slide = { render: (ctx: Ctx) => ReactNode };

const Big = ({ children, size = 96 }: { children: ReactNode; size?: number }) => (
  <ThemedText variant="display" size={size} style={[styles.white, { lineHeight: size * 1.05 }]}>
    {children}
  </ThemedText>
);
const Txt = ({ children, size = 20, bold }: { children: ReactNode; size?: number; bold?: boolean }) => (
  <ThemedText variant={bold ? 'bold' : 'body'} size={size} style={styles.white}>
    {children}
  </ThemedText>
);

function makeSlides(d: WrappedData, plats: number): Slide[] {
  const s: Slide[] = [];
  s.push({
    render: ({ profile, years, year, setYear }) => (
      <View style={styles.center}>
        <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={110} />
        <Txt size={22}>{profile.displayName},</Txt>
        <Big size={54}>este fue tu {year} en juegos</Big>
        {years.length > 1 ? (
          <View style={styles.years}>
            {years.map((y) => (
              <Pressable
                key={y}
                onPress={() => setYear(y)}
                style={[styles.yearChip, y === year && { backgroundColor: '#fff' }]}
              >
                <ThemedText variant="bold" size={13} style={{ color: y === year ? '#000' : '#fff' }}>
                  {y}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    ),
  });
  s.push({
    render: ({ width }) => (
      <View style={styles.center}>
        <Txt size={22}>Terminaste</Txt>
        <Big size={140}>{d.finished.length}</Big>
        <Txt size={22}>{d.finished.length === 1 ? 'juego' : 'juegos'}</Txt>
        <View style={styles.collage}>
          {d.finished.slice(-8).map((f, i) => (
            <View
              key={f.game.id}
              style={{ transform: [{ rotate: `${(i % 2 ? 1 : -1) * (4 + (i % 3) * 3)}deg` }], marginLeft: i ? -18 : 0 }}
            >
              <GameCover game={f.game} width={Math.min(84, (width - 80) / 5)} radius={6} plain />
            </View>
          ))}
        </View>
      </View>
    ),
  });
  if (d.hours > 0) {
    s.push({
      render: () => (
        <View style={styles.center}>
          <Txt size={22}>Le dedicaste unas</Txt>
          <Big size={110}>{formatHours(d.hours)}</Big>
          <Txt size={18}>{funFact(d.hours) ?? ''}</Txt>
        </View>
      ),
    });
  }
  if (d.bestMonth !== null) {
    const max = Math.max(...d.byMonth, 1);
    s.push({
      render: () => (
        <View style={styles.center}>
          <Txt size={22}>Tu mes más viciado fue</Txt>
          <Big size={64}>{MONTHS[d.bestMonth!]}</Big>
          <Txt size={18}>
            con {d.byMonth[d.bestMonth!]} {d.byMonth[d.bestMonth!] === 1 ? 'juego terminado' : 'juegos terminados'}
          </Txt>
          <View style={styles.chart}>
            {d.byMonth.map((n, i) => (
              <View key={i} style={styles.chartCol}>
                <View
                  style={[styles.chartBar, { height: `${(n / max) * 100}%`, opacity: i === d.bestMonth ? 1 : 0.45 }]}
                />
                <ThemedText size={10} style={styles.white}>
                  {MONTHS[i][0].toUpperCase()}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ),
    });
  }
  if (d.topRated) {
    s.push({
      render: ({ width }) => (
        <View style={styles.center}>
          <Txt size={22}>Tu juego del año</Txt>
          <View style={styles.hero}>
            <GameCover game={d.topRated!.game} width={Math.min(220, width * 0.55)} radius={14} plain />
          </View>
          <Big size={38}>{d.topRated!.game.title}</Big>
          <Txt size={22} bold>
            Le diste un {d.topRated!.ug.rating}
          </Txt>
        </View>
      ),
    });
  }
  if (d.platform) {
    s.push({
      render: () => (
        <View style={styles.center}>
          <Ionicons name="game-controller" size={80} color="#fff" />
          <Txt size={22}>Tu plataforma favorita</Txt>
          <Big size={60}>{d.platform!.name}</Big>
          <Txt size={18}>
            {d.platform!.count} {d.platform!.count === 1 ? 'juego terminado' : 'juegos terminados'} en ella
          </Txt>
        </View>
      ),
    });
  }
  if (plats > 0 || d.replays > 0) {
    s.push({
      render: () => (
        <View style={styles.center}>
          {plats > 0 ? (
            <>
              <PlatinumBadge size={130} />
              <Big size={90}>{plats}</Big>
              <Txt size={22}>{plats === 1 ? 'Platino Saga Quest' : 'Platinos Saga Quest'}</Txt>
            </>
          ) : null}
          {d.replays > 0 ? (
            <Txt size={20} bold>
              🔁 Y rejugaste {d.replays} {d.replays === 1 ? 'vez' : 'veces'} tus favoritos
            </Txt>
          ) : null}
        </View>
      ),
    });
  }
  s.push({
    render: () => (
      <View style={styles.center}>
        <Txt size={22}>Este año has sido</Txt>
        <ThemedText size={120}>{d.persona.emoji}</ThemedText>
        <Big size={58}>{d.persona.name}</Big>
        <Txt size={20}>{d.persona.text}</Txt>
      </View>
    ),
  });
  s.push({
    render: ({ profile, lv, data }) => (
      <View style={styles.center}>
        <AvatarFrame frame={lv.frame} size={100}>
          <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={100} />
        </AvatarFrame>
        <Big size={40}>
          {profile.displayName} · {data.year}
        </Big>
        <View style={styles.summary}>
          <Sum value={String(data.finished.length)} label="terminados" />
          <Sum value={formatHours(data.hours)} label="horas" />
          <Sum value={String(plats)} label="platinos" />
        </View>
        <View style={styles.levelRow}>
          <LevelBadge level={lv.level} size={40} />
          <Txt size={20} bold>
            Nivel {lv.level}
          </Txt>
        </View>
        <Txt size={16}>
          {data.persona.emoji} {data.persona.name}
        </Txt>
      </View>
    ),
  });
  return s;
}

const Sum = ({ value, label }: { value: string; label: string }) => (
  <View style={{ alignItems: 'center', flex: 1 }}>
    <ThemedText variant="display" size={30} style={styles.white}>
      {value}
    </ThemedText>
    <ThemedText size={12} style={styles.white}>
      {label}
    </ThemedText>
  </View>
);

const styles = StyleSheet.create({
  white: { color: '#fff', textAlign: 'center' },
  slide: { flex: 1, paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  bars: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapLeft: { position: 'absolute', left: 0, top: 80, bottom: 120, width: '30%' },
  tapRight: { position: 'absolute', right: 0, top: 80, bottom: 120, width: '70%' },
  brand: { position: 'absolute', alignSelf: 'center', color: '#ffffffaa', letterSpacing: 2 },
  collage: { flexDirection: 'row', marginTop: 20, justifyContent: 'center' },
  chart: { flexDirection: 'row', height: 140, alignSelf: 'stretch', gap: 6, marginTop: 20 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartBar: { width: '100%', backgroundColor: '#fff', borderRadius: 4, minHeight: 3 },
  hero: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, marginVertical: 10 },
  years: { flexDirection: 'row', gap: 8, marginTop: 20 },
  yearChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: '#fff' },
  summary: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 10 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  share: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
