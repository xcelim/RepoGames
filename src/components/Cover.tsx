import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSkin } from '@/theme/useSkin';

type CoverProps = {
  color: string;
  color2: string;
  aspectRatio?: number;
  imageUrl?: string | null;
  children?: ReactNode;
};

export function Cover({ color, color2, aspectRatio = 16 / 10, imageUrl, children }: CoverProps) {
  const skin = useSkin();
  const colors: [string, string] =
    skin.id === 'gameboy' ? [skin.colors.panel, skin.colors.panel2] : [color, color2];

  return (
    <View style={[styles.cover, { aspectRatio }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: skin.colors.bg, opacity: skin.dark ? 0.35 : 0.15 },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', overflow: 'hidden' },
});
