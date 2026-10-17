import { Pressable, StyleSheet, View } from 'react-native';

import { useStore } from '@/store/useStore';
import { SKIN_LIST } from '@/theme/skins';
import { useSkin } from '@/theme/useSkin';

import { ThemedText } from './ThemedText';

export function SkinPicker() {
  const current = useSkin();
  const setSkin = useStore((s) => s.setSkin);

  return (
    <View style={styles.grid}>
      {SKIN_LIST.map((skin) => {
        const active = skin.id === current.id;
        return (
          <Pressable
            key={skin.id}
            onPress={() => setSkin(skin.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.tile,
              {
                borderColor: active ? current.colors.accent : current.colors.line,
                backgroundColor: current.colors.panel2,
              },
            ]}
          >
            <View style={[styles.preview, { backgroundColor: skin.colors.bg }]}>
              {[skin.colors.accent, skin.colors.accent2, skin.colors.text].map((color) => (
                <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
              ))}
            </View>
            <View style={styles.label}>
              <ThemedText variant="bold" size={14} style={{ fontFamily: skin.fonts.display }}>
                {skin.name}
              </ThemedText>
              <ThemedText variant="muted" size={11}>
                {skin.subtitle}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', borderWidth: 2, borderRadius: 12, overflow: 'hidden' },
  preview: { height: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: 8 },
  swatch: { width: 16, height: 16, borderRadius: 4 },
  label: { padding: 8 },
});
