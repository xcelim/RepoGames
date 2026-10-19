// Dibujos de fondo de cada estética (minimalistas, muy suaves, no se pueden tocar).
import { memo, useMemo, type ReactElement } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg';

import { DECOR, decorColor, type Decor, type Motif } from '@/theme/decor';
import type { Skin } from '@/theme/skins';
import { useSkin } from '@/theme/useSkin';

type Paint = { fill: string; stroke: string; sw: number };

// Cada dibujo en una caja de 24×24.
export function shape(m: Motif, p: Paint): ReactElement {
  const solid = {
    fill: p.fill,
    stroke: p.stroke,
    strokeWidth: p.sw,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  const line = {
    fill: 'none',
    stroke: p.stroke === 'none' ? p.fill : p.stroke,
    strokeWidth: Math.max(p.sw, 1.6),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (m) {
    case 'leaf':
      return (
        <G>
          <Path d="M12 2C6 6 4 12 6 21c8-1 13-7 12-17-2-1-4-2-6-2z" {...solid} />
          <Path
            d="M7 20C9 15 12 10 16 5"
            {...line}
            stroke={p.fill === 'none' ? p.stroke : 'rgba(255,255,255,0.35)'}
            strokeWidth={1.2}
          />
        </G>
      );
    case 'star':
      return <Path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" {...solid} />;
    case 'sparkle':
      return <Path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" {...solid} />;
    case 'triangle':
      return <Path d="M12 3 L22 20 H2 Z" {...solid} />;
    case 'ring':
      return (
        <Circle
          cx={12}
          cy={12}
          r={9}
          fill="none"
          stroke={p.fill === 'none' ? p.stroke : p.fill}
          strokeWidth={p.fill === 'none' ? p.sw : 3}
        />
      );
    case 'hex':
      return <Path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z" {...solid} />;
    case 'crystal':
      return (
        <G>
          <Path d="M12 1 L18 9 L12 23 L6 9 Z" {...solid} />
          <Path d="M6 9 H18 M12 1 V23" {...line} strokeWidth={0.8} opacity={0.6} />
        </G>
      );
    case 'cloud':
      return <Path d="M6.5 19h11a4.5 4.5 0 0 0 .6-9 6 6 0 0 0-11.5 1.6A3.7 3.7 0 0 0 6.5 19z" {...solid} />;
    case 'wave':
      return <Path d="M1 12c3-4 5-4 8 0s5 4 8 0 5-4 6 0" {...line} />;
    case 'pixel':
      return (
        <G fill={p.fill === 'none' ? p.stroke : p.fill}>
          <Rect x={4} y={4} width={6} height={6} />
          <Rect x={14} y={4} width={6} height={6} opacity={0.6} />
          <Rect x={9} y={14} width={6} height={6} />
        </G>
      );
    case 'bubble':
      return (
        <G>
          <Circle
            cx={12}
            cy={12}
            r={9}
            fill="none"
            stroke={p.fill === 'none' ? p.stroke : p.fill}
            strokeWidth={Math.max(p.sw, 1.6)}
          />
          <Path d="M8 8.5a5 5 0 0 1 4-2" {...line} />
        </G>
      );
    case 'splat':
      return (
        <Path
          d="M12 3c2 0 2 3 4 3s3-2 5 0-1 3 0 5 3 3 1 5-3-1-4 1 1 4-2 4-2-2-4-2-3 3-5 1 1-3-1-4-4 0-4-2 3-2 2-4-3-3-1-5 3 1 4-1 0-3 3-3z"
          {...solid}
        />
      );
    case 'flame':
      return <Path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 2 4 0-3-1-6 1-9z" {...solid} />;
    case 'bolt':
      return <Path d="M13 1L4 14h7l-2 9 9-13h-7z" {...solid} />;
    case 'moon':
      return <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" {...solid} />;
    case 'gear': {
      const c = p.fill === 'none' ? p.stroke : p.fill;
      return (
        <G>
          <Circle cx={12} cy={12} r={6} fill="none" stroke={c} strokeWidth={Math.max(p.sw, 2)} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Rect key={a} x={10.8} y={1.5} width={2.4} height={4} fill={c} transform={`rotate(${a} 12 12)`} />
          ))}
        </G>
      );
    }
    case 'note':
      return <Path d="M9 18a3 3 0 1 1-2-2.8V4l12-2v13a3 3 0 1 1-2-2.8V6.5L9 8z" {...solid} />;
    case 'flower':
      return (
        <G>
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle key={a} cx={12} cy={6.5} r={4} {...solid} transform={`rotate(${a} 12 12)`} />
          ))}
          <Circle cx={12} cy={12} r={2.6} fill="rgba(255,255,255,0.55)" />
        </G>
      );
    case 'mushroom':
      return (
        <G>
          <Path d="M3 12a9 8 0 0 1 18 0z" {...solid} />
          <Path d="M9 12h6v6a3 3 0 0 1-6 0z" {...solid} opacity={0.7} />
          <Circle cx={8} cy={8.5} r={1.6} fill="rgba(255,255,255,0.7)" />
          <Circle cx={15} cy={7.5} r={2} fill="rgba(255,255,255,0.7)" />
        </G>
      );
    case 'heart':
      return <Path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" {...solid} />;
    case 'snow':
      return <Path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2 2m2-2l2 2M12 22l-2-2m2 2l2-2" {...line} />;
    case 'rune':
      return <Path d="M7 3v18M7 7l8-3M7 12l10 4M15 4v8M12 21l5-5" {...line} />;
    case 'circuit':
      return (
        <G>
          <Path d="M1 12h6l3-5h6l3 5h4" {...line} />
          <Circle cx={7} cy={12} r={1.8} fill={p.fill === 'none' ? p.stroke : p.fill} />
          <Circle cx={19} cy={12} r={1.8} fill={p.fill === 'none' ? p.stroke : p.fill} />
        </G>
      );
    case 'tetro':
      return (
        <G {...solid}>
          <Rect x={2} y={6} width={6.5} height={6.5} />
          <Rect x={8.75} y={6} width={6.5} height={6.5} />
          <Rect x={15.5} y={6} width={6.5} height={6.5} />
          <Rect x={8.75} y={12.75} width={6.5} height={6.5} />
        </G>
      );
    case 'dot':
      return <Circle cx={12} cy={12} r={5} {...solid} />;
    case 'feather':
      return (
        <G>
          <Path d="M20 3C11 4 5 10 5 19c7 0 13-6 15-16z" {...solid} />
          <Path
            d="M3 21L14 9"
            {...line}
            stroke={p.fill === 'none' ? p.stroke : 'rgba(255,255,255,0.4)'}
            strokeWidth={1.2}
          />
        </G>
      );
    case 'sword':
      return <Path d="M20 3l-10 10M6.5 13.5l4 4M8.5 15.5L4 20M20 3h-4m4 0v4" {...line} />;
    case 'diamond':
      return <Path d="M12 2 L20 12 L12 22 L4 12 Z" {...solid} />;
    case 'block':
      return (
        <G>
          <Path d="M12 2 L21 7 L12 12 L3 7 Z" {...solid} />
          <Path d="M3 7 V17 L12 22 V12 Z" {...solid} opacity={0.7} />
          <Path d="M21 7 V17 L12 22 V12 Z" {...solid} opacity={0.45} />
        </G>
      );
    case 'grass':
      return <Path d="M4 22C5 15 6 12 4 8M9 22C9 16 10 13 12 9M14 22c0-5 1-8 4-11M19 22c0-3 1-5 3-7" {...line} />;
    case 'drop':
      return <Path d="M12 2C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-13z" {...solid} />;
    case 'shield':
      return <Path d="M12 2 L20 5 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V5 Z" {...solid} />;
    case 'peak':
      return <Path d="M1 21 L9 7 L13 13 L16 9 L23 21 Z M9 7 L7.5 10 L10.5 10 Z" {...solid} />;
    case 'sun': {
      const c = p.fill === 'none' ? p.stroke : p.fill;
      return (
        <G>
          <Circle cx={12} cy={12} r={10} fill={c} />
          {[14, 16.5, 19, 21].map((y, i) => (
            <Rect key={y} x={1} y={y} width={22} height={0.6 + i * 0.35} fill="#000" opacity={0.35} />
          ))}
        </G>
      );
    }
    case 'ember':
      return <Path d="M12 5 L15 12 L12 19 L9 12 Z" {...solid} />;
    case 'shard':
      return <Path d="M3 2 L21 8 L14 22 L10 13 Z" {...solid} />;
    case 'butterfly':
      return (
        <G {...solid}>
          <Path d="M12 12C9 5 3 4 3 8s4 5 9 4z" />
          <Path d="M12 12c3-7 9-8 9-4s-4 5-9 4z" />
          <Path d="M12 12c-3 3-7 5-6 7s5-2 6-7zM12 12c3 3 7 5 6 7s-5-2-6-7z" opacity={0.75} />
        </G>
      );
    case 'halo':
      return (
        <G>
          <Path
            d="M2 14 A10 4 0 1 0 22 14 A10 4 0 1 0 2 14"
            fill="none"
            stroke={p.fill === 'none' ? p.stroke : p.fill}
            strokeWidth={p.sw}
          />
          <Path
            d="M3 14.6 A9 3.2 0 0 0 21 14.6"
            fill="none"
            stroke={p.fill === 'none' ? p.stroke : p.fill}
            strokeWidth={p.sw * 0.6}
            opacity={0.6}
          />
        </G>
      );
  }
}

