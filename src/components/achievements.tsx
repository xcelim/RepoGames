import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { fetchFriendsOnGame, type PersonProgress } from '@/cloud/challenges';
import { useSocial } from '@/cloud/social';
import { fetchAchievements, type Achievement, type AchievementSet } from '@/api/achievements';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';
import { userGameKey } from '@/utils/library';

import { celebrate } from './Celebration';
import { Card, ProgressBar, useIgnColors } from './ign';
import { Avatar } from './ui';
import { ThemedText } from './ThemedText';

// Insignia propia: el "platino" de Saga Quest (no es el de ninguna consola).
export function PlatinumBadge({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="pt" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f4f7fb" />
          <Stop offset="0.45" stopColor="#b9c6d8" />
          <Stop offset="1" stopColor="#7d8ea8" />
        </LinearGradient>
        <LinearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7fd6ff" />
          <Stop offset="1" stopColor="#7b2ff7" />
        </LinearGradient>
      </Defs>
      {/* Escudo hexagonal */}
      <Path d="M24 2 L43 13 V35 L24 46 L5 35 V13 Z" fill="url(#pt)" stroke="#5f6f88" strokeWidth={1.5} />
      <Path d="M24 7 L38.5 15.5 V32.5 L24 41 L9.5 32.5 V15.5 Z" fill="url(#pc)" opacity={0.9} />
      {/* Estrella de 4 puntas */}
      <Path d="M24 12 L27 21 L36 24 L27 27 L24 36 L21 27 L12 24 L21 21 Z" fill="#fff" />
    </Svg>
  );
}

function pctText(p: number | null) {
  if (p == null) return null;
  return `${p < 10 ? p.toFixed(1).replace('.', ',') : Math.round(p)} % de jugadores`;
}

