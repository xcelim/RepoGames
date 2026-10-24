import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { answerChallenge, KIND_META, refreshChallenges, useChallenges, type Challenge } from '@/cloud/challenges';
import { useSocial } from '@/cloud/social';
import { GameCover } from '@/components/games';
import { Card, DarkButton, HeaderIcon, IgnScreen, timeAgo, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/ui';
import { useStore } from '@/store/useStore';

// Tus retos con amigos: invitaciones, en marcha y terminados.
export default function ChallengesScreen() {
  const c = useIgnColors();
  const uid = useStore((s) => s.cloudUserId);
  const { list, loaded, missing } = useChallenges();
  useEffect(() => {
    refreshChallenges().catch(() => undefined);
  }, []);

  const mine = (ch: Challenge) => ch.members.find((m) => m.profileId === uid);
  const invites = list.filter((ch) => mine(ch) && !mine(ch)!.accepted);
  const ended = (ch: Challenge) =>
    (ch.endsAt && ch.endsAt < new Date().toISOString()) ||
    ch.members.some((m) => m.finishedAt && ch.kind !== 'achievements' && ch.kind !== 'count');
  const active = list.filter((ch) => mine(ch)?.accepted && !ended(ch));
  const done = list.filter((ch) => mine(ch)?.accepted && ended(ch));

  return (
    <IgnScreen
      title="Retos"
      back
      right={<HeaderIcon icon="add-circle-outline" label="Nuevo reto" onPress={() => router.push('/challenge/new')} />}
    >
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {!loaded ? <ActivityIndicator color={c.text} /> : null}
        {missing ? (
          <Card>
            <ThemedText variant="muted" size={13}>
              Falta ejecutar en Supabase el SQL «2026-10-25-coop-retos.sql» para usar los retos.
            </ThemedText>
          </Card>
        ) : null}
        {loaded && !missing && list.length === 0 ? (
          <Card style={{ gap: 12, alignItems: 'center' }}>
            <Ionicons name="trophy-outline" size={44} color={c.muted} />
            <ThemedText variant="muted" size={14} style={{ textAlign: 'center' }}>
              Reta a tus amigos: quién termina antes un juego, quién lo platina, quién tiene más logros o quién termina
              más juegos este mes.
            </ThemedText>
            <DarkButton label="Crear reto" icon="add" onPress={() => router.push('/challenge/new')} />
          </Card>
        ) : null}

        {invites.length ? (
          <ThemedText variant="display" size={18}>
            Invitaciones
          </ThemedText>
        ) : null}
        {invites.map((ch) => (
          <ChallengeCard key={ch.id} ch={ch}>
            <View style={styles.inviteBtns}>
              <DarkButton label="Aceptar" onPress={() => answerChallenge(ch.id, true)} style={{ flex: 1 }} />
              <Pressable onPress={() => answerChallenge(ch.id, false)} hitSlop={8}>
                <ThemedText variant="muted" size={13} style={{ textDecorationLine: 'underline' }}>
                  Rechazar
                </ThemedText>
              </Pressable>
            </View>
          </ChallengeCard>
        ))}

        {active.length ? (
          <ThemedText variant="display" size={18}>
            En marcha
          </ThemedText>
        ) : null}
        {active.map((ch) => (
          <ChallengeCard key={ch.id} ch={ch} />
        ))}

        {done.length ? (
          <ThemedText variant="display" size={18}>
            Terminados
          </ThemedText>
        ) : null}
        {done.map((ch) => (
          <ChallengeCard key={ch.id} ch={ch} />
        ))}
      </View>
    </IgnScreen>
  );
}

function ChallengeCard({ ch, children }: { ch: Challenge; children?: React.ReactNode }) {
  const c = useIgnColors();
  const profiles = useSocial((s) => s.profiles);
  const game =
    useStore((s) => (ch.gameId ? s.games[ch.gameId] : undefined)) ?? useSocial.getState().games[ch.gameId ?? ''];
  const meta = KIND_META[ch.kind];
  const winner = ch.members.filter((m) => m.finishedAt).sort((a, b) => (a.finishedAt! < b.finishedAt! ? -1 : 1))[0];
  return (
    <Pressable onPress={() => router.push(`/challenge/${ch.id}`)}>
      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          {game ? (
            <GameCover game={game} width={52} radius={6} />
          ) : (
            <Ionicons name={meta.icon as never} size={36} color={c.accent} />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="bold" size={16}>
              {ch.title}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {meta.name}
              {game ? ` · ${game.title}` : ch.target ? ` · ${ch.target} juegos` : ''}
            </ThemedText>
            <ThemedText variant="muted" size={11}>
              {ch.endsAt
                ? `Acaba ${new Date(ch.endsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                : `Creado ${timeAgo(ch.createdAt)}`}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </View>
        <View style={styles.row}>
          {ch.members.map((m, i) => {
            const p = profiles[m.profileId];
            return p ? (
              <View key={m.profileId} style={{ marginLeft: i ? -8 : 0, opacity: m.accepted ? 1 : 0.4 }}>
                <Avatar name={p.displayName} color={p.avatarColor} uri={p.photo} size={28} />
              </View>
            ) : null;
          })}
          {winner && profiles[winner.profileId] ? (
            <ThemedText variant="bold" size={12} style={{ marginLeft: 8 }}>
              🏆 {profiles[winner.profileId].displayName}
            </ThemedText>
          ) : null}
        </View>
        {children}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteBtns: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
