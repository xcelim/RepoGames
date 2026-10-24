import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/games';
import { Card, DarkButton, IgnScreen, timeAgo, useIgnColors } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import { useCurrentProfile, useStore } from '@/store/useStore';
import { newTierList } from '@/utils/tierlist';

// Tus tier lists: se guardan en tu perfil (y se ven en cualquier dispositivo).
export default function TierListsScreen() {
  const c = useIgnColors();
  const profile = useCurrentProfile();
  const games = useStore((s) => s.games);
  const updateProfile = useStore((s) => s.updateProfile);
  const lists = profile?.tierlists ?? [];

  const create = () => {
    const t = newTierList(`Tier list ${lists.length + 1}`);
    updateProfile({ tierlists: [t, ...lists] });
    router.push(`/tierlist/${t.id}`);
  };

  return (
    <IgnScreen title="Tier lists" back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <ThemedText variant="muted" size={13}>
        Coloca tus juegos de S a F, ponle el título que quieras y compártela como imagen.
      </ThemedText>
      <DarkButton label="Nueva tier list" icon="add" onPress={create} />
      {lists.map((t) => {
        const ids = t.tiers.flatMap((x) => x.gameIds);
        return (
          <Pressable key={t.id} onPress={() => router.push(`/tierlist/${t.id}`)}>
            <Card style={{ gap: 10 }}>
              <View style={styles.head}>
                <ThemedText variant="bold" size={16} style={{ flex: 1 }} numberOfLines={1}>
                  {t.title}
                </ThemedText>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </View>
              <View style={styles.preview}>
                {t.tiers.slice(0, 3).map((tier) => (
                  <View key={tier.label} style={styles.row}>
                    <View style={[styles.label, { backgroundColor: tier.color }]}>
                      <ThemedText variant="bold" size={12} style={{ color: '#111' }}>
                        {tier.label}
                      </ThemedText>
                    </View>
                    {tier.gameIds
                      .slice(0, 7)
                      .map((id) =>
                        games[id] ? <GameCover key={id} game={games[id]} width={26} plain radius={3} /> : null,
                      )}
                  </View>
                ))}
              </View>
              <ThemedText variant="muted" size={11}>
                {`${ids.length} ${ids.length === 1 ? 'juego' : 'juegos'} · ${timeAgo(t.updatedAt)}`.toUpperCase()}
              </ThemedText>
            </Card>
          </Pressable>
        );
      })}
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 35 },
  label: { width: 26, height: 35, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
