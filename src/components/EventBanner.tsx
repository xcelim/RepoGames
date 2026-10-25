import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSeasonEvent } from '@/hooks/useSeasonEvent';
import { daysLeft } from '@/utils/events';

import { ProgressBar } from './ign';
import { SeasonParticles } from './SeasonParticles';
import { ThemedText } from './ThemedText';

// Tarjeta del evento de temporada (solo mientras hay uno activo).
export function EventBanner({ style }: { style?: object }) {
  const s = useSeasonEvent();
  if (!s.window) return null;
  const e = s.window.event;
  const left = daysLeft(s.window, s.today);
  return (
    <Pressable onPress={() => router.push('/events')} style={style}>
      <LinearGradient colors={e.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.box}>
        <SeasonParticles emojis={e.particles} count={8} height={130} />
        <View style={styles.row}>
          <Text style={{ fontSize: 34, lineHeight: 42 }}>{e.emoji}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText size={11} variant="bold" style={styles.kicker}>
              {`EVENTO DE TEMPORADA · ${left === 0 ? 'ÚLTIMO DÍA' : `QUEDAN ${left} DÍAS`}`}
            </ThemedText>
            <ThemedText variant="display" size={20} style={{ color: '#fff' }}>
              {e.name}
            </ThemedText>
            <ThemedText size={13} style={{ color: '#ffffffd9' }}>
              {s.claimed ? `¡Insignia «${e.badge}» conseguida!` : e.goal}
            </ThemedText>
          </View>
          <Ionicons name={s.claimed ? 'checkmark-circle' : 'chevron-forward'} size={22} color="#fff" />
        </View>
        {!s.claimed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ProgressBar pct={(s.progress / s.target) * 100} height={6} color="#fff" />
            </View>
            <ThemedText variant="bold" size={12} style={{ color: '#fff' }}>
              {`${s.progress}/${s.target}`}
            </ThemedText>
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 18, padding: 16, gap: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: '#ffffffcc', letterSpacing: 1 },
});