export function AchievementsCard({ game, expanded }: { game: GameRecord; expanded?: boolean }) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const ug = useStore((s) => (profileId ? s.userGames[userGameKey(profileId, game.id)] : undefined));
  const updateUserGame = useStore((s) => s.updateUserGame);
  const setStatus = useStore((s) => s.setStatus);
  const [state, setState] = useState<{ id: string; set: AchievementSet | null; error: string | null }>({
    id: game.id,
    set: null,
    error: null,
  });
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(!!expanded);
  const [showAll, setShowAll] = useState(!!expanded);
  // Amigos que tienen este juego y sus logros marcados.
  const [friends, setFriends] = useState<PersonProgress[]>([]);
  const socialProfiles = useSocial((s) => s.profiles);
  useEffect(() => {
    let alive = true;
    fetchFriendsOnGame(game.id)
      .then((f) => alive && setFriends(f.filter((x) => (x.ug?.achievements?.length ?? 0) > 0)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [game.id]);

  useEffect(() => {
    let alive = true;
    fetchAchievements(game)
      .then((set) => {
        if (!alive) return;
        setState({ id: game.id, set, error: null });
        if (set.list.length) useStore.getState().setAchievementsTotal(game.id, set.list.length);
      })
      .catch(
        (e: unknown) =>
          alive &&
          setState({ id: game.id, set: { source: 'rawg', list: [] }, error: e instanceof Error ? e.message : 'Error' }),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const set = state.id === game.id ? state.set : null;
  const list: Achievement[] | null = set ? set.list : null;
  const hiddenCount = list ? list.filter((a) => a.hidden).length : 0;
  const done = useMemo(() => new Set(ug?.achievements ?? []), [ug?.achievements]);
  if (list && list.length === 0) return null; // sin logros (p. ej. juegos de Nintendo)

  const total = list?.length ?? 0;
  const got = list ? list.filter((a) => done.has(a.id)).length : 0;
  const complete = total > 0 && got === total;

  const save = (ids: string[]) => {
    const wasComplete = complete;
    updateUserGame(game.id, { achievements: ids });
    const nowComplete = list ? list.every((a) => ids.includes(a.id)) : false;
    if (!wasComplete && nowComplete) {
      const status = useStore.getState().userGames[userGameKey(profileId!, game.id)]?.status;
      celebrate({
        kind: 'platinum',
        title: game.title,
        onDone:
          status !== 'completed'
            ? () =>
                Alert.alert('Platino Saga Quest', `¿Marcas ${game.title} como «Al 100 %»?`, [
                  { text: 'Ahora no', style: 'cancel' },
                  { text: 'Marcar al 100 %', onPress: () => setStatus(game.id, 'completed') },
                ])
            : undefined,
      });
    }
  };

  const toggle = (id: string) => {
    const ids = new Set(done);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    save([...ids]);
  };

  const shown = list ? (showAll ? list : list.slice(0, 25)) : [];

  return (
    <Card style={{ gap: 12 }}>
      <Pressable onPress={() => list && setOpen((o) => !o)} style={styles.head} accessibilityRole="button">
        {complete ? <PlatinumBadge size={40} /> : <Ionicons name="trophy-outline" size={30} color={c.text} />}
        <View style={{ flex: 1, gap: 6 }}>
          <ThemedText variant="display" size={19}>
            {complete ? 'Platino Saga Quest' : 'Logros'}
          </ThemedText>
          {list ? (
            <View style={styles.progressRow}>
              <View style={{ flex: 1 }}>
                <ProgressBar
                  pct={total ? (got / total) * 100 : 0}
                  height={5}
                  color={complete ? '#b9c6d8' : undefined}
                />
              </View>
              <ThemedText variant="muted" size={12}>
                {got}/{total}
              </ThemedText>
            </View>
          ) : (
            <ThemedText variant="muted" size={12}>
              Buscando logros…
            </ThemedText>
          )}
        </View>
        {list ? (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.muted} />
        ) : (
          <ActivityIndicator color={c.muted} />
        )}
      </Pressable>

      {list && friends.length ? (
        <View style={styles.friendsBox}>
          {friends.map((f) => {
            const p = socialProfiles[f.profileId];
            const n = list.filter((a) => f.ug?.achievements?.includes(a.id)).length;
            if (!p) return null;
            return (
              <Pressable key={f.profileId} onPress={() => router.push(`/user/${f.profileId}`)} style={styles.friendRow}>
                <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={26} />
                <ThemedText size={12} style={{ flex: 1 }} numberOfLines={1}>
                  {p.displayName}
                </ThemedText>
                <View style={{ width: 70 }}>
                  <ProgressBar
                    pct={total ? (n / total) * 100 : 0}
                    height={4}
                    color={n === total ? '#b9c6d8' : undefined}
                  />
                </View>
                <ThemedText variant="muted" size={11}>
                  {n}/{total}
                </ThemedText>
                {n === total && total ? <PlatinumBadge size={16} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {open && list ? (
        <View style={{ gap: 2 }}>
          <ThemedText variant="muted" size={11}>
            {set?.source === 'steam'
              ? `Logros de Steam${hiddenCount ? `, incluidos ${hiddenCount} ocultos (toca el ojo para verlos)` : ''}. Márcalos según los vayas consiguiendo.`
              : 'Logros según RAWG (sin los ocultos). Márcalos según los vayas consiguiendo.'}
          </ThemedText>
          {shown.map((a) => {
            const has = done.has(a.id);
            const secret = a.hidden && !has && !revealed.has(a.id);
            return (
              <Pressable key={a.id} onPress={() => toggle(a.id)} style={[styles.row, { borderBottomColor: c.line }]}>
                {a.image ? (
                  <Image
                    source={{ uri: a.image }}
                    style={[styles.icon, { opacity: has ? 1 : 0.45 }]}
                    contentFit="cover"
                    blurRadius={secret ? 12 : 0}
                  />
                ) : (
                  <View style={[styles.icon, { backgroundColor: c.soft }]} />
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText variant="bold" size={14} style={{ opacity: has ? 1 : 0.8 }}>
                    {secret ? 'Logro oculto' : a.name}
                  </ThemedText>
                  {secret ? (
                    <ThemedText variant="muted" size={12}>
                      Puede destripar la historia
                    </ThemedText>
                  ) : a.description ? (
                    <ThemedText variant="muted" size={12} numberOfLines={2}>
                      {a.description}
                    </ThemedText>
                  ) : null}
                  {pctText(a.percent) ? (
                    <ThemedText variant="muted" size={10}>
                      {pctText(a.percent)}
                    </ThemedText>
                  ) : null}
                  {friends.some((f) => f.ug?.achievements?.includes(a.id)) ? (
                    <View style={styles.whoHas}>
                      {friends
                        .filter((f) => f.ug?.achievements?.includes(a.id))
                        .slice(0, 6)
                        .map((f, i) => {
                          const p = socialProfiles[f.profileId];
                          return p ? (
                            <View key={f.profileId} style={{ marginLeft: i ? -6 : 0 }}>
                              <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={18} />
                            </View>
                          ) : null;
                        })}
                      <ThemedText variant="muted" size={10} style={{ marginLeft: 4 }}>
                        también lo{' '}
                        {friends.filter((f) => f.ug?.achievements?.includes(a.id)).length === 1 ? 'tiene' : 'tienen'}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                {secret ? (
                  <Pressable
                    onPress={() => setRevealed((r) => new Set(r).add(a.id))}
                    hitSlop={8}
                    accessibilityLabel="Ver logro oculto"
                  >
                    <Ionicons name="eye-outline" size={22} color={c.muted} />
                  </Pressable>
                ) : null}
                <Ionicons
                  name={has ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={has ? '#6aa834' : c.muted}
                />
              </Pressable>
            );
          })}
          {list.length > shown.length ? (
            <Pressable onPress={() => setShowAll(true)} style={styles.more}>
              <ThemedText variant="bold" size={13} style={{ textDecorationLine: 'underline' }}>
                Ver los {list.length} logros
              </ThemedText>
            </Pressable>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={() => save(list.map((a) => a.id))} hitSlop={6}>
              <ThemedText variant="bold" size={12} style={{ textDecorationLine: 'underline' }}>
                Marcar todos
              </ThemedText>
            </Pressable>
            {got ? (
              <Pressable
                onPress={() =>
                  Alert.alert('Desmarcar logros', '¿Quitar todos los logros marcados de este juego?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Desmarcar', style: 'destructive', onPress: () => save([]) },
                  ])
                }
                hitSlop={6}
              >
                <ThemedText variant="muted" size={12} style={{ textDecorationLine: 'underline' }}>
                  Desmarcar todos
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  friendsBox: { gap: 8 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoHas: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 44, height: 44, borderRadius: 8 },
  more: { alignItems: 'center', paddingVertical: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
});
