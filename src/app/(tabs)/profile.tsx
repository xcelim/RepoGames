import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Card, CoverTile, Donut, HeaderIcon, IgnScreen, StatusIcon } from '@/components/ign';
import { OfflineDownloadCard } from '@/components/cloudPanel';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, MenuRow } from '@/components/ui';
import { FINISHED, scoreColor, STATUS_META, STATUS_ORDER } from '@/data/meta';
import { useMyLists } from '@/hooks/useLists';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';
import { findGame, formatHours } from '@/utils/library';

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const skin = useSkin();
  return (
    <View style={styles.barRow}>
      <ThemedText size={12} style={styles.barLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: skin.colors.panel2 }]}>
        <View
          style={[styles.fill, { width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }]}
        />
      </View>
      <ThemedText variant="bold" size={12} style={styles.barValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const skin = useSkin();
  const { width } = useWindowDimensions();
  const profile = useCurrentProfile();
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const mode = useStore((s) => s.durationMode);
  const myLists = useMyLists();

  const data = useMemo(() => {
    const mine = Object.values(userGames).filter((g) => g.profileId === profile?.id);
    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const ratings = Array<number>(10).fill(0);
    let ratingSum = 0;
    let rated = 0;
    let hoursPlayed = 0;
    let hoursLeft = 0;
    for (const ug of mine) {
      byStatus[ug.status] = (byStatus[ug.status] ?? 0) + 1;
      if (ug.platform) byPlatform[ug.platform] = (byPlatform[ug.platform] ?? 0) + 1;
      if (ug.rating) {
        ratings[ug.rating - 1] += 1;
        ratingSum += ug.rating;
        rated += 1;
      }
      hoursPlayed += ug.hoursPlayed ?? 0;
      if (['backlog', 'playing', 'paused'].includes(ug.status)) {
        hoursLeft += findGame(games, ug.gameId)?.[mode] ?? 0;
      }
    }
    const topRated = mine
      .filter((ug) => ug.rating)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3)
      .map((ug) => ({ ug, game: findGame(games, ug.gameId) }));
    return {
      total: mine.length,
      finished: mine.filter((g) => FINISHED.includes(g.status)).length,
      byStatus,
      platforms: Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).slice(0, 6),
      ratings,
      average: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
      hoursPlayed,
      hoursLeft,
      topRated,
    };
  }, [userGames, games, profile?.id, mode]);

  if (!profile) return null;
  const maxRating = Math.max(1, ...data.ratings);
  const maxPlatform = Math.max(1, ...data.platforms.map((p) => p[1]));
  const publicLists = myLists.filter((l) => l.visibility === 'public').length;

  const donutStatuses = STATUS_ORDER.filter((st) => (data.byStatus[st] ?? 0) > 0);

  return (
    <IgnScreen
      title="Perfil"
      right={
        <>
          <HeaderIcon icon="people-outline" label="Cuentas" onPress={() => router.push('/accounts')} />
          <HeaderIcon icon="settings-outline" label="Ajustes" onPress={() => router.push('/settings')} />
        </>
      }
    >
      <View style={styles.content}>
        <Pressable style={styles.head} onPress={() => router.push('/profile-edit')}>
          <Avatar name={profile.displayName} color={profile.avatarColor} size={72} />
          <View style={styles.flex}>
            <ThemedText variant="display" size={24} numberOfLines={1}>
              {profile.displayName}
            </ThemedText>
            <ThemedText variant="muted">@{profile.username}</ThemedText>
            <ThemedText variant="muted" size={12}>
              {myLists.length} listas · {publicLists} públicas
            </ThemedText>
          </View>
          <Ionicons name="create-outline" size={20} color={skin.colors.muted} />
        </Pressable>
        {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}

        <OfflineDownloadCard />

        <Card style={styles.statsCard} padded={false}>
          <Stat value={String(data.total)} label="JUEGOS" />
          <Stat value={String(data.finished)} label="TERMINADOS" />
          <Stat value={data.average !== null ? String(data.average) : '–'} label="NOTA MEDIA" />
        </Card>
        <Card style={styles.statsCard} padded={false}>
          <Stat value={formatHours(data.hoursPlayed)} label="HORAS JUGADAS" />
          <Stat value={formatHours(data.hoursLeft)} label="TE QUEDAN" />
        </Card>

        <Card>
          <ThemedText variant="display" size={19}>
            {data.total} en tu biblioteca
          </ThemedText>
          <View style={styles.donut}>
            <Donut parts={donutStatuses.map((st) => ({ value: data.byStatus[st] ?? 0, color: STATUS_META[st].color }))} size={130} stroke={18} />
          </View>
          <View style={styles.legend}>
            {STATUS_ORDER.filter((st) => st !== 'library' || data.byStatus.library).map((st) => (
              <Pressable key={st} style={styles.legendItem} onPress={() => router.push(`/library/${st === 'completed' ? 'beaten' : st}`)}>
                <StatusIcon status={st} size={22} />
                <ThemedText variant="bold" size={14}>
                  {data.byStatus[st] ?? 0}
                </ThemedText>
                <ThemedText variant="muted" size={10} numberOfLines={1} style={{ flex: 1, letterSpacing: 0.6 }}>
                  {STATUS_META[st].short.toUpperCase()}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>

        {data.topRated.length > 0 ? (
          <Card>
            <ThemedText variant="display" size={19} style={{ marginBottom: 12 }}>
              Tus mejor valorados
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {data.topRated.map(({ ug, game }, index) =>
                game ? (
                  <CoverTile
                    key={ug.id}
                    game={game}
                    width={(width - 40 - 36 - 24) / 3}
                    rank={index + 1}
                    subtitle={`${ug.rating}/10`}
                    onPress={() => router.push(`/game/${encodeURIComponent(game.id)}`)}
                  />
                ) : null,
              )}
            </View>
          </Card>
        ) : null}

        <Card>
          <ThemedText variant="display" size={19} style={{ marginBottom: 12 }}>
            Tus notas
          </ThemedText>
          <View style={styles.histogram}>
            {data.ratings.map((count, index) => (
              <View key={index} style={styles.histoCol}>
                <View style={styles.histoBarArea}>
                  <View
                    style={[
                      styles.histoBar,
                      { height: `${(count / maxRating) * 100}%`, backgroundColor: scoreColor(index + 1), borderRadius: 3 },
                    ]}
                  />
                </View>
                <ThemedText variant="muted" size={11}>
                  {index + 1}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        {data.platforms.length > 0 ? (
          <Card style={{ gap: 8 }}>
            <ThemedText variant="display" size={19} style={{ marginBottom: 4 }}>
              Plataformas
            </ThemedText>
            {data.platforms.map(([name, count]) => (
              <Bar key={name} label={name} value={count} max={maxPlatform} color={skin.colors.accent} />
            ))}
          </Card>
        ) : null}

        <Card>
          <MenuRow icon="create-outline" label="Editar perfil" onPress={() => router.push('/profile-edit')} />
          <MenuRow icon="people-outline" label="Cuenta y sincronización" onPress={() => router.push('/accounts')} />
          <MenuRow icon="settings-outline" label="Ajustes y estética" onPress={() => router.push('/settings')} />
          <MenuRow icon="eye-outline" label="Ver mi perfil público" onPress={() => router.push(`/user/${profile.id}`)} />
        </Card>
      </View>
    </IgnScreen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="bold" size={20}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={10} style={{ letterSpacing: 0.8 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  statsCard: { flexDirection: 'row', paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  donut: { alignItems: 'center', marginVertical: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 84 },
  barValue: { width: 26, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
  histogram: { flexDirection: 'row', gap: 4, height: 110 },
  histoCol: { flex: 1, alignItems: 'center', gap: 4 },
  histoBarArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  histoBar: { width: '100%', minHeight: 2 },
});
