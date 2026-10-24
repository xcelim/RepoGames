import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useRemote } from '@/cloud/remote';
import {
  fetchProfile,
  fetchUserLibrary,
  fetchUserLists,
  removeFriend,
  useFriendState,
  useSocial,
} from '@/cloud/social';
import { FriendButton } from '@/components/FriendButton';
import { GameCover } from '@/components/games';
import { Card, EntryGrid, IgnScreen, ProgressBar, useIgnColors } from '@/components/ign';
import { Chip } from '@/components/ui';
import { LevelBadge } from '@/components/LevelBadge';
import { ListCard } from '@/components/lists';
import { OfflineGate } from '@/components/offline';
import { RankBadge } from '@/components/RankBadge';
import { ShowcaseView } from '@/components/showcases';
import { ThemedText } from '@/components/ThemedText';
import { UserAvatar } from '@/components/UserAvatar';
import { OFFICIAL_LISTS, OFFICIAL_PROFILE_ID } from '@/data/catalog';
import { FINISHED } from '@/data/meta';
import { useListCount, useProfileLookup } from '@/hooks/useLists';
import { useAchievementsOf } from '@/hooks/usePlatinums';
import { useStore } from '@/store/useStore';
import type { GameRecord, PlayStatus, UserGame } from '@/types';
import { compatibility } from '@/utils/compat';
import { levelColor, levelFromXp, showcaseSlots } from '@/utils/level';

function UserScreenInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const lookup = useProfileLookup();
  const profile = lookup(id);
  const uid = useStore((s) => s.cloudUserId);
  const myUserGames = useStore((s) => s.userGames);
  const localGames = useStore((s) => s.games);
  const socialGames = useSocial((s) => s.games);
  const lists = useStore((s) => s.lists);
  const remoteLists = useRemote((s) => s.lists);
  const countOf = useListCount();
  const friendState = useFriendState(id);
  const [library, setLibrary] = useState<UserGame[] | null>(null);
  const [version, setVersion] = useState(0); // deslizar hacia abajo vuelve a cargar

  useEffect(() => {
    if (id === OFFICIAL_PROFILE_ID) return;
    let alive = true;
    fetchProfile(id).catch(() => undefined);
    fetchUserLists(id).catch(() => undefined);
    fetchUserLibrary(id)
      .then((l) => alive && setLibrary(l))
      .catch(() => alive && setLibrary([]));
    return () => {
      alive = false;
    };
  }, [id, version]);

  const games = useMemo(() => ({ ...socialGames, ...localGames }), [socialGames, localGames]);
  const theirs = useMemo(() => library ?? [], [library]);
  const ach = useAchievementsOf(theirs, games);
  const mine = useMemo(() => Object.values(myUserGames).filter((u) => u.profileId === uid), [myUserGames, uid]);
  const compat = useMemo(
    () => (id !== uid && theirs.length && mine.length ? compatibility(mine, theirs) : null),
    [id, uid, theirs, mine],
  );

  const publicLists = useMemo(() => {
    if (id === OFFICIAL_PROFILE_ID) return OFFICIAL_LISTS;
    return [...Object.values(lists), ...Object.values(remoteLists)].filter(
      (l) => l.ownerId === id && l.visibility === 'public',
    );
  }, [id, lists, remoteLists]);

  if (!profile) {
    return (
      <IgnScreen title="Perfil" back>
        <ActivityIndicator color={c.text} style={{ marginTop: 40 }} />
      </IgnScreen>
    );
  }

  const finished = theirs.filter((g) => FINISHED.includes(g.status)).length;
  const level = profile.level ?? 0;
  const slots = showcaseSlots(level);
  const lv = levelFromXp(profile.xp ?? 0);
  const progress = profile.xp != null ? (lv.into / lv.need) * 100 : 0;
  const gameOf = (gid: string): GameRecord | undefined => games[gid];
  const cover = (width - 40 - 36 - 30) / 4;

  return (
    <IgnScreen
      title={profile.displayName}
      back
      onRefresh={() => setVersion((v) => v + 1)}
      contentStyle={{ paddingHorizontal: 20, gap: 16 }}
    >
      <View style={styles.head}>
        <UserAvatar profile={profile} size={84} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="display" size={24} numberOfLines={1}>
            {profile.displayName}
          </ThemedText>
          <ThemedText variant="muted">@{profile.username}</ThemedText>
          {profile.level != null ? (
            <View style={styles.levelRow}>
              <LevelBadge level={level} size={26} />
              <View style={{ flex: 1 }}>
                <ThemedText variant="bold" size={12}>
                  Nivel {level}
                </ThemedText>
                <ProgressBar pct={progress} height={3} color={levelColor(level)} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
      {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}

      {id !== uid && id !== OFFICIAL_PROFILE_ID ? (
        <View style={styles.actions}>
          <FriendButton id={id} />
          {friendState === 'friends' ? (
            <>
              <Pressable
                onPress={() => router.push(`/chat/${id}`)}
                style={[styles.action, { backgroundColor: c.inverseBg }]}
              >
                <Ionicons name="chatbubble" size={16} color={c.inverseText} />
                <ThemedText variant="bold" size={12} style={{ color: c.inverseText }}>
                  Mensaje
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => removeFriend(id).catch(() => undefined)} hitSlop={8}>
                <ThemedText variant="muted" size={12} style={{ textDecorationLine: 'underline' }}>
                  Quitar amigo
                </ThemedText>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {profile.ranks?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {profile.ranks.map((r) => (
            <RankBadge key={r.game} rank={r} size={46} />
          ))}
        </ScrollView>
      ) : null}

      <Card style={styles.stats} padded={false}>
        <Stat value={library ? String(theirs.length) : '…'} label="JUEGOS" />
        <Stat value={library ? String(finished) : '…'} label="TERMINADOS" />
        <Stat value={ach.loading ? '…' : String(ach.platinums.length)} label="PLATINOS" />
        <Stat value={String(publicLists.length)} label="LISTAS" />
      </Card>

      {compat ? (
        <Card style={{ gap: 12 }}>
          <View style={styles.compatHead}>
            <ThemedText variant="display" size={30} style={{ color: compatColor(compat.score) }}>
              {compat.score} %
            </ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText variant="bold" size={15}>
                {compatLabel(compat.score)}
              </ThemedText>
              <ThemedText variant="muted" size={12}>
                {compat.shared.length} juegos en común
                {compat.bothLoved.length ? ` · ${compat.bothLoved.length} os encantan a los dos` : ''}
              </ThemedText>
            </View>
          </View>
          <ProgressBar pct={compat.score} height={6} color={compatColor(compat.score)} />
          {compat.forYou.length ? (
            <>
              <ThemedText variant="bold" size={13}>
                Le encantan y tú no los tienes
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {compat.forYou.map((gid) => {
                  const g = gameOf(gid);
                  return g ? (
                    <Pressable key={gid} onPress={() => router.push(`/game/${encodeURIComponent(gid)}`)}>
                      <GameCover game={g} width={cover} plain />
                    </Pressable>
                  ) : null;
                })}
              </ScrollView>
            </>
          ) : null}
          {compat.clash.length ? (
            <ThemedText variant="muted" size={12}>
              Donde más chocáis:{' '}
              {compat.clash.map((x) => `${gameOf(x.gameId)?.title ?? '?'} (tú ${x.mine}, él ${x.theirs})`).join(' · ')}
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {library === null && id !== OFFICIAL_PROFILE_ID ? <ActivityIndicator color={c.text} /> : null}
      {library
        ? (profile.showcases ?? [])
            .slice(0, slots)
            .map((sc, i) => (
              <ShowcaseView
                key={`${sc.type}-${i}`}
                showcase={sc}
                profile={profile}
                data={{ userGames: theirs, games, platinums: ach.platinums, earned: ach.earned }}
              />
            ))
        : null}

      {library && library.length ? <TheirLibrary library={theirs} games={games} width={width} /> : null}

      <ThemedText variant="display" size={20} style={{ marginTop: 6 }}>
        Listas públicas
      </ThemedText>
      {publicLists.length === 0 ? (
        <ThemedText variant="muted" size={13}>
          No tiene listas públicas.
        </ThemedText>
      ) : (
        <View style={styles.grid}>
          {publicLists.map((list) => (
            <View key={list.id} style={styles.half}>
              <ListCard list={list} count={countOf(list.id)} />
            </View>
          ))}
        </View>
      )}
    </IgnScreen>
  );
}

const LIB_FILTERS: { id: string; label: string; statuses: PlayStatus[] | null }[] = [
  { id: 'all', label: 'Todos', statuses: null },
  { id: 'playing', label: 'Jugando', statuses: ['playing'] },
  { id: 'finished', label: 'Terminados', statuses: ['beaten', 'completed'] },
  { id: 'pending', label: 'Pendientes', statuses: ['backlog', 'paused', 'library'] },
  { id: 'wishlist', label: 'Deseados', statuses: ['wishlist'] },
  { id: 'dropped', label: 'Abandonados', statuses: ['dropped'] },
];

// Los juegos de otra persona, con su estado y su nota.
function TheirLibrary({
  library,
  games,
  width,
}: {
  library: UserGame[];
  games: Record<string, GameRecord>;
  width: number;
}) {
  const [filter, setFilter] = useState('all');
  const f = LIB_FILTERS.find((x) => x.id === filter)!;
  const entries = useMemo(
    () =>
      library
        .filter((u) => games[u.gameId] && (!f.statuses || f.statuses.includes(u.status)))
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .map((u, i) => ({
          game: games[u.gameId],
          status: u.status,
          rank: i + 1,
          physical: u.owned,
          subtitle: u.rating ? `★ ${u.rating}/10` : undefined,
        })),
    [library, games, f],
  );
  const count = (st: PlayStatus[] | null) => library.filter((u) => !st || st.includes(u.status)).length;
  return (
    <View style={{ gap: 12, marginHorizontal: -20 }}>
      <ThemedText variant="display" size={20} style={{ marginTop: 6, paddingHorizontal: 20 }}>
        Biblioteca
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libChips}>
        {LIB_FILTERS.map((x) => (
          <Chip
            key={x.id}
            label={`${x.label} (${count(x.statuses)})`}
            selected={filter === x.id}
            onPress={() => setFilter(x.id)}
          />
        ))}
      </ScrollView>
      {entries.length ? (
        <EntryGrid
          entries={entries}
          width={width}
          showRank={false}
          onPress={(g) => router.push(`/game/${encodeURIComponent(g.id)}`)}
        />
      ) : (
        <ThemedText variant="muted" size={13} style={{ paddingHorizontal: 20 }}>
          Nada por aquí.
        </ThemedText>
      )}
    </View>
  );
}

const compatColor = (s: number) => (s >= 75 ? '#2fd18b' : s >= 50 ? '#f2c94c' : s >= 25 ? '#f2994a' : '#e5484d');
const compatLabel = (s: number) =>
  s >= 85
    ? 'Almas gemelas gamer'
    : s >= 65
      ? 'Gustos muy parecidos'
      : s >= 45
        ? 'Bastante compatibles'
        : s >= 25
          ? 'Algo en común'
          : 'Mundos distintos';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="bold" size={18}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={9} style={{ letterSpacing: 0.8 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  libChips: { gap: 8, paddingHorizontal: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  compatHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { width: '47.5%' },
});

export default function UserScreen() {
  return (
    <OfflineGate what="El perfil de otros jugadores">
      <UserScreenInner />
    </OfflineGate>
  );
}
