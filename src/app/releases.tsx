import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useUpcomingWide } from '@/api/discover';
import { UPCOMING_PLATFORMS } from '@/api/igdb';
import { toGameRecord } from '@/api/games';
import { GameCover } from '@/components/games';
import { Card, IgnScreen, useIgnColors, useProgressive } from '@/components/ign';
import { Chip } from '@/components/ui';
import { ThemedText } from '@/components/ThemedText';
import { STATUS_META } from '@/data/meta';
import { daysBetween, longDate, MONTHS_LONG, todayIso, useMyGames } from '@/hooks/useMyGames';
import { useStore } from '@/store/useStore';
import type { GameRecord, PlayStatus } from '@/types';
import { notify } from '@/utils/notify';
import { canAlert, useReleaseAlerts } from '@/utils/releaseAlerts';

function countdown(days: number): string {
  if (days === 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  if (days < 30) return `${days} días`;
  if (days < 365) return `${Math.round(days / 30)} meses`;
  return `${(days / 365).toFixed(1).replace('.0', '')} años`;
}

function ReleaseRow({
  game,
  date,
  status,
  alerted,
  onAlert,
}: {
  game: GameRecord;
  date: string;
  status?: PlayStatus;
  alerted: boolean;
  onAlert: () => void;
}) {
  const c = useIgnColors();
  const upsertGame = useStore((s) => s.upsertGame);
  const days = daysBetween(todayIso(), date);
  const soon = days <= 7;
  return (
    <Pressable
      onPress={() => {
        if (!useStore.getState().games[game.id]) upsertGame(game);
        router.push(`/game/${encodeURIComponent(game.id)}`);
      }}
      style={styles.row}
    >
      <GameCover game={game} width={64} plain />
      <View style={{ flex: 1, gap: 3 }}>
        <ThemedText variant="bold" size={15} numberOfLines={2}>
          {game.title}
        </ThemedText>
        <ThemedText variant="muted" size={12}>
          {`${longDate(date)} ${date.slice(0, 4)}${status ? ` · ${STATUS_META[status].label}` : ''}`}
        </ThemedText>
        {canAlert ? (
          <Pressable onPress={onAlert} hitSlop={8} style={styles.alert}>
            <Ionicons
              name={alerted ? 'notifications' : 'notifications-outline'}
              size={14}
              color={alerted ? c.accent : c.muted}
            />
            <ThemedText size={12} style={{ color: alerted ? c.accent : c.muted }}>
              {alerted ? 'Te avisaremos ese día' : 'Avisarme ese día'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <LinearGradient
        colors={soon ? ['#ff512f', '#dd2476'] : [c.soft, c.soft]}
        style={[styles.count, { borderRadius: c.radius }]}
      >
        <ThemedText variant="display" size={days < 100 ? 22 : 16} style={{ color: soon ? '#fff' : c.text }}>
          {days < 30 ? String(days) : countdown(days).split(' ')[0]}
        </ThemedText>
        <ThemedText size={10} style={{ color: soon ? '#ffffffdd' : c.muted }}>
          {days < 30 ? (days === 1 ? 'DÍA' : 'DÍAS') : countdown(days).split(' ')[1]?.toUpperCase()}
        </ThemedText>
      </LinearGradient>
    </Pressable>
  );
}

// Lanzamientos: cuenta atrás de los juegos que esperas y los más esperados del momento.
export default function ReleasesScreen() {
  const c = useIgnColors();
  const mine = useMyGames();
  const today = todayIso();
  const { alerts, toggle } = useReleaseAlerts();
  const upcoming = useUpcomingWide();
  const [platform, setPlatform] = useState<string>('all');

  const { waiting, out } = useMemo(() => {
    const dated = mine.filter((m) => m.game.releaseDate && m.ug.status !== 'beaten' && m.ug.status !== 'completed');
    return {
      waiting: dated
        .filter((m) => m.game.releaseDate! >= today)
        .sort((a, b) => a.game.releaseDate!.localeCompare(b.game.releaseDate!)),
      out: dated
        .filter((m) => m.game.releaseDate! < today && daysBetween(m.game.releaseDate!, today) <= 45)
        .sort((a, b) => b.game.releaseDate!.localeCompare(a.game.releaseDate!)),
    };
  }, [mine, today]);
  const mineIds = new Set(mine.map((m) => m.game.id));
  const plat = UPCOMING_PLATFORMS.find((p) => p.id === platform);
  const popular = useMemo(
    () =>
      upcoming.data
        .map((r) => toGameRecord(r, null))
        .filter((g) => g.releaseDate && g.releaseDate >= today && !mineIds.has(g.id))
        .filter((g) => !plat || plat.match.test(g.platforms))
        .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcoming.data, today, platform, mine],
  );
  const shown = useProgressive(popular.length, 20, 20);

  const onAlert = (g: GameRecord, date: string) =>
    toggle(g.id, g.title, date).then((on) => notify(on ? `Te avisaremos cuando salga ${g.title}` : 'Aviso quitado'));

  return (
    <IgnScreen title="Lanzamientos" back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      {out.length ? (
        <Card style={{ gap: 6 }}>
          <ThemedText variant="bold" size={13} style={styles.caps}>
            🎉 Ya han salido
          </ThemedText>
          {out.map((m) => (
            <Pressable
              key={m.game.id}
              onPress={() => router.push(`/game/${encodeURIComponent(m.game.id)}`)}
              style={styles.outRow}
            >
              <GameCover game={m.game} width={40} plain />
              <ThemedText size={14} style={{ flex: 1 }} numberOfLines={1}>
                {m.game.title}
              </ThemedText>
              <ThemedText variant="muted" size={12}>
                {`hace ${daysBetween(m.game.releaseDate!, today)} d`}
              </ThemedText>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <ThemedText variant="bold" size={13} style={styles.caps}>
        Los que esperas
      </ThemedText>
      {waiting.length ? (
        <Card padded={false}>
          {waiting.map((m, i) => (
            <View
              key={m.game.id}
              style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : null}
            >
              <ReleaseRow
                game={m.game}
                date={m.game.releaseDate!}
                status={m.ug.status}
                alerted={!!alerts[m.game.id]}
                onAlert={() => onAlert(m.game, m.game.releaseDate!)}
              />
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <ThemedText variant="muted" size={14}>
            Ninguno de tus juegos tiene fecha futura. Añade alguno de abajo a «Deseados» y verás la cuenta atrás.
          </ThemedText>
        </Card>
      )}

      <ThemedText variant="bold" size={13} style={styles.caps}>
        Calendario de lanzamientos
      </ThemedText>
      <View style={styles.chips}>
        <Chip label="Todas" selected={platform === 'all'} onPress={() => setPlatform('all')} />
        {UPCOMING_PLATFORMS.map((p) => (
          <Chip key={p.id} label={p.label} selected={platform === p.id} onPress={() => setPlatform(p.id)} />
        ))}
      </View>
      {upcoming.loading ? (
        <ActivityIndicator color={c.text} style={{ marginVertical: 30 }} />
      ) : popular.length ? (
        <Card padded={false}>
          {popular.slice(0, shown).map((g, i) => (
            <View key={g.id} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : null}>
              {i === 0 || popular[i - 1].releaseDate!.slice(0, 7) !== g.releaseDate!.slice(0, 7) ? (
                <ThemedText variant="bold" size={12} style={[styles.month, { backgroundColor: c.soft }]}>
                  {`${MONTHS_LONG[Number(g.releaseDate!.slice(5, 7)) - 1]} ${g.releaseDate!.slice(0, 4)}`.toUpperCase()}
                </ThemedText>
              ) : null}
              <ReleaseRow
                game={g}
                date={g.releaseDate!}
                alerted={!!alerts[g.id]}
                onAlert={() => onAlert(g, g.releaseDate!)}
              />
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <ThemedText variant="muted" size={14}>
            {upcoming.error
              ? 'No se pudieron cargar los próximos lanzamientos.'
              : 'No hay lanzamientos con ese filtro.'}
          </ThemedText>
        </Card>
      )}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  caps: { letterSpacing: 0.8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { paddingHorizontal: 12, paddingVertical: 6, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  count: { width: 68, height: 64, alignItems: 'center', justifyContent: 'center' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
});
