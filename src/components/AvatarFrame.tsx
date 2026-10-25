// Foto de perfil con su marco de nivel (los 30 marcos de src/theme/frames.ts).
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { FRAMES, type FrameSpec, type Ornament } from '@/theme/frames';

function hex(c: string): [number, number, number] {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
function colorAt(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0];
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}

function ornament(type: Ornament, u: number, color: string, color2: string): ReactElement {
  switch (type) {
    case 'dots':
      return <Circle cx={0} cy={0} r={u * 0.32} fill={color} />;
    case 'gems':
      return (
        <G>
          <Path
            d={`M0 ${-u * 0.6} L${u * 0.45} 0 L0 ${u * 0.6} L${-u * 0.45} 0 Z`}
            fill={color2}
            stroke={color}
            strokeWidth={u * 0.12}
          />
          <Path d={`M0 ${-u * 0.4} L${u * 0.18} 0 L0 ${-u * 0.05} Z`} fill={color} opacity={0.9} />
        </G>
      );
    case 'stars':
      return (
        <Path
          d={`M0 ${-u * 0.55} L${u * 0.14} ${-u * 0.14} L${u * 0.55} 0 L${u * 0.14} ${u * 0.14} L0 ${u * 0.55} L${-u * 0.14} ${u * 0.14} L${-u * 0.55} 0 L${-u * 0.14} ${-u * 0.14} Z`}
          fill={color}
        />
      );
    case 'spikes':
      // Apunta hacia fuera (eje -y = hacia fuera tras la rotación)
      return (
        <Path
          d={`M${-u * 0.28} ${u * 0.2} L0 ${-u * 0.7} L${u * 0.28} ${u * 0.2} Z`}
          fill={color}
          stroke={color2}
          strokeWidth={u * 0.06}
        />
      );
    case 'notches':
      return <Path d={`M${-u * 0.08} ${-u * 0.35} H${u * 0.08} V${u * 0.35} H${-u * 0.08} Z`} fill={color} />;
    case 'leaves':
      return (
        <G>
          <Path
            d={`M0 ${u * 0.3} C${u * 0.45} ${-u * 0.1} ${u * 0.25} ${-u * 0.55} 0 ${-u * 0.7} C${-u * 0.25} ${-u * 0.55} ${-u * 0.45} ${-u * 0.1} 0 ${u * 0.3} Z`}
            fill={color}
            stroke={color2}
            strokeWidth={u * 0.06}
          />
          <Path d={`M0 ${u * 0.25} L0 ${-u * 0.55}`} stroke={color2} strokeWidth={u * 0.05} />
        </G>
      );
    case 'flames':
      return (
        <G>
          <Path
            d={`M0 ${-u * 0.85} C${u * 0.15} ${-u * 0.45} ${u * 0.45} ${-u * 0.25} ${u * 0.35} ${u * 0.15} C${u * 0.28} ${u * 0.4} ${-u * 0.28} ${u * 0.4} ${-u * 0.35} ${u * 0.15} C${-u * 0.42} ${-u * 0.15} ${-u * 0.1} ${-u * 0.35} 0 ${-u * 0.85} Z`}
            fill={color}
          />
          <Path
            d={`M0 ${-u * 0.35} C${u * 0.12} ${-u * 0.15} ${u * 0.2} 0 ${u * 0.14} ${u * 0.18} C${u * 0.05} ${u * 0.28} ${-u * 0.12} ${u * 0.26} ${-u * 0.15} ${u * 0.12} C${-u * 0.18} 0 ${-u * 0.05} ${-u * 0.15} 0 ${-u * 0.35} Z`}
            fill={color2}
          />
        </G>
      );
  }
}

