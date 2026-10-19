import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

// ---------- Icono de rejugado: flecha que da la vuelta con el número dentro ----------

export function ReplayBadge({ count, size = 34, dim }: { count: number; size?: number; dim?: boolean }) {
  const r = size / 2;
  const ring = r - 4;
  // Arco de ~300º con punta de flecha al final.
  const start = { x: r + ring * Math.cos(-Math.PI / 2 + 0.55), y: r + ring * Math.sin(-Math.PI / 2 + 0.55) };
  const end = { x: r + ring * Math.cos(-Math.PI / 2 - 0.35), y: r + ring * Math.sin(-Math.PI / 2 - 0.35) };
  const label = count > 99 ? '99+' : String(count);
  return (
    <View style={{ opacity: dim ? 0.55 : 1 }}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r - 0.5} fill="rgba(0,0,0,0.62)" />
        <Path
          d={`M ${start.x} ${start.y} A ${ring} ${ring} 0 1 1 ${end.x} ${end.y}`}
          stroke="#fff"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M ${end.x - 4.2} ${end.y - 2.6} L ${end.x + 0.6} ${end.y} L ${end.x - 2.2} ${end.y + 4.4}`}
          stroke="#fff"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <SvgText
          x={r}
          y={r + size * 0.13}
          fill="#fff"
          fontSize={label.length > 2 ? size * 0.26 : size * 0.36}
          fontWeight="bold"
          textAnchor="middle"
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}
