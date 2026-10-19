import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PlatinumBadge } from '@/components/achievements';
import { formatDay } from '@/components/details';
import { GameCover } from '@/components/games';
import { IgnScreen, useIgnColors } from '@/components/ign';
import { Shine } from '@/components/Shine';
import { ThemedText } from '@/components/ThemedText';
import { usePlatinums } from '@/hooks/usePlatinums';

// Tus Platinos Saga Quest: juegos con todos los logros marcados.
export default function PlatinumsScreen() {
  const c = useIgnColors();
  const { width } = useWindowDimensions();
  const { list, loading } = usePlatinums();
  const tileW = (width - 40 - 18) / 2 - 6;

  return (
    <IgnScreen title="Platinos" back>
      <View style={styles.intro}>
        <PlatinumBadge size={46} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="display" size={20}>
            {list.length} {list.length === 1 ? 'platino' : 'platinos'}
          </ThemedText>
          <ThemedText variant="muted" size={12}>
            Juegos con todos sus logros. Toca uno para ver sus logros.
          </ThemedText>
        </View>
      </View>

      {loading ? <ActivityIndicator color={c.text} style={{ marginTop: 30 }} /> : null}
      {!loading && list.length === 0 ? (
        <ThemedText variant="muted" size={14} style={styles.empty}>
          Aún no tienes ningún platino. Abre un juego, despliega «Logros» y márcalos todos para conseguirlo.
        </ThemedText>
      ) : null}

      <View style={styles.grid}>
        {list.map((p) => (
          <Pressable
            key={p.game.id}
            onPress={() => router.push(`/platinum/${encodeURIComponent(p.game.id)}`)}
            style={{ width: tileW + 6 }}
          >
            <Shine width={tileW} height={tileW * (4 / 3)} radius={10} border={3} badge={34}>
              <GameCover game={p.game} width={tileW} radius={0} plain />
            </Shine>
            <ThemedText size={14} numberOfLines={2} style={{ marginTop: 10 }}>
              {p.game.title}
            </ThemedText>
            <ThemedText variant="muted" size={11}>
              {p.total} logros{p.ug.finishedAt ? ` · ${formatDay(p.ug.finishedAt)}` : ''}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 24 },
  empty: { paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, rowGap: 26, paddingHorizontal: 20 },
});
