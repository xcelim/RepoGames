import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { fetchAchievements, type Achievement, type AchievementSet } from '@/api/achievements';
import { useStore } from '@/store/useStore';
import type { GameRecord } from '@/types';
import { userGameKey } from '@/utils/library';
import { notify } from '@/utils/notify';

import { Card, ProgressBar, useIgnColors } from './ign';
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

export function AchievementsCard({ game }: { game: GameRecord }) {
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
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAchievements(game)
      .then((set) => alive && setState({ id: game.id, set, error: null }))
      .catch(
        (e: unknown) =>
          alive && setState({ id: game.id, set: { source: 'rawg', list: [] }, error: e instanceof Error ? e.message : 'Error' }),
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
      if (status !== 'completed') {
        Alert.alert('🏆 ¡Platino Saga Quest!', `Tienes todos los logros de ${game.title}. ¿Lo marcas como «Al 100 %»?`, [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Marcar al 100 %', onPress: () => setStatus(game.id, 'completed') },
        ]);
      } else notify('🏆 ¡Platino Saga Quest!');
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
                <ProgressBar pct={total ? (got / total) * 100 : 0} height={5} color={complete ? '#b9c6d8' : undefined} />
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
        {list ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.muted} /> : <ActivityIndicator color={c.muted} />}
      </Pressable>

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
                  <Image source={{ uri: a.image }} style={[styles.icon, { opacity: has ? 1 : 0.45 }]} contentFit="cover" blurRadius={secret ? 12 : 0} />
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
                <Ionicons name={has ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={has ? '#6aa834' : c.muted} />
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 44, height: 44, borderRadius: 8 },
  more: { alignItems: 'center', paddingVertical: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
});
