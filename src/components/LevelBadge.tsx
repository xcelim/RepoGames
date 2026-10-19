// Insignia de nivel (como la de Steam): cambia de color cada 10 niveles y de forma cada 50.
import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { levelColor } from '@/utils/level';

export function LevelBadge({ level, size = 34 }: { level: number; size?: number }) {
  const color = levelColor(level);
  const r = size / 2;
  const shape = Math.floor(level / 50) % 3;
  const hexPath =
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${i ? 'L' : 'M'}${r + (r - 1.5) * Math.cos(a)} ${r + (r - 1.5) * Math.sin(a)}`;
    }).join(' ') + ' Z';
  const diamond = `M${r} 1.5 L${size - 1.5} ${r} L${r} ${size - 1.5} L1.5 ${r} Z`;
  const label = String(level);
  return (
    <View>
      <Svg width={size} height={size}>
        {shape === 0 ? (
          <Circle cx={r} cy={r} r={r - 1.5} fill="rgba(0,0,0,0.35)" stroke={color} strokeWidth={2.5} />
        ) : (
          <Path d={shape === 1 ? hexPath : diamond} fill="rgba(0,0,0,0.35)" stroke={color} strokeWidth={2.5} />
        )}
        <SvgText
          x={r}
          y={r + size * (label.length > 2 ? 0.12 : 0.14)}
          fill="#ffffff"
          fontSize={label.length > 2 ? size * 0.32 : size * 0.4}
          fontWeight="bold"
          textAnchor="middle"
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}