// Generador pseudoaleatorio con semilla: los dibujos salen siempre en el mismo sitio.
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function PatternLayer({ decor, skin, w, h }: { decor: Decor; skin: Skin; w: number; h: number }) {
  const c = skin.colors.line;
  switch (decor.pattern) {
    case 'grid':
      return (
        <G opacity={0.35}>
          {/* Suelo en perspectiva abajo, a lo synthwave */}
          {Array.from({ length: 9 }, (_, i) => {
            const y = h - 230 + (i * i * 230) / 64;
            return (
              <Line
                key={`h${i}`}
                x1={0}
                y1={y}
                x2={w}
                y2={y}
                stroke={skin.colors.accent}
                strokeWidth={0.8}
                opacity={0.25 + i * 0.05}
              />
            );
          })}
          {Array.from({ length: 13 }, (_, i) => {
            const x = (w / 12) * i;
            return (
              <Line
                key={`v${i}`}
                x1={w / 2 + (x - w / 2) * 0.25}
                y1={h - 230}
                x2={w / 2 + (x - w / 2) * 2.2}
                y2={h}
                stroke={skin.colors.accent}
                strokeWidth={0.8}
                opacity={0.4}
              />
            );
          })}
        </G>
      );
    case 'scanlines':
      return (
        <G opacity={0.5}>
          <Defs>
            <Pattern id="scan" width={4} height={4} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={4} height={1} fill={c} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#scan)" opacity={0.35} />
        </G>
      );
    case 'dots':
      return (
        <G>
          <Defs>
            <Pattern id="dots" width={18} height={18} patternUnits="userSpaceOnUse">
              <Rect x={8} y={8} width={2} height={2} fill={c} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#dots)" opacity={0.6} />
        </G>
      );
    case 'diagonal':
      return (
        <G>
          <Defs>
            <Pattern id="diag" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Rect x={0} y={0} width={1} height={14} fill={c} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h * 0.45} fill="url(#diag)" opacity={0.35} />
        </G>
      );
    case 'halftone':
      return (
        <G>
          {Array.from({ length: 12 }, (_, row) =>
            Array.from({ length: 12 }, (_, col) => {
              const r = Math.max(0, 3.2 - (row + col) * 0.17);
              return r > 0.3 ? (
                <Circle
                  key={`${row}-${col}`}
                  cx={w - col * 14 - 6}
                  cy={row * 14 + 6}
                  r={r}
                  fill={skin.colors.text}
                  opacity={0.12}
                />
              ) : null;
            }),
          )}
        </G>
      );
    default:
      return null;
  }
}

