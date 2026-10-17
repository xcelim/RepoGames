import { StyleSheet, View } from 'react-native';

import { useSkin } from '@/theme/useSkin';

import { ThemedText } from './ThemedText';

type DurationBarProps = { label: string; hours: number; max: number; color: string };

export function DurationBar({ label, hours, max, color }: DurationBarProps) {
  const skin = useSkin();
  const percent = max > 0 ? (hours / max) * 100 : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ThemedText>{label}</ThemedText>
        <ThemedText variant="bold">{hours} h</ThemedText>
      </View>
      <View
        style={[styles.track, { backgroundColor: skin.colors.panel2, borderRadius: skin.radius / 4 }]}
      >
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, overflow: 'hidden' },
  fill: { height: '100%' },
});
