import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Achievement } from '@/api/achievements';
import {
  deleteChallenge,
  fetchFinishedSince,
  KIND_META,
  loadRace,
  markChallengeDone,
  refreshChallenges,
  useChallenges,
  type GameRace,
} from '@/cloud/challenges';
import { useSocial } from '@/cloud/social';
import { PlatinumBadge } from '@/components/achievements';
import { celebrate } from '@/components/Celebration';
import { GameCover } from '@/components/games';
import { Card, IgnScreen, ProgressBar, Sheet, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { goBack } from '@/utils/nav';

type Row = { profileId: string; value: number; max: number; done: boolean; label: string; finishedAt: string | null };

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const uid = useStore((s) => s.cloudUserId);
  const myUserGames = useStore((s) => s.userGames);
  const ch = useChallenges((s) => s.list.find((x) => x.id === id));
  const profiles = useSocial((s) => s.profiles);
  const [race, setRace] = useState<GameRace | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!ch) refreshChallenges().catch(() => undefined);
  }, [ch]);

  const people = useMemo(() => (ch ? ch.members.filter((m) => m.accepted).map((m) => m.profileId) : []), [ch]);

  // Se recarga al entrar y cada vez que cambias algo de tu biblioteca.
  useEffect(() => {
    if (!ch) return;
    let alive = true;
    (async () => {
      if (ch.kind === 'count') {
        const r = await fetchFinishedSince(people, ch.startsAt);
        if (alive) setCounts(r);
      } else if (ch.gameId) {
        const r = await loadRace(ch.gameId, people);
        if (alive) setRace(r);
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ch, people, myUserGames]);

  const rows: Row[] = useMemo(() => {
    if (!ch) return [];
    const finishedAt = (pid: string) => ch.members.find((m) => m.profileId === pid)?.finishedAt ?? null;
    if (ch.kind === 'count') {
      const t = ch.target ?? 1;
      return people.map((pid) => ({
        profileId: pid,
        value: counts[pid] ?? 0,
        max: t,
        done: (counts[pid] ?? 0) >= t,
        label: `${counts[pid] ?? 0}/${t}`,
        finishedAt: finishedAt(pid),
      }));
    }
    if (!race) return [];
    const total = race.achievements.length;
    return race.people.map((p) => {
      const got = race.achievements.filter((a) => p.ug?.achievements?.includes(a.id)).length;
      const finished = p.ug?.status === 'beaten' || p.ug?.status === 'completed';
      if (ch.kind === 'finish') {
        return {
          profileId: p.profileId,
          value: finished ? 1 : 0,
          max: 1,
          done: finished,
          label: finished ? '¡Terminado!' : p.ug ? statusLabel(p.ug.status) : 'Sin empezar',
          finishedAt: finishedAt(p.profileId),
        };
      }
      return {
        profileId: p.profileId,
        value: got,
        max: total || 1,
        done: ch.kind === 'platinum' && total > 0 && got === total,
        label: `${got}/${total} logros`,
        finishedAt: finishedAt(p.profileId),
      };
    });
  }, [ch, race, counts, people]);

  // Si acabas de cumplirlo, se apunta (con fecha, para saber quién llegó antes).
  const meRow = rows.find((r) => r.profileId === uid);
  useEffect(() => {
    if (ch && meRow?.done && !meRow.finishedAt) {
      markChallengeDone(ch.id).catch(() => undefined);
      celebrate({ kind: ch.kind === 'platinum' ? 'platinum' : 'finish', title: `Reto cumplido: ${ch.title}` });
    }
  }, [ch, meRow?.done, meRow?.finishedAt]);

  if (!ch) {
    return (
      <IgnScreen title="Reto" back>
        <ActivityIndicator color={c.text} style={{ marginTop: 40 }} />
      </IgnScreen>
    );
  }

  const meta = KIND_META[ch.kind];
  const sorted = [...rows].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt.localeCompare(b.finishedAt);
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return b.value / b.max - a.value / a.max;
  });
  const cols = 5;
  const tile = (width - 40 - 36 - (cols - 1) * 10) / cols;
  const pending = ch.members.filter((m) => !m.accepted);

  return (
    <IgnScreen
      title={ch.title}
      back
      right={
        ch.creator === uid ? (
          <Pressable
            onPress={() =>
              Alert.alert('Borrar reto', '¿Seguro?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Borrar',
                  style: 'destructive',
                  onPress: () => deleteChallenge(ch.id).then(() => goBack()),
                },
              ])
            }
            hitSlop={10}
          >
            <Ionicons name="trash-outline" size={24} color={c.muted} />
          </Pressable>
        ) : null
      }
      contentStyle={{ paddingHorizontal: 20, gap: 16 }}
    >
      <View style={styles.head}>
        {race?.game ? (
          <Pressable onPress={() => router.push(`/game/${encodeURIComponent(race.game!.id)}`)}>
            <GameCover game={race.game} width={80} radius={8} />
          </Pressable>
        ) : (
          <Ionicons name={meta.icon as never} size={56} color={c.accent} />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText variant="bold" size={13} style={{ color: c.accent, letterSpacing: 0.6 }}>
            {meta.name.toUpperCase()}
          </ThemedText>
          <ThemedText variant="muted" size={13}>
            {meta.description}
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            {ch.endsAt
              ? `Hasta el ${new Date(ch.endsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`
              : 'Sin fecha límite'}
          </ThemedText>
        </View>
      </View>

      <Card style={{ gap: 14 }}>
        <ThemedText variant="display" size={18}>
          Clasificación
        </ThemedText>
        {sorted.length === 0 ? <ActivityIndicator color={c.text} /> : null}
        {sorted.map((r, i) => {
          const p = profiles[r.profileId];
          return (
            <View key={r.profileId} style={styles.rank}>
              <ThemedText variant="display" size={18} style={{ width: 24, textAlign: 'center' }}>
                {r.finishedAt && i === 0 ? '🏆' : i + 1}
              </ThemedText>
              {p ? <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={36} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.rankTop}>
                  <ThemedText variant="bold" size={14} style={{ flex: 1 }} numberOfLines={1}>
                    {r.profileId === uid ? 'Tú' : (p?.displayName ?? 'Jugador')}
                  </ThemedText>
                  <ThemedText variant="muted" size={12}>
                    {r.label}
                  </ThemedText>
                  {ch.kind === 'platinum' && r.done ? <PlatinumBadge size={18} /> : null}
                </View>
                <ProgressBar pct={(r.value / r.max) * 100} height={6} color={r.done ? '#2fd18b' : undefined} />
              </View>
            </View>
          );
        })}
        {pending.length ? (
          <ThemedText variant="muted" size={12}>
            Sin contestar: {pending.map((m) => profiles[m.profileId]?.displayName ?? '?').join(', ')}
          </ThemedText>
        ) : null}
      </Card>

      {race && race.achievements.length && ch.kind !== 'finish' ? (
        <Card style={{ gap: 12 }}>
          <ThemedText variant="display" size={18}>
            Quién tiene cada logro
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            Toca un logro para ver quién lo tiene. Los tuyos se marcan desde la ficha del juego.
          </ThemedText>
          <View style={styles.grid}>
            {race.achievements.map((a) => {
              const who = race.people.filter((p) => p.ug?.achievements?.includes(a.id));
              const mineHas = who.some((p) => p.profileId === uid);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setPicked(a)}
                  style={{ width: tile, alignItems: 'center', gap: 4 }}
                >
                  <View style={[styles.icon, { width: tile, height: tile, borderColor: mineHas ? '#2fd18b' : c.line }]}>
                    {a.image && (!a.hidden || mineHas) ? (
                      <Image
                        source={{ uri: a.image }}
                        style={{ width: '100%', height: '100%', opacity: who.length ? 1 : 0.35 }}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons
                        name={a.hidden && !mineHas ? 'eye-off-outline' : 'trophy-outline'}
                        size={tile * 0.4}
                        color={c.muted}
                      />
                    )}
                  </View>
                  <View style={styles.dots}>
                    {who.slice(0, 4).map((p) => {
                      const pr = profiles[p.profileId];
                      return pr ? (
                        <View key={p.profileId} style={[styles.dot, { backgroundColor: pr.avatarColor }]} />
                      ) : null;
                    })}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {picked && race ? (
        <Sheet visible title={picked.hidden ? 'Logro oculto' : picked.name} onClose={() => setPicked(null)}>
          <View style={{ gap: 10, paddingBottom: 8 }}>
            {!picked.hidden && picked.description ? <ThemedText size={14}>{picked.description}</ThemedText> : null}
            {race.people.map((p) => {
              const pr = profiles[p.profileId];
              const has = p.ug?.achievements?.includes(picked.id);
              return pr ? (
                <View key={p.profileId} style={styles.rank}>
                  <Avatar name={pr.displayName} color={pr.avatarColor} uri={pr.photo} size={30} />
                  <ThemedText size={14} style={{ flex: 1 }}>
                    {p.profileId === uid ? 'Tú' : pr.displayName}
                  </ThemedText>
                  <Ionicons
                    name={has ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={has ? '#2fd18b' : c.muted}
                  />
                </View>
              ) : null;
            })}
          </View>
        </Sheet>
      ) : null}
    </IgnScreen>
  );
}

function statusLabel(s: string): string {
  return (
    {
      playing: 'Jugando',
      paused: 'En pausa',
      backlog: 'Pendiente',
      wishlist: 'Lo quiere',
      dropped: 'Abandonado',
      library: 'En biblioteca',
    }[s] ?? s
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  icon: { borderRadius: 10, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
