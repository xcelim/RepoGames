// Un sprite de 16×16 a cualquier tamaño (iconos de recursos, fichas de edificios…).
import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { type SpriteName, spriteStrokes } from '@/utils/sprites';

export const PixelSprite = memo(function PixelSprite({ name, size = 32 }: { name: SpriteName; size?: number }) {
  const strokes = spriteStrokes(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {strokes.map((s, i) => (
        <Path key={i} fill={s.fill} d={s.d} />
      ))}
    </Svg>
  );
});
