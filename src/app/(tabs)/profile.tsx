import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionTitle } from '@/components/lists';
import { ThemedText } from '@/components/ThemedText';
import { Avatar, MenuRow, Panel, StatTile } from '@/components/ui';
import { FINISHED, STATUS_META, STATUS_ORDER } from '@/data/meta';
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
  const insets = useSafeAreaInsets();
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
  const maxStatus = Math.max(1, ...Object.values(data.byStatus));
  const maxRating = Math.max(1, ...data.ratings);
  const maxPlatform = Math.max(1, ...data.platforms.map((p) => p[1]));
  const publicLists = myLists.filter((l) => l.visibility === 'public').length;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <View style={styles.head}>
        <Avatar name={profile.displayName} color={profile.avatarColor} size={72} />
        <View style={styles.flex}>
          <ThemedText variant="display" size={26} numberOfLines={1}>
            {profile.displayName}
          </ThemedText>
          <ThemedText variant="muted">@{profile.username}</ThemedText>
          <ThemedText variant="muted" size={12}>
            {myLists.length} listas · {publicLists} públicas
          </ThemedText>
        </View>
      </View>
      {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}

      <View style={styles.tiles}>
        <StatTile value={String(data.total)} label="Juegos" />
        <StatTile value={String(data.finished)} label="Terminados" />
        <StatTile value={data.average !== null ? String(data.average) : '–'} label="Nota media" />
      </View>
      <View style={styles.tiles}>
        <StatTile value={formatHours(data.hoursPlayed)} label="Horas apuntadas" />
        <StatTile value={formatHours(data.hoursLeft)} label="Te quedan (aprox.)" />
      </View>

      {data.topRated.length > 0 ? (
        <Panel>
          <ThemedText variant="bold">Tus favoritos</ThemedText>
          {data.topRated.map(({ ug, game }, index) => (
            <ThemedText key={ug.id}>
              {index + 1}. {game?.title ?? '¿?'} —{' '}
              <ThemedText variant="bold" style={{ color: skin.colors.accent }}>
                {ug.rating}/10
              </ThemedText>
            </ThemedText>
          ))}
        </Panel>
      ) : null}

      <Panel>
        <ThemedText variant="bold">Por estado</ThemedText>
        {STATUS_ORDER.map((s) => (
          <Bar
            key={s}
            label={STATUS_META[s].short}
            value={data.byStatus[s] ?? 0}
            max={maxStatus}
            color={STATUS_META[s].color}
          />
        ))}
      </Panel>

      <Panel>
        <ThemedText variant="bold">Tus notas</ThemedText>
        <View style={styles.histogram}>
          {data.ratings.map((count, index) => (
            <View key={index} style={styles.histoCol}>
              <View style={styles.histoBarArea}>
                <View
                  style={[
                    styles.histoBar,
                    {
                      height: `${(count / maxRating) * 100}%`,
                      backgroundColor: skin.colors.accent,
                      borderRadius: Math.min(skin.radius, 4),
                    },
                  ]}
                />
              </View>
              <ThemedText variant="muted" size={11}>
                {index + 1}
              </ThemedText>
            </View>
          ))}
        </View>
      </Panel>

      {data.platforms.length > 0 ? (
        <Panel>
          <ThemedText variant="bold">Plataformas</ThemedText>
          {data.platforms.map(([name, count]) => (
            <Bar key={name} label={name} value={count} max={maxPlatform} color={skin.colors.accent2} />
          ))}
        </Panel>
      ) : null}

      <SectionTitle title="Cuenta" />
      <Panel>
        <MenuRow icon="create-outline" label="Editar perfil" onPress={() => router.push('/profile-edit')} />
        <MenuRow icon="people-outline" label="Cuentas" onPress={() => router.push('/accounts')} />
        <MenuRow icon="settings-outline" label="Ajustes" onPress={() => router.push('/settings')} />
        <MenuRow
          icon="eye-outline"
          label="Ver mi perfil público"
          onPress={() => router.push(`/user/${profile.id}`)}
        />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
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
