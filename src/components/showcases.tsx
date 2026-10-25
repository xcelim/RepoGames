// Las vitrinas del perfil (como en Steam).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAchievementData, type Earned, type Platinum } from '@/hooks/usePlatinums';
import { useStore } from '@/store/useStore';
import type { GameRecord, Profile, Showcase, UserGame } from '@/types';
import { formatHours, replayTotals } from '@/utils/library';
import { SHOWCASES } from '@/utils/level';

import { AchievementIcon } from './AchievementIcon';
import { GameCover } from './games';
import { Card, useIgnColors } from './ign';
import { ReplayBadge } from './replayBadge';
import { Shine } from './Shine';
import { ThemedText } from './ThemedText';
import { HScroll } from './HScroll';

const open = (g: GameRecord) => router.push(`/game/${encodeURIComponent(g.id)}`);

function Frame({ type, children, empty }: { type: Showcase['type']; children: ReactNode; empty?: string | null }) {
  const c = useIgnColors();
  const meta = SHOWCASES[type];
  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.head}>
        <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={18} color={c.accent} />
        <ThemedText variant="display" size={17} style={{ flex: 1 }}>
          {meta.name}
        </ThemedText>
      </View>
      {empty ? (
        <ThemedText variant="muted" size={13}>
          {empty}
        </ThemedText>
      ) : (
        children
      )}
    </Card>
  );
}

function CoverRow({ games, render }: { games: GameRecord[]; render?: (g: GameRecord, w: number) => ReactNode }) {
  const { width } = useWindowDimensions();
  const w = Math.min(110, (width - 40 - 36 - 24) / 3);
  return (
    <HScroll contentContainerStyle={{ gap: 12 }}>
      {games.map((g) => (
        <Pressable key={g.id} onPress={() => open(g)} style={{ width: w }}>
          {render ? render(g, w) : <GameCover game={g} width={w} plain />}
        </Pressable>
      ))}
    </HScroll>
  );
}

// Datos de otro usuario (su perfil público); sin ellos se usan los tuyos.
export type ShowcaseData = {
  userGames: UserGame[];
  games: Record<string, GameRecord>;
  platinums: Platinum[];
  earned: Earned[];
};

export function ShowcaseView({
  showcase,
  profile,
  data,
}: {
  showcase: Showcase;
  profile: Profile;
  data?: ShowcaseData;
}) {
  const localGames = useStore((s) => s.games);
  const localUserGames = useStore((s) => s.userGames);
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const own = useAchievementData();
  const games = data?.games ?? localGames;
  const platinums = data?.platinums ?? own.platinums;
  const earned = data?.earned ?? own.earned;
  const userGames = useMemo(
    () => (data ? Object.fromEntries(data.userGames.map((u) => [u.id, u])) : localUserGames),
    [data, localUserGames],
  );
  const mine = useMemo(
    () => (data ? data.userGames : Object.values(localUserGames).filter((u) => u.profileId === profile.id)),
    [data, localUserGames, profile.id],
  );

  switch (showcase.type) {
    case 'favorites': {
      const favs = (showcase.gameIds ?? []).map((id) => games[id]).filter((g): g is GameRecord => !!g);
      return (
        <Frame type="favorites" empty={favs.length ? null : 'Toca «Editar vitrinas» para elegir tus juegos favoritos.'}>
          <CoverRow games={favs} />
        </Frame>
      );
    }
    case 'completionist':
      return (
        <Frame type="completionist" empty={platinums.length ? null : 'Aún no tienes platinos.'}>
          <CoverRow
            games={platinums.slice(0, 8).map((p) => p.game)}
            render={(g, w) => (
              <Shine width={w - 6} height={(w - 6) * (4 / 3)} radius={6} border={3} badge={22}>
                <GameCover game={g} width={w - 6} radius={0} plain />
              </Shine>
            )}
          />
        </Frame>
      );
    case 'rare': {
      const rare = [...earned]
        .filter((e) => e.achievement.percent != null)
        .sort((a, b) => a.achievement.percent! - b.achievement.percent!)
        .slice(0, 6);
      return (
        <Frame type="rare" empty={rare.length ? null : 'Marca logros en tus juegos para presumir de los más raros.'}>
          <HScroll contentContainerStyle={{ gap: 14 }}>
            {rare.map((e) => (
              <Pressable
                key={`${e.game.id}-${e.achievement.id}`}
                onPress={() => open(e.game)}
                style={{ width: 84, alignItems: 'center', gap: 6 }}
              >
                <AchievementIcon a={e.achievement} size={68} />
                <ThemedText variant="bold" size={11} numberOfLines={2} style={{ textAlign: 'center' }}>
                  {e.achievement.name}
                </ThemedText>
                <ThemedText variant="muted" size={10} numberOfLines={1}>
                  {e.achievement.percent!.toFixed(1).replace('.', ',')} %
                </ThemedText>
              </Pressable>
            ))}
          </HScroll>
        </Frame>
      );
    }
    case 'recent': {
      const recent = mine
        .filter((u) => u.status === 'beaten' || u.status === 'completed')
        .sort((a, b) => (b.finishedAt ?? b.updatedAt).localeCompare(a.finishedAt ?? a.updatedAt))
        .map((u) => games[u.gameId])
        .filter((g): g is GameRecord => !!g)
        .slice(0, 8);
      return (
        <Frame type="recent" empty={recent.length ? null : 'Aún no has terminado ningún juego.'}>
          <CoverRow games={recent} />
        </Frame>
      );
    }
    case 'replays': {
      const totals = replayTotals({ lists, items, userGames }, profile.id);
      const top = mine
        .map((u) => ({ g: games[u.gameId], n: totals.get(u.gameId) ?? 0 }))
        .filter((x): x is { g: GameRecord; n: number } => !!x.g && x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 8);
      const count = new Map(top.map((t) => [t.g.id, t.n]));
      return (
        <Frame type="replays" empty={top.length ? null : 'Apunta tus rejugadas en las listas para verlas aquí.'}>
          <CoverRow
            games={top.map((t) => t.g)}
            render={(g, w) => (
              <View>
                <GameCover game={g} width={w} plain />
                <View style={styles.replay}>
                  <ReplayBadge count={count.get(g.id) ?? 0} size={30} />
                </View>
              </View>
            )}
          />
        </Frame>
      );
    }
    case 'stats': {
      const finished = mine.filter((u) => u.status === 'beaten' || u.status === 'completed').length;
      const hours = mine.reduce((a, u) => a + (u.hoursPlayed ?? 0), 0);
      return (
        <Frame type="stats">
          <View style={styles.stats}>
            <Big value={String(finished)} label="TERMINADOS" />
            <Big value={String(platinums.length)} label="PLATINOS" />
            <Big value={String(earned.length)} label="LOGROS" />
            <Big value={hours ? formatHours(hours) : '–'} label="HORAS APUNTADAS" />
          </View>
        </Frame>
      );
    }
  }
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.big}>
      <ThemedText variant="display" size={24}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={9} style={{ letterSpacing: 0.8 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replay: { position: 'absolute', top: 4, right: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  big: { width: '50%', alignItems: 'center', gap: 2 },
});
