import { Text, type TextProps } from 'react-native';

import { useSkin } from '@/theme/useSkin';

type ThemedTextProps = TextProps & {
  variant?: 'display' | 'body' | 'bold' | 'muted';
  size?: number;
};

export function ThemedText({ variant = 'body', size = 15, style, ...rest }: ThemedTextProps) {
  const skin = useSkin();
  const isDisplay = variant === 'display';

  let fontFamily = skin.fonts.body;
  if (isDisplay) fontFamily = skin.fonts.display;
  if (variant === 'bold') fontFamily = skin.fonts.bodyBold;

  return (
    <Text
      // Con la letra del sistema muy grande, la app se descuadra: se permite crecer, pero con límite.
      maxFontSizeMultiplier={1.25}
      {...rest}
      style={[
        {
          color: variant === 'muted' ? skin.colors.muted : skin.colors.text,
          fontFamily,
          fontSize: isDisplay ? size * skin.displayScale : size,
          textTransform: isDisplay && skin.upper ? 'uppercase' : 'none',
        },
        style,
      ]}
    />
  );
}
