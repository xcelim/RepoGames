// Insignia de rango competitivo, dibujada por la app: más adornada cuanto más alto el rango.
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { rankedGame, tierInfo } from '@/data/ranks';
import type { CompetitiveRank } from '@/types';

import { ThemedText } from './ThemedText';

export function RankEmblem({ rank, size = 52 }: { rank: CompetitiveRank; size?: number }) {
  const { tier, level } = tierInfo(rank.game, rank.tier);
  const c1 = tier.color;
  const c2 = tier.color2 ?? tier.color;
  const id = `rk-${rank.game}-${tier.name.replace(/\W/g, '')}`;
  const s = size;
  // Escudo base
  const shield = `M${s * 0.5} ${s * 0.08} L${s * 0.86} ${s * 0.22} V${s * 0.52} C${s * 0.86} ${s * 0.74} ${s * 0.7} ${s * 0.86} ${s * 0.5} ${s * 0.95} C${s * 0.3} ${s * 0.86} ${s * 0.14} ${s * 0.74} ${s * 0.14} ${s * 0.52} V${s * 0.22} Z`;
  const wings = level >= 0.55;
  const crown = level >= 0.85;
  const stars = 1 + Math.round(level * 2);
  return (
    <View>
      <Svg width={s} height={s}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c2} />
            <Stop offset="0.5" stopColor={c1} />
            <Stop offset="1" stopColor={c1} stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        {wings ? (
          <G opacity={0.9}>
            <Path
              d={`M${s * 0.16} ${s * 0.32} L${s * 0.0} ${s * 0.2} L${s * 0.06} ${s * 0.48} L${s * 0.0} ${s * 0.52} L${s * 0.16} ${s * 0.64} Z`}
              fill={c1}
            />
            <Path
              d={`M${s * 0.84} ${s * 0.32} L${s} ${s * 0.2} L${s * 0.94} ${s * 0.48} L${s} ${s * 0.52} L${s * 0.84} ${s * 0.64} Z`}
              fill={c1}
            />
          </G>
        ) : null}
        <Path d={shield} fill={`url(#${id})`} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.2} />
        <Path
          d={`M${s * 0.5} ${s * 0.18} L${s * 0.76} ${s * 0.28} V${s * 0.5} C${s * 0.76} ${s * 0.66} ${s * 0.64} ${s * 0.76} ${s * 0.5} ${s * 0.83} C${s * 0.36} ${s * 0.76} ${s * 0.24} ${s * 0.66} ${s * 0.24} ${s * 0.5} V${s * 0.28} Z`}
          fill="rgba(0,0,0,0.28)"
        />
        {/* Estrellas según el rango */}
        {Array.from({ length: stars }, (_, i) => {
          const x = s * 0.5 + (i - (stars - 1) / 2) * s * 0.14;
          const y = s * 0.36;
          const u = s * 0.06;
          return (
            <Path
              key={i}
              d={`M${x} ${y - u} L${x + u * 0.3} ${y - u * 0.3} L${x + u} ${y} L${x + u * 0.3} ${y + u * 0.3} L${x} ${y + u} L${x - u * 0.3} ${y + u * 0.3} L${x - u} ${y} L${x - u * 0.3} ${y - u * 0.3} Z`}
              fill="#ffffff"
            />
          );
        })}
        {rank.division ? (
          <SvgText x={s * 0.5} y={s * 0.67} fill="#ffffff" fontSize={s * 0.2} fontWeight="bold" textAnchor="middle">
            {rank.division}
          </SvgText>
        ) : (
          <Circle cx={s * 0.5} cy={s * 0.6} r={s * 0.06} fill="#ffffff" opacity={0.85} />
        )}
        {crown ? (
          <Path
            d={`M${s * 0.36} ${s * 0.1} L${s * 0.4} ${s * 0.0} L${s * 0.45} ${s * 0.07} L${s * 0.5} ${s * -0.01} L${s * 0.55} ${s * 0.07} L${s * 0.6} ${s * 0.0} L${s * 0.64} ${s * 0.1} Z`}
            fill="#ffd34d"
          />
        ) : null}
      </Svg>
    </View>
  );
}

export function RankBadge({ rank, size = 52 }: { rank: CompetitiveRank; size?: number }) {
  const g = rankedGame(rank.game);
  const gameName = g && g.id !== 'other' ? g.short : rank.game.replace(/^other:/, '');
  return (
    <View style={{ alignItems: 'center', width: size + 26 }}>
      <RankEmblem rank={rank} size={size} />
      <ThemedText variant="bold" size={11} numberOfLines={1} style={{ marginTop: 4 }}>
        {rank.tier}
        {rank.division ? ` ${rank.division}` : ''}
      </ThemedText>
      <ThemedText variant="muted" size={10} numberOfLines={1}>
        {gameName}
      </ThemedText>
    </View>
  );
}
