import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { IgnScreen } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import type { IconName } from '@/components/ui';
import { useMyGames } from '@/hooks/useMyGames';

type Tool = { href: Href; icon: IconName; title: string; caption: string; colors: [string, string]; wide?: boolean };

const TOOLS: Tool[] = [
  {
    href: '/oracle',
    icon: 'sparkles',
    title: 'El oráculo',
    caption: 'Dile cuánto tiempo tienes y qué te apetece: te dice a qué jugar',
    colors: ['#7b2ff7', '#f107a3'],
    wide: true,
  },
  {
    href: '/versus',
    icon: 'flash',
    title: 'Duelos',
    caption: '¿Cuál prefieres? Tu ranking sale solo',
    colors: ['#ff512f', '#dd2476'],
  },
  {
    href: '/tierlist',
    icon: 'podium',
    title: 'Tier lists',
    caption: 'S, A, B, C… y compártela',
    colors: ['#f7971e', '#ffd200'],
  },
  {
    href: '/shelf',
    icon: 'library',
    title: 'Estantería',
    caption: 'Tu biblioteca en lomos, por colores',
    colors: ['#8e5a2b', '#d9a066'],
  },
  {
    href: '/stats',
    icon: 'stats-chart',
    title: 'Estadísticas',
    caption: 'Mapa de calor, rachas y tu perfil gamer',
    colors: ['#11998e', '#38ef7d'],
  },
  {
    href: '/timeline',
    icon: 'git-commit',
    title: 'Tu vida gamer',
    caption: 'Año a año, lo que terminaste',
    colors: ['#2193b0', '#6dd5ed'],
  },
  {
    href: '/releases',
    icon: 'calendar',
    title: 'Lanzamientos',
    caption: 'Cuenta atrás de lo que esperas',
    colors: ['#4568dc', '#b06ab3'],
  },
  {
    href: '/roulette',
    icon: 'aperture',
    title: 'Ruleta',
    caption: 'Que decida la suerte',
    colors: ['#e65c00', '#f9d423'],
  },
  {
    href: '/wrapped',
    icon: 'gift',
    title: 'Tu año',
    caption: 'Tu resumen en historias',
    colors: ['#cb2d3e', '#ef473a'],
  },
];

// La sala de juegos: las herramientas divertidas de Saga Quest en un sitio.
export default function ArcadeScreen() {
  const { width } = useWindowDimensions();
  const mine = useMyGames();
  const half = (width - 40 - 12) / 2;
  return (
    <IgnScreen title="Sala de juegos" back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <ThemedText variant="muted" size={13}>
        {mine.length
          ? `Juega con tu biblioteca de ${mine.length} ${mine.length === 1 ? 'juego' : 'juegos'}.`
          : 'Añade juegos a tu biblioteca para sacarle partido a todo esto.'}
      </ThemedText>
      <View style={styles.grid}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.title}
            onPress={() => router.push(t.href)}
            style={({ pressed }) => [{ width: t.wide ? width - 40 : half, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <LinearGradient
              colors={t.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, { minHeight: t.wide ? 130 : 150 }]}
            >
              <Ionicons name={t.icon} size={t.wide ? 120 : 90} color="rgba(255,255,255,0.16)" style={styles.bigIcon} />
              <View style={styles.iconBubble}>
                <Ionicons name={t.icon} size={22} color="#fff" />
              </View>
              <View style={{ gap: 3 }}>
                <ThemedText variant="display" size={t.wide ? 24 : 17} style={styles.white} numberOfLines={2}>
                  {t.title}
                </ThemedText>
                <ThemedText size={12} style={styles.caption} numberOfLines={2}>
                  {t.caption}
                </ThemedText>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderRadius: 18, padding: 16, justifyContent: 'space-between', overflow: 'hidden', gap: 14 },
  bigIcon: { position: 'absolute', right: -14, bottom: -18, transform: [{ rotate: '-12deg' }] },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  white: { color: '#fff' },
  caption: { color: 'rgba(255,255,255,0.88)' },
});
