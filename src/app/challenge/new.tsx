import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { createChallenge, KIND_META, type ChallengeKind } from '@/cloud/challenges';
import { useSocial } from '@/cloud/social';
import { GameCover } from '@/components/games';
import { DarkButton, IgnScreen, Sheet, useIgnColors } from '@/components/ign';
import { PersonRow } from '@/components/PersonRow';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { notify } from '@/utils/notify';
import { useShallow } from 'zustand/react/shallow';

const KINDS: ChallengeKind[] = ['finish', 'platinum', 'achievements', 'count'];
const DAYS: [string, number | null][] = [
  ['Sin fecha', null],
  ['1 semana', 7],
  ['1 mes', 30],
  ['3 meses', 90],
];

export default function NewChallengeScreen() {
  const c = useIgnColors();
  const uid = useStore((s) => s.cloudUserId);
  const { friendships, profiles } = useSocial(
    useShallow((s) => ({ friendships: s.friendships, profiles: s.profiles })),
  );
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester === uid ? f.addressee : f.requester));
  const [kind, setKind] = useState<ChallengeKind>('finish');
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const initial = useStore((s) => (gameId ? s.games[decodeURIComponent(gameId)] : undefined));
  const [game, setGame] = useState<GameRecord | null>(initial ?? null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('5');
  const [days, setDays] = useState<number | null>(30);
  const [invite, setInvite] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsGame = kind !== 'count';
  const autoTitle =
    kind === 'count'
      ? `Maratón: ${target || '?'} juegos`
      : game
        ? `${KIND_META[kind].name}: ${game.title}`
        : KIND_META[kind].name;

  const create = async () => {
    setBusy(true);
    try {
      const id = await createChallenge({
        title: title.trim() || autoTitle,
        kind,
        gameId: needsGame ? (game?.id ?? null) : null,
        target: kind === 'count' ? Math.max(1, parseInt(target, 10) || 1) : null,
        days,
        invite,
      });
      notify('¡Reto creado!');
      router.replace(`/challenge/${id}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[
        styles.chip,
        { borderRadius: c.radius, borderColor: c.line, backgroundColor: active ? c.inverseBg : 'transparent' },
      ]}
    >
      <ThemedText variant="bold" size={12} style={{ color: active ? c.inverseText : c.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <IgnScreen narrow={820} title="Nuevo reto" close contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <ThemedText variant="bold" size={14}>
        Tipo de reto
      </ThemedText>
      {KINDS.map((k) => (
        <Pressable
          key={k}
          onPress={() => setKind(k)}
          style={[styles.kind, { borderColor: k === kind ? c.accent : c.line, borderRadius: c.radius }]}
        >
          <Ionicons name={KIND_META[k].icon as never} size={24} color={k === kind ? c.accent : c.text} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={14}>
              {KIND_META[k].name}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {KIND_META[k].description}
            </ThemedText>
          </View>
          {k === kind ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : null}
        </Pressable>
      ))}

      {needsGame ? (
        <Pressable
          onPress={() => setPicking(true)}
          style={[styles.kind, { borderColor: c.line, borderRadius: c.radius }]}
        >
          {game ? (
            <GameCover game={game} width={44} radius={4} />
          ) : (
            <Ionicons name="game-controller-outline" size={24} color={c.text} />
          )}
          <ThemedText variant="bold" size={14} style={{ flex: 1 }}>
            {game ? game.title : 'Elige el juego'}
          </ThemedText>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
      ) : (
        <TextField
          label="¿Cuántos juegos hay que terminar?"
          value={target}
          onChangeText={setTarget}
          keyboardType="number-pad"
          maxLength={3}
        />
      )}

      <ThemedText variant="bold" size={14}>
        Plazo
      </ThemedText>
      <View style={styles.chips}>{DAYS.map(([label, d]) => chip(label, d === days, () => setDays(d)))}</View>

      <TextField
        label="Nombre (opcional)"
        value={title}
        onChangeText={setTitle}
        placeholder={autoTitle}
        maxLength={80}
      />

      <ThemedText variant="bold" size={14}>
        Invitar amigos
      </ThemedText>
      {friends.length === 0 ? (
        <ThemedText variant="muted" size={13}>
          Aún no tienes amigos. Puedes crear el reto solo y retarte a ti mismo.
        </ThemedText>
      ) : (
        friends.map((f) => {
          const on = invite.includes(f);
          return (
            <PersonRow
              key={f}
              profile={profiles[f]}
              onPress={() => setInvite((x) => (on ? x.filter((y) => y !== f) : [...x, f]))}
            >
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? c.accent : c.muted} />
            </PersonRow>
          );
        })
      )}

      <DarkButton
        label={busy ? 'Creando…' : '¡Retar!'}
        icon="trophy-outline"
        disabled={busy || (needsGame && !game)}
        onPress={create}
      />

      {picking ? (
        <GamePicker
          onPick={(g) => {
            setGame(g);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </IgnScreen>
  );
}

function GamePicker({ onPick, onClose }: { onPick: (g: GameRecord) => void; onClose: () => void }) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const [q, setQ] = useState('');
  const mine = useMemo(
    () =>
      Object.values(userGames)
        .filter((u) => u.profileId === profileId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((u) => games[u.gameId])
        .filter((g): g is GameRecord => !!g),
    [userGames, games, profileId],
  );
  const shown = q.trim() ? rankByQuery(q, mine, (g) => g.title) : mine;
  return (
    <Sheet visible title="Elige el juego" onClose={onClose}>
      <TextField value={q} onChangeText={setQ} placeholder="Buscar en tu biblioteca…" />
      <ThemedText variant="muted" size={11}>
        ¿No está? Añádelo antes a tu biblioteca desde el buscador.
      </ThemedText>
      {shown.slice(0, 50).map((g) => (
        <Pressable key={g.id} onPress={() => onPick(g)} style={[styles.pick, { borderBottomColor: c.line }]}>
          <GameCover game={g} width={36} radius={4} />
          <ThemedText size={14} style={{ flex: 1 }} numberOfLines={1}>
            {g.title}
          </ThemedText>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  kind: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
