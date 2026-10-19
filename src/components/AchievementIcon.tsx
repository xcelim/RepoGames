import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { Achievement } from '@/api/achievements';

// Icono de logro con borde plateado brillante.
export function AchievementIcon({ a, size }: { a: Achievement; size: number }) {
  const r = Math.max(6, size * 0.16);
  return (
    <View style={[styles.iconGlow, { width: size, height: size, borderRadius: r }]}>
      <LinearGradient
        colors={['#f6f9fd', '#a9b9d0', '#ffffff', '#7f93b2', '#9ad7ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
      />
      <View style={{ margin: 2.5, flex: 1, borderRadius: r - 2, overflow: 'hidden', backgroundColor: '#1b1f2a' }}>
        {a.image ? (
          <Image source={{ uri: a.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.noIcon}>
            <Ionicons name="trophy" size={size * 0.4} color="#cfd8e6" />
          </View>
        )}
        <LinearGradient
          colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconGlow: {
    shadowColor: '#9ad7ff',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  noIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