function FrameSvg({ spec, size, total }: { spec: FrameSpec; size: number; total: number }) {
  const c = total / 2;
  const w = Math.max(3, size * spec.width * 1.35);
  const r = size / 2 + w / 2;
  const gid = `fg-${spec.name.replace(/\W/g, '')}`;
  const segs = useMemo(() => {
    if (!spec.segments) return [];
    const n = 48;
    return Array.from({ length: n }, (_, i) => ({
      d: arc(c, c, r, (i / n) * Math.PI * 2 - 0.01, ((i + 1) / n) * Math.PI * 2 + 0.01),
      color: colorAt(spec.stops, i / n),
    }));
  }, [spec, c, r]);
  const u = size * (spec.orn?.size ?? 1) * 0.12;
  const ornR = spec.orn?.type === 'notches' ? r : r + w / 2 + u * 0.15;

  return (
    <Svg width={total} height={total}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          {spec.stops.map((s, i) => (
            <Stop key={i} offset={i / Math.max(1, spec.stops.length - 1)} stopColor={s} />
          ))}
        </LinearGradient>
      </Defs>
      {spec.glow ? (
        <Circle cx={c} cy={c} r={r + w * 0.6} fill="none" stroke={spec.glow} strokeWidth={w * 2.2} opacity={0.18} />
      ) : null}
      {spec.double ? (
        <Circle
          cx={c}
          cy={c}
          r={r + w / 2 + 1.5}
          fill="none"
          stroke={spec.inner ?? spec.stops[0]}
          strokeWidth={1.2}
          opacity={0.8}
        />
      ) : null}
      {spec.segments ? (
        segs.map((s, i) => <Path key={i} d={s.d} stroke={s.color} strokeWidth={w} fill="none" />)
      ) : (
        <Circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={w} />
      )}
      {spec.double ? (
        <Circle cx={c} cy={c} r={r - w / 2 + 0.8} fill="none" stroke={spec.inner ?? '#fff'} strokeWidth={1.4} />
      ) : null}
      {spec.orn
        ? Array.from({ length: spec.orn.count }, (_, i) => {
            const a = (i / spec.orn!.count) * 360;
            return (
              <G key={i} transform={`translate(${c} ${c}) rotate(${a}) translate(0 ${-ornR})`}>
                {ornament(spec.orn!.type, u, spec.orn!.color, spec.orn!.color2 ?? spec.stops[0])}
              </G>
            );
          })
        : null}
      {spec.crown ? (
        <G transform={`translate(${c} ${c - r - w / 2 - size * 0.05})`}>
          <Path
            d={`M${-size * 0.13} ${size * 0.04} L${-size * 0.15} ${-size * 0.08} L${-size * 0.06} ${-size * 0.02} L0 ${-size * 0.12} L${size * 0.06} ${-size * 0.02} L${size * 0.15} ${-size * 0.08} L${size * 0.13} ${size * 0.04} Z`}
            fill={spec.crown}
            stroke="#5a4200"
            strokeWidth={0.8}
          />
          <Circle cx={0} cy={-size * 0.12} r={size * 0.018} fill="#ff4d6d" />
        </G>
      ) : null}
    </Svg>
  );
}

// Brillo que gira sobre el aro.
function ShimmerRing({ size, total, width }: { size: number; total: number; width: number }) {
  const c = total / 2;
  const w = Math.max(3, size * width * 1.35);
  const r = size / 2 + w / 2;
  return (
    <Svg width={total} height={total}>
      <Path
        d={arc(c, c, r, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35)}
        stroke="#ffffff"
        strokeWidth={w * 0.7}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
    </Svg>
  );
}

export function AvatarFrame({ frame, size, children }: { frame: number | null; size: number; children: ReactNode }) {
  const spec = frame != null && frame >= 0 ? FRAMES[frame] : null;
  const pad = spec
    ? size * (spec.width * 1.35 + (spec.orn ? 0.16 : 0.05) + (spec.crown ? 0.1 : 0)) + (spec.glow ? 6 : 2)
    : 0;
  const total = size + pad * 2;
  const [t] = useState(() => new Animated.Value(0));
  const anim = spec?.anim;

  useEffect(() => {
    if (!anim || Platform.OS === 'web') return; // en la web van con animaciones CSS (más fluidas)
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: anim === 'pulse' ? 1800 : anim === 'shimmer' ? 2600 : 9000,
        easing: anim === 'pulse' ? Easing.inOut(Easing.sin) : Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, t]);

  if (!spec) return <View style={{ width: size, height: size }}>{children}</View>;

  const spin = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerSpin = t.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', anim === 'shimmer' ? '360deg' : '-720deg'],
  });
  const pulse = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });
  const spins = anim === 'spin' || anim === 'spin+shimmer';
  const shimmers = anim === 'shimmer' || anim === 'spin+shimmer';
  const web = Platform.OS === 'web';
  const frameStyle = web
    ? spins && !spec.crown
      ? cssSpin(9000)
      : anim === 'pulse'
        ? cssPulse(1800)
        : null
    : { transform: [spins && !spec.crown ? { rotate: spin } : { scale: anim === 'pulse' ? pulse : 1 }] };
  const shimmerStyle = web
    ? cssSpin(anim === 'shimmer' ? 2600 : 4500, anim !== 'shimmer')
    : { transform: [{ rotate: shimmerSpin }] };

  return (
    <View style={{ width: total, height: total, alignItems: 'center', justifyContent: 'center' }}>
      <Spinner
        pointerEvents="none"
        style={[{ position: 'absolute', width: total, height: total }, frameStyle as object]}
      >
        <FrameSvg spec={spec} size={size} total={total} />
      </Spinner>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>{children}</View>
      {shimmers ? (
        <Spinner
          pointerEvents="none"
          style={[{ position: 'absolute', width: total, height: total }, shimmerStyle as object]}
        >
          <ShimmerRing size={size} total={total} width={spec.width} />
        </Spinner>
      ) : null}
    </View>
  );
}

// En la web, una View normal (Animated.View descarta las animaciones CSS).
const Spinner = (Platform.OS === 'web' ? View : Animated.View) as typeof Animated.View;

// Animaciones CSS para la web (las hace el navegador, no se paran aunque la app esté ocupada).
// Los @keyframes están en src/web/frame.ts.
function cssSpin(ms: number, reverse = false): object {
  return {
    animationName: reverse ? 'sq-spin-rev' : 'sq-spin',
    animationDuration: `${ms}ms`,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  };
}
function cssPulse(ms: number): object {
  return {
    animationName: 'sq-pulse',
    animationDuration: `${ms}ms`,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  };
}