function BackdropInner({ skin, w, h }: { skin: Skin; w: number; h: number }) {
  const decor = DECOR[skin.id];
  const items = useMemo(() => {
    if (!decor) return [];
    const rand = rng(skin.id);
    const out: { m: Motif; x: number; y: number; s: number; r: number; color: string }[] = [];
    let tries = 0;
    while (out.length < decor.count && tries < 400) {
      tries++;
      // Más dibujos en los bordes que en el centro, para no molestar al leer.
      const edge = rand() < 0.75;
      const x = edge ? (rand() < 0.5 ? rand() * w * 0.22 : w - rand() * w * 0.22) : rand() * w;
      const y = 70 + rand() * (h - 140);
      const s = (decor.size[0] + rand() * (decor.size[1] - decor.size[0])) * 1.3;
      if (out.some((o) => Math.hypot(o.x - x, o.y - y) < (o.s + s) * 1.6)) continue;
      out.push({
        m: decor.motifs[out.length % decor.motifs.length],
        x,
        y,
        s,
        r: decor.rotate ? rand() * 70 - 35 : 0,
        color: decorColor(skin, decor.colors[Math.floor(rand() * decor.colors.length)]),
      });
    }
    return out;
  }, [decor, skin, w, h]);

  if (!decor) return null;
  const big = decor.big;
  const bigPos = big
    ? {
        x: big.corner.includes('r') ? w - big.size * 0.28 : big.size * 0.28,
        y: big.corner.includes('t') ? big.size * 0.22 : h - big.size * 0.28,
      }
    : null;

  return (
    <Svg width={w} height={h}>
      <PatternLayer decor={decor} skin={skin} w={w} h={h} />
      {big && bigPos ? (
        <G
          opacity={Math.min(0.5, (big.opacity ?? (big.outline ? 0.16 : 0.1)) * 1.7)}
          transform={`translate(${bigPos.x} ${bigPos.y}) rotate(-12) scale(${big.size / 24}) translate(-12 -12)`}
        >
          {shape(big.motif, {
            fill: big.outline ? 'none' : decorColor(skin, big.color ?? 'accent'),
            stroke: big.outline ? decorColor(skin, big.color ?? 'accent') : 'none',
            sw: 1.6 / (big.size / 24),
          })}
        </G>
      ) : null}
      {items.map((it, i) => (
        <G
          key={i}
          opacity={Math.min(0.45, decor.opacity * 1.9)}
          transform={`translate(${it.x} ${it.y}) rotate(${it.r}) scale(${it.s / 24}) translate(-12 -12)`}
        >
          {shape(it.m, {
            fill: decor.outline ? 'none' : it.color,
            stroke: decor.outline ? it.color : 'none',
            sw: decor.outline ? 1.6 / (it.s / 24) : 0,
          })}
        </G>
      ))}
    </Svg>
  );
}

const MemoBackdrop = memo(BackdropInner);

export function Backdrop() {
  const skin = useSkin();
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <MemoBackdrop skin={skin} w={Math.round(width)} h={Math.round(height)} />
    </View>
  );
}
