import { Pressable, StyleSheet } from 'react-native';

import { useSkin } from '@/theme/useSkin';

import { ThemedText } from './ThemedText';

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
};

export function Button({ label, onPress, kind = 'primary' }: ButtonProps) {
  const skin = useSkin();
  const primary = kind === 'primary';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? skin.colors.accent : skin.colors.panel2,
          borderRadius: skin.radius,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <ThemedText variant="display" size={18} style={{ color: primary ? skin.colors.onAccent : skin.colors.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 12, paddingHorizontal: 18 },
});
