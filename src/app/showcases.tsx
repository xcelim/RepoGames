import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, Sheet, useIgnColors } from '@/components/ign';
import { LevelBadge } from '@/components/LevelBadge';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useLevel } from '@/hooks/useLevel';
import { useCurrentProfile, useStore } from '@/store/useStore';
import type { Showcase, ShowcaseType } from '@/types';
import { rankByQuery } from '@/utils/fuzzy';
import { MAX_SHOWCASES, nextSlotLevel, SHOWCASES } from '@/utils/level';

const TYPES = Object.keys(SHOWCASES) as ShowcaseType[];

// Elegir qué vitrinas salen en el perfil (los huecos se ganan subiendo de nivel).
export default function ShowcasesScreen() {
  const c = useIgnColors();
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const { level, slots } = useLevel();
  const [picking, setPicking] = useState<number | null>(null);
  const [favFor, setFavFor] = useState<number | null>(null);
  if (!profile) return null;
  const current: Showcase[] = (profile.showcases ?? []).slice(0, slots);
  const save = (next: Showcase[]) => updateProfile({ showcases: next });
  const next = nextSlotLevel(level);

  const move = (i: number, d: -1 | 1) => {
    const arr = [...current];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save(arr);
  };

  return (
    <IgnScreen narrow={820} title="Vitrinas" close contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <Card style={styles.info}>
        <LevelBadge level={level} size={44} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="bold" size={15}>
            {current.length} de {slots} {slots === 1 ? 'hueco' : 'huecos'} usados
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            {next
              ? `Ganas otro hueco al llegar al nivel ${next} (máximo ${MAX_SHOWCASES}).`
              : `Tienes todos los huecos (${MAX_SHOWCASES}).`}
          </ThemedText>
        </View>
      </Card>

      {current.map((s, i) => (
        <Card key={`${s.type}-${i}`} style={styles.slot}>
          <Ionicons name={SHOWCASES[s.type].icon as keyof typeof Ionicons.glyphMap} size={22} color={c.accent} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="bold" size={15}>
              {SHOWCASES[s.type].name}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {s.type === 'favorites'
                ? `${s.gameIds?.length ?? 0} de 6 juegos · toca para elegir`
                : SHOWCASES[s.type].description}
            </ThemedText>
          </View>
          {s.type === 'favorites' ? (
            <Pressable onPress={() => setFavFor(i)} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color={c.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => move(i, -1)} hitSlop={6} disabled={i === 0}>
            <Ionicons name="chevron-up" size={22} color={i === 0 ? c.line : c.text} />
          </Pressable>
          <Pressable onPress={() => move(i, 1)} hitSlop={6} disabled={i === current.length - 1}>
            <Ionicons name="chevron-down" size={22} color={i === current.length - 1 ? c.line : c.text} />
          </Pressable>
          <Pressable onPress={() => save(current.filter((_, k) => k !== i))} hitSlop={6}>
            <Ionicons name="close-circle" size={22} color={c.muted} />
          </Pressable>
        </Card>
      ))}

      {current.length < slots ? (
        <DarkButton label="Añadir vitrina" icon="add" onPress={() => setPicking(current.length)} />
      ) : null}

      <ThemedText variant="display" size={18} style={{ marginTop: 14 }}>
        Todas las vitrinas
      </ThemedText>
      {TYPES.map((t) => {
        const meta = SHOWCASES[t];
        const locked = level < meta.level;
        return (
          <View key={t} style={[styles.typeRow, { borderBottomColor: c.line, opacity: locked ? 0.5 : 1 }]}>
            <Ionicons
              name={locked ? 'lock-closed' : (meta.icon as keyof typeof Ionicons.glyphMap)}
              size={20}
              color={c.text}
            />
            <View style={{ flex: 1 }}>
              <ThemedText variant="bold" size={14}>
                {meta.name}
              </ThemedText>
              <ThemedText variant="muted" size={12}>
                {meta.description}
              </ThemedText>
            </View>
            <ThemedText variant="muted" size={12}>
              {locked ? `Nivel ${meta.level}` : 'Disponible'}
            </ThemedText>
          </View>
        );
      })}

      {picking != null ? (
        <Sheet visible title="Elige una vitrina" onClose={() => setPicking(null)}>
          {TYPES.map((t) => {
            const meta = SHOWCASES[t];
            const locked = level < meta.level;
            const used = current.some((s) => s.type === t);
            return (
              <Pressable
                key={t}
                disabled={locked || used}
                onPress={() => {
                  save([...current, { type: t, ...(t === 'favorites' ? { gameIds: [] } : {}) }]);
                  setPicking(null);
                  if (t === 'favorites') setFavFor(current.length);
                }}
                style={[styles.typeRow, { borderBottomColor: c.line, opacity: locked || used ? 0.4 : 1 }]}
              >
                <Ionicons
                  name={locked ? 'lock-closed' : (meta.icon as keyof typeof Ionicons.glyphMap)}
                  size={20}
                  color={c.text}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="bold" size={14}>
                    {meta.name}
                  </ThemedText>
                  <ThemedText variant="muted" size={12}>
                    {locked
                      ? `Se desbloquea en el nivel ${meta.level}`
                      : used
                        ? 'Ya la tienes puesta'
                        : meta.description}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </Sheet>
      ) : null}

      {favFor != null && current[favFor] ? (
        <FavoritesPicker
          selected={current[favFor].gameIds ?? []}
          onChange={(gameIds) => save(current.map((s, k) => (k === favFor ? { ...s, gameIds } : s)))}
          onClose={() => setFavFor(null)}
        />
      ) : null}
    </IgnScreen>
  );
}

function FavoritesPicker({
  selected,
  onChange,
  onClose,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const c = useIgnColors();
  const profileId = useStore((s) => s.currentProfileId);
  const userGames = useStore((s) => s.userGames);
  const games = useStore((s) => s.games);
  const [q, setQ] = useState('');
  const mine = useMemo(
    () =>
      Object.values(userGames)
        .filter((u) => u.profileId === profileId)
        .map((u) => games[u.gameId])
        .filter((g) => !!g),
    [userGames, games, profileId],
  );
  const shown = q.trim() ? rankByQuery(q, mine, (g) => g.title) : mine;
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < 6) onChange([...selected, id]);
  };
  return (
    <Sheet visible title={`Favoritos (${selected.length}/6)`} onClose={onClose}>
      <TextField value={q} onChangeText={setQ} placeholder="Buscar en tu biblioteca…" />
      {shown.slice(0, 60).map((g) => {
        const on = selected.includes(g.id);
        return (
          <Pressable key={g.id} onPress={() => toggle(g.id)} style={[styles.typeRow, { borderBottomColor: c.line }]}>
            <GameCover game={g} width={36} radius={4} />
            <ThemedText size={14} style={{ flex: 1 }} numberOfLines={1}>
              {g.title}
            </ThemedText>
            <Ionicons name={on ? 'heart' : 'heart-outline'} size={22} color={on ? '#e5484d' : c.muted} />
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  info: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
