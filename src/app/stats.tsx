import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Card, IgnScreen, splitPlatforms, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { finishedDay, shortDate, useMyGames } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import { formatHours, gameHours } from '@/utils/library';
import { activityByDay, archetype, heatmapGrid, streaks } from '@/utils/stats';

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function Bars({
  data,
  color,
  height = 110,
}: {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={[styles.bars, { height: height + 34 }]}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.barCol}>
          <ThemedText variant="muted" size={10}>
            {d.value || ''}
          </ThemedText>
          <View style={{ height, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
            <View
              style={{
                width: '70%',
                height: Math.max(d.value ? 4 : 0, (d.value / max) * height),
                backgroundColor: color,
                borderRadius: 4,
              }}
            />
          </View>
          <ThemedText variant="muted" size={10} numberOfLines={1}>
            {d.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function HBars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const c = useIgnColors();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 8 }}>
      {data.map((d) => (
        <View key={d.label} style={styles.hRow}>
          <ThemedText size={12} style={{ width: 92 }} numberOfLines={1}>
            {d.label}
          </ThemedText>
          <View style={[styles.hTrack, { backgroundColor: c.soft }]}>
            <View
              style={{ width: `${(d.value / max) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 6 }}
            />
          </View>
          <ThemedText variant="bold" size={12} style={{ width: 30, textAlign: 'right' }}>
            {d.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  const c = useIgnColors();
  return (
    <View style={[styles.big, { backgroundColor: c.soft, borderRadius: c.radius }]}>
      <ThemedText variant="display" size={24}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={10} style={styles.caps}>
        {label}
      </ThemedText>
    </View>
  );
}

// Estadísticas: tu perfil de jugador, mapa de calor, rachas y gráficas.
export default function StatsScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const mine = useMyGames();
  const mode = useStore((s) => s.durationMode);
  const [selDay, setSelDay] = useState<string | null>(null);
  const year = new Date().getFullYear();
  // Medio año en el móvil; el año entero si cabe.
  const weeks = width >= 900 ? 52 : 26;

  const data = useMemo(() => {
    const activity = activityByDay(mine);
    const finished = mine.filter((m) => finishedDay(m.ug));
    const monthly = MONTHS.map((label, i) => ({
      label,
      value: finished.filter((m) => finishedDay(m.ug)!.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`)).length,
    }));
    const platforms = new Map<string, number>();
    for (const m of mine) {
      if (m.ug.status === 'wishlist') continue;
      const p = m.ug.platform || splitPlatforms(m.game.platforms)[0];
      if (p) platforms.set(p, (platforms.get(p) ?? 0) + 1);
    }
    const decades = new Map<string, number>();
    for (const m of mine) {
      if (!m.game.year) continue;
      const d = `${Math.floor(m.game.year / 10) * 10}s`.replace(/^(19|20)/, "'");
      decades.set(d, (decades.get(d) ?? 0) + 1);
    }
    const ratings = Array.from({ length: 10 }, (_, i) => ({
      label: String(i + 1),
      value: mine.filter((m) => m.ug.rating === i + 1).length,
    }));
    const hours = finished.reduce((a, m) => a + (m.ug.hoursPlayed ?? gameHours(m.game, mode)), 0);
    const longest = finished.reduce<(typeof finished)[number] | null>(
      (best, m) => (!best || gameHours(m.game, mode) > gameHours(best.game, mode) ? m : best),
      null,
    );
    const rated = mine.filter((m) => m.ug.rating);
    return {
      activity,
      grid: heatmapGrid(activity, weeks),
      streak: streaks(activity),
      monthly,
      platforms: [...platforms.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value })),
      decades: [...decades.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([label, value]) => ({ label, value })),
      ratings,
      hours,
      finished: finished.length,
      longest,
      avg: rated.length ? rated.reduce((a, m) => a + (m.ug.rating ?? 0), 0) / rated.length : null,
      arch: archetype(mine, mode),
      activeDays: activity.size,
    };
  }, [mine, mode, year, weeks]);

  const cell = Math.min(16, Math.floor((width - 40 - 36 - (weeks - 1) * 3) / weeks));
  const maxDay = Math.max(1, ...[...data.activity.values()]);
  const shade = (n: number) => (n === 0 ? c.soft : c.accent);
  const alpha = (n: number) => (n === 0 ? 1 : [0.35, 0.55, 0.8, 1][Math.min(3, Math.floor((n / maxDay) * 3.99))]);

  return (
    <IgnScreen title="Estadísticas" back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <LinearGradient colors={['#7b2ff7', '#f107a3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <ThemedText size={48}>{data.arch.emoji}</ThemedText>
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText size={11} style={[styles.caps, { color: '#ffffffcc' }]}>
            Tu perfil de jugador
          </ThemedText>
          <ThemedText variant="display" size={24} style={{ color: '#fff' }}>
            {data.arch.name}
          </ThemedText>
          <ThemedText size={13} style={{ color: '#ffffffee' }}>
            {data.arch.description}
          </ThemedText>
        </View>
      </LinearGradient>

      <View style={styles.row}>
        <Big value={`${data.streak.current}🔥`} label="Racha actual" />
        <Big value={String(data.streak.best)} label="Mejor racha" />
        <Big value={String(data.activeDays)} label="Días activos" />
      </View>

      <Card style={{ gap: 10 }}>
        <ThemedText variant="bold" size={13} style={styles.caps}>
          {weeks === 52 ? 'Último año' : 'Últimos 6 meses'}
        </ThemedText>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ gap: 3, width: 30 }}>
            {['L', '', 'X', '', 'V', '', 'D'].map((d, i) => (
              <ThemedText key={i} variant="muted" size={9} style={{ height: cell, lineHeight: cell }}>
                {d}
              </ThemedText>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {data.grid.map((col, w) => (
              <View key={w} style={{ gap: 3 }}>
                {col.map((d) => (
                  <Pressable
                    key={d.day}
                    onPress={() => setSelDay(d.day)}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: 3,
                      backgroundColor: d.future ? 'transparent' : shade(d.count),
                      opacity: alpha(d.count),
                      borderWidth: selDay === d.day ? 1.5 : 0,
                      borderColor: c.text,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
        <ThemedText variant="muted" size={12}>
          {selDay
            ? `${shortDate(selDay)}: ${data.activity.get(selDay) ?? 0} ${(data.activity.get(selDay) ?? 0) === 1 ? 'juego tocado' : 'juegos tocados'}`
            : 'Cada cuadrado es un día: añadir, empezar o terminar juegos lo enciende. Toca uno.'}
        </ThemedText>
      </Card>

      <View style={styles.row}>
        <Big value={String(data.finished)} label="Terminados" />
        <Big value={formatHours(data.hours)} label="Horas jugadas" />
        <Big value={data.avg ? data.avg.toFixed(1) : '–'} label="Tu nota media" />
      </View>

      <Card style={{ gap: 10 }}>
        <ThemedText variant="bold" size={13} style={styles.caps}>
          {`Terminados en ${year}`}
        </ThemedText>
        <Bars data={data.monthly} color={c.accent} />
      </Card>

      {data.platforms.length ? (
        <Card style={{ gap: 12 }}>
          <ThemedText variant="bold" size={13} style={styles.caps}>
            Dónde juegas
          </ThemedText>
          <HBars data={data.platforms} color="#2ec5ff" />
        </Card>
      ) : null}

      {data.decades.length ? (
        <Card style={{ gap: 10 }}>
          <ThemedText variant="bold" size={13} style={styles.caps}>
            Por décadas
          </ThemedText>
          <Bars data={data.decades} color="#f59e0b" height={90} />
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <ThemedText variant="bold" size={13} style={styles.caps}>
          Tus notas
        </ThemedText>
        <Bars data={data.ratings} color="#47cf73" height={90} />
      </Card>

      {data.longest ? (
        <Card>
          <ThemedText variant="muted" size={13}>
            {`Tu juego terminado más largo: ${data.longest.game.title} (${formatHours(gameHours(data.longest.game, mode))}).`}
          </ThemedText>
        </Card>
      ) : null}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  caps: { letterSpacing: 0.8, textTransform: 'uppercase' },
  hero: { borderRadius: 20, padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  big: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
});
