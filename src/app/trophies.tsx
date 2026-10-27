import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, IgnScreen, ProgressBar, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { useEarnedTrophies } from '@/hooks/useTrophies';
import { useCurrentProfile } from '@/store/useStore';
import { PLATINUM_TROPHY, TIER_META, TROPHIES, type Tier, type Trophy } from '@/utils/trophies';

const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];

// Copa con el color de su metal (gris y apagada si aún no la tienes).
function TrophyIcon({ trophy, got, size = 46 }: { trophy: Trophy; got: boolean; size?: number }) {
  const c = useIgnColors();
  const color = TIER_META[trophy.tier].color;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: got ? `${color}33` : c.soft,
        borderWidth: 2,
        borderColor: got ? color : c.line,
      }}
    >
      <Ionicons name={(got ? trophy.icon : 'lock-closed') as never} size={size * 0.46} color={got ? color : c.muted} />
    </View>
  );
}

// Sala de trofeos: los trofeos de Saga Quest, con tu progreso en cada uno.
export default function TrophiesScreen() {
  const c = useIgnColors();
  const profile = useCurrentProfile();
  const { ctx, earned } = useEarnedTrophies();
  const [filter, setFilter] = useState<'all' | 'got' | 'todo'>('all');
  const dates = profile?.trophies ?? {};
  const all = [...TROPHIES, PLATINUM_TROPHY];
  const per = TIERS.map((t) => ({
    tier: t,
    got: all.filter((x) => x.tier === t && earned.has(x.id)).length,
    total: all.filter((x) => x.tier === t).length,
  }));
  const groups = useMemo(() => {
    const out = new Map<string, Trophy[]>();
    for (const t of all) {
      const got = earned.has(t.id);
      if (filter === 'got' && !got) continue;
      if (filter === 'todo' && got) continue;
      out.set(t.group, [...(out.get(t.group) ?? []), t]);
    }
    return [...out.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, filter]);
  const pct = Math.round((earned.size / all.length) * 100);

  return (
    <IgnScreen narrow={860} title="Trofeos" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      <LinearGradient colors={['#1d2b64', '#6a3093']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Ionicons name="trophy" size={44} color="#f5c518" />
          <View style={{ flex: 1 }}>
            <ThemedText variant="display" size={26} style={{ color: '#fff' }}>
              {`${earned.size}/${all.length}`}
            </ThemedText>
            <ThemedText size={13} style={{ color: '#ffffffcc' }}>
              {`${pct} % de los trofeos de Saga Quest`}
            </ThemedText>
          </View>
        </View>
        <ProgressBar pct={pct} height={8} color="#f5c518" />
        <View style={styles.tiers}>
          {per.map((p) => (
            <View key={p.tier} style={styles.tier}>
              <Ionicons name="trophy" size={18} color={TIER_META[p.tier].color} />
              <ThemedText variant="bold" size={13} style={{ color: '#fff' }}>
                {`${p.got}/${p.total}`}
              </ThemedText>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.tabs, { backgroundColor: c.soft, borderRadius: c.radius }]}>
        {(
          [
            ['all', 'Todos'],
            ['got', 'Conseguidos'],
            ['todo', 'Pendientes'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setFilter(id)}
            style={[
              styles.tab,
              { borderRadius: c.radius, backgroundColor: filter === id ? c.inverseBg : 'transparent' },
            ]}
          >
            <ThemedText variant="bold" size={13} style={{ color: filter === id ? c.inverseText : c.text }}>
              {label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {groups.map(([group, list]) => (
        <View key={group} style={{ gap: 8 }}>
          <ThemedText variant="bold" size={15}>
            {group}
          </ThemedText>
          <Card style={{ gap: 14 }}>
            {list.map((t) => {
              const got = earned.has(t.id);
              const [cur, target] =
                t.id === PLATINUM_TROPHY.id
                  ? [Math.min(earned.size, TROPHIES.length), TROPHIES.length]
                  : t.progress(ctx);
              const when = dates[t.id];
              return (
                <View key={t.id} style={styles.row}>
                  <TrophyIcon trophy={t} got={got} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText variant="bold" size={14} style={{ flexShrink: 1 }} numberOfLines={1}>
                        {t.name}
                      </ThemedText>
                      <ThemedText size={11} style={{ color: TIER_META[t.tier].color }}>
                        {TIER_META[t.tier].label}
                      </ThemedText>
                    </View>
                    <ThemedText variant="muted" size={12}>
                      {t.description}
                    </ThemedText>
                    {got ? (
                      <ThemedText size={11} style={{ color: c.accent }}>
                        {when
                          ? `Conseguido el ${when.slice(8, 10)}/${when.slice(5, 7)}/${when.slice(0, 4)}`
                          : 'Conseguido'}
                      </ThemedText>
                    ) : target > 1 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <ProgressBar pct={(cur / target) * 100} height={5} color={TIER_META[t.tier].color} />
                        </View>
                        <ThemedText variant="muted" size={11}>
                          {`${cur.toLocaleString('es-ES')}/${target.toLocaleString('es-ES')}`}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, padding: 18, gap: 14 },
  tiers: { flexDirection: 'row', justifyContent: 'space-between' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
