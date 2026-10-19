import { Pressable, StyleSheet, View } from 'react-native';

import { useSkin } from '@/theme/useSkin';

import { ThemedText } from './ThemedText';

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const skin = useSkin();

  return (
    <View
      style={[
        styles.group,
        {
          backgroundColor: skin.colors.panel,
          borderColor: skin.colors.line,
          borderRadius: skin.radius,
        },
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && { backgroundColor: skin.colors.accent }]}
          >
            <ThemedText variant="bold" size={13} style={active ? { color: skin.colors.onAccent } : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden', alignSelf: 'flex-start' },
  item: { paddingVertical: 8, paddingHorizontal: 12 },
});
