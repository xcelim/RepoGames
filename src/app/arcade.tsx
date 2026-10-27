import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EventBanner } from '@/components/EventBanner';
import { IgnScreen } from '@/components/ign';
import { ThemedText } from '@/components/ThemedText';
import type { IconName } from '@/components/ui';
import { useMyGames } from '@/hooks/useMyGames';

type Tool = { href: Href; icon: IconName; title: string; caption: string; colors: [string, string]; wide?: boolean };

const TOOLS: Tool[] = [
  {
    href: '/world',
    icon: 'business',
    title: 'Mundo gamer',
    caption: 'Tu ciudad en 3D: un edificio por juego terminado y tus horas son monedas',
    colors: ['#0f2027', '#2c5364'],
    wide: true,
  },
  {
    href: '/cards',
    icon: 'albums',
    title: 'Cromos',
    caption: 'Un sobre gratis cada día, cromos brillantes e intercambios con amigos',
    colors: ['#c471f5', '#fa71cd'],
    wide: true,
  },
  {
    href: '/bingo',
    icon: 'grid',
    title: 'Bingo gamer',
    caption: 'Un cartón nuevo cada mes',
    colors: ['#fc4a1a', '#f7b733'],
  },
  {
    href: '/hilo',
    icon: 'swap-vertical',
    title: '¿Más o menos?',
    caption: '¿Más nota o más horas? Haz racha',
    colors: ['#00b09b', '#96c93d'],
  },
  {
    href: '/trophies',
    icon: 'trophy',
    title: 'Trofeos',
    caption: 'Los trofeos de Saga Quest',
    colors: ['#1d2b64', '#6a3093'],
  },
  {
    href: '/events',
    icon: 'calendar-number',
    title: 'Eventos',
    caption: 'Retos de temporada e insignias',
    colors: ['#ff7518', '#3d0c5c'],
  },
  {
    href: '/deals',
    icon: 'pricetags',
    title: 'Ofertas',
    caption: 'Precios de tus deseados',
    colors: ['#2fa84f', '#0b6e4f'],
  },
  {
    href: '/import',
    icon: 'cloud-download',
    title: 'Importar',
    caption: 'Steam, Excel, CSV y otras apps',
    colors: ['#485563', '#29323c'],
  },
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
  const inner = width - 40;
  const gap = 12;
  // Columnas según el ancho: 2 en el móvil, 3 en tablet, 4 en el PC.
  const cols = inner >= 960 ? 4 : inner >= 640 ? 3 : 2;
  const featured = TOOLS.filter((t) => t.wide);
  const rest = TOOLS.filter((t) => !t.wide);
  // Las destacadas van juntas en una fila si caben; en el móvil, una debajo de otra.
  const featW = inner >= 640 ? (inner - gap * (featured.length - 1)) / featured.length : inner;
  // La última fila se reparte el ancho entero (sin huecos al final).
  const widthAt = (i: number) => {
    const lastStart = rest.length - (rest.length % cols || cols);
    const inRow = i >= lastStart ? rest.length - lastStart : cols;
    return (inner - gap * (inRow - 1)) / inRow;
  };
  return (
    <IgnScreen title="Sala de juegos" back contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <ThemedText variant="muted" size={13}>
        {mine.length
          ? `Juega con tu biblioteca de ${mine.length} ${mine.length === 1 ? 'juego' : 'juegos'}.`
          : 'Añade juegos a tu biblioteca para sacarle partido a todo esto.'}
      </ThemedText>
      <EventBanner />
      <View style={[styles.grid, { gap }]}>
        {featured.map((t) => (
          <Tile key={t.title} tool={t} width={featW} big />
        ))}
      </View>
      <View style={[styles.grid, { gap }]}>
        {rest.map((t, i) => (
          <Tile key={t.title} tool={t} width={widthAt(i)} />
        ))}
      </View>
    </IgnScreen>
  );
}

function Tile({ tool: t, width, big }: { tool: Tool; width: number; big?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(t.href)}
      style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient
        colors={t.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { minHeight: big ? 150 : 140, height: '100%' }]}
      >
        <Ionicons name={t.icon} size={big ? 120 : 90} color="rgba(255,255,255,0.16)" style={styles.bigIcon} />
        <View style={styles.iconBubble}>
          <Ionicons name={t.icon} size={22} color="#fff" />
        </View>
        <View style={{ gap: 3 }}>
          <ThemedText variant="display" size={big ? 22 : 17} style={styles.white} numberOfLines={2}>
            {t.title}
          </ThemedText>
          <ThemedText size={12} style={styles.caption} numberOfLines={3}>
            {t.caption}
          </ThemedText>
        </View>
      </LinearGradient>
    </Pressable>
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
