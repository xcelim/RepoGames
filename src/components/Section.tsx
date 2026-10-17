import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSkin } from '@/theme/useSkin';

import { ThemedText } from './ThemedText';

type SectionProps = { title: string; children: ReactNode };

export function Section({ title, children }: SectionProps) {
  const skin = useSkin();

  return (
    <View style={styles.section}>
      <ThemedText variant="bold" size={12} style={[styles.title, { color: skin.colors.accent2 }]}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { letterSpacing: 2 },
});
