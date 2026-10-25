// Dibujo isométrico de tu ciudad (SVG) con arrastre y zoom.
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import type { CityItem, CityState } from '@/types';
import { type Building, type DecorKind, SKIES } from '@/utils/city';

const TW = 64; // ancho de una casilla
const TH = 32; // alto de una casilla
const FLOOR = 9; // alto de cada planta
const TOP = 150; // margen de arriba para los edificios altos

type Pt = [number, number];
const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export type IsoCityHandle = { zoom: (factor: number) => void; center: () => void };

type Props = {
  city: CityState;
  buildings: Building[];
  placing: boolean;
  selected: { x: number; y: number } | null;
  onTapTile: (x: number, y: number) => void;
  onTapBuilding: (b: Building) => void;
  onTapItem: (item: CityItem) => void;
};

function geometry(size: number) {
  const W = size * TW + 40;
  const H = size * TH + TOP + 30;
  const origin = (x: number, y: number): Pt => [(x - y) * (TW / 2) + W / 2, (x + y) * (TH / 2) + TOP];
  const center = (x: number, y: number): Pt => {
    const [px, py] = origin(x, y);
    return [px, py + TH / 2];
  };
  return { W, H, origin, center };
}

const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

// Caja isométrica: cara de arriba, izquierda y derecha.
function box(cx: number, cy: number, hw: number, hh: number, height: number) {
  const L: Pt = [cx - hw, cy];
  const B: Pt = [cx, cy + hh];
  const R: Pt = [cx + hw, cy];
  const T: Pt = [cx, cy - hh];
  const up = (p: Pt): Pt => [p[0], p[1] - height];
  return {
    top: [up(T), up(R), up(B), up(L)] as Pt[],
    left: [L, B, up(B), up(L)] as Pt[],
    right: [B, R, up(R), up(B)] as Pt[],
    L,
    B,
    R,
    T,
    up,
  };
}

// Ventanas de un edificio en un solo trazado (para que pinte rápido aunque haya muchos).
function windowsPath(cx: number, cy: number, hw: number, hh: number, floors: number) {
  let d = '';
  const face = (from: Pt, to: Pt) => {
    for (let f = 0; f < floors; f++) {
      const z1 = f * FLOOR + 3;
      const z2 = z1 + 4;
      for (const [t1, t2] of [
        [0.18, 0.42],
        [0.58, 0.82],
      ]) {
        const p = (t: number, z: number): Pt => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - z];
        const q = [p(t1, z1), p(t2, z1), p(t2, z2), p(t1, z2)];
        d += `M${q.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
      }
    }
  };
  face([cx - hw, cy], [cx, cy + hh]);
  face([cx, cy + hh], [cx + hw, cy]);
  return d;
}

const BuildingShape = memo(function BuildingShape({
  b,
  cx,
  cy,
  night,
  selected,
}: {
  b: Building;
  cx: number;
  cy: number;
  night: boolean;
  selected: boolean;
}) {
  const hw = (TW / 2) * 0.72;
  const hh = (TH / 2) * 0.72;
  const height = b.floors * FLOOR + 6;
  const g = box(cx, cy, hw, hh, height);
  if (b.construction) {
    // En obras: andamio y grúa.
    const base = box(cx, cy, hw, hh, height * 0.45);
    const crane = g.up(g.R);
    return (
      <G>
        <Polygon points={pts(base.left)} fill="#9aa3ad" />
        <Polygon points={pts(base.right)} fill="#7d8690" />
        <Polygon points={pts(base.top)} fill="#c2c9d0" />
        <Path
          d={`M${g.L[0]} ${g.L[1]}L${g.up(g.L)[0]} ${g.up(g.L)[1]}M${g.B[0]} ${g.B[1]}L${g.up(g.B)[0]} ${g.up(g.B)[1]}M${g.R[0]} ${g.R[1]}L${crane[0]} ${crane[1]}`}
          stroke="#f59e0b"
          strokeWidth={2}
        />
        <Path
          d={`M${crane[0]} ${crane[1]}L${crane[0] - 34} ${crane[1] - 6}M${crane[0] - 30} ${crane[1] - 5}L${crane[0] - 30} ${crane[1] + 16}`}
          stroke="#f59e0b"
          strokeWidth={2}
        />
        <Rect x={crane[0] - 34} y={crane[1] + 14} width={8} height={6} fill="#6b4f2a" />
      </G>
    );
  }
  const sat = b.gold ? 70 : 52;
  const light = night || b.level >= 1;
  const roof = g.up(g.T);
  return (
    <G>
      <Polygon points={pts(g.left)} fill={b.gold ? '#b8860b' : hsl(b.hue, sat, 38)} />
      <Polygon points={pts(g.right)} fill={b.gold ? '#8b6508' : hsl(b.hue, sat, 28)} />
      <Polygon
        points={pts(g.top)}
        fill={b.gold ? '#ffd700' : hsl(b.hue, sat, 58)}
        stroke={selected ? '#fff' : 'none'}
        strokeWidth={2}
      />
      <Path d={windowsPath(cx, cy, hw, hh, b.floors)} fill={light ? '#ffe28a' : hsl(b.hue, 30, 78)} opacity={0.9} />
      {b.level >= 2 ? (
        <Path
          d={`M${roof[0]} ${roof[1] + hh}L${roof[0]} ${roof[1] + hh - 16}`}
          stroke={night ? '#ff4d6d' : '#555'}
          strokeWidth={2}
        />
      ) : null}
      {b.level >= 2 ? <Circle cx={roof[0]} cy={roof[1] + hh - 17} r={2.2} fill="#ff4d6d" /> : null}
      {b.level >= 3 ? (
        <Polygon
          points={pts(box(roof[0], roof[1] + hh, hw * 0.45, hh * 0.45, 8).top)}
          fill="#ffd700"
          stroke="#fff3b0"
          strokeWidth={1}
        />
      ) : null}
      {b.gold ? (
        <G>
          <Path d={`M${g.up(g.L)[0] + 6} ${g.up(g.L)[1]}l0 -16`} stroke="#fff" strokeWidth={1.5} />
          <Polygon
            points={pts([
              [g.up(g.L)[0] + 6, g.up(g.L)[1] - 16],
              [g.up(g.L)[0] + 16, g.up(g.L)[1] - 12],
              [g.up(g.L)[0] + 6, g.up(g.L)[1] - 8],
            ])}
            fill="#e5484d"
          />
        </G>
      ) : null}
    </G>
  );
});

function Decor({ kind, cx, cy, night }: { kind: DecorKind; cx: number; cy: number; night: boolean }) {
  switch (kind) {
    case 'tree':
      return (
        <G>
          <Rect x={cx - 2} y={cy - 14} width={4} height={12} fill="#7a4b26" />
          <Circle cx={cx} cy={cy - 20} r={10} fill="#3fa34d" />
          <Circle cx={cx - 5} cy={cy - 15} r={7} fill="#4cbb5a" />
        </G>
      );
    case 'pine':
      return (
        <G>
          <Rect x={cx - 2} y={cy - 8} width={4} height={8} fill="#7a4b26" />
          <Polygon
            points={pts([
              [cx, cy - 34],
              [cx + 10, cy - 14],
              [cx - 10, cy - 14],
            ])}
            fill="#1f7a3a"
          />
          <Polygon
            points={pts([
              [cx, cy - 26],
              [cx + 12, cy - 6],
              [cx - 12, cy - 6],
            ])}
            fill="#2a9147"
          />
        </G>
      );
    case 'flowers':
      return (
        <G>
          {[
            [-8, -2, '#ff5fa2'],
            [6, -4, '#ffd23f'],
            [-2, 3, '#a66bff'],
            [9, 3, '#ff7a45'],
            [-10, 4, '#4dc9ff'],
          ].map(([dx, dy, col], i) => (
            <Circle key={i} cx={cx + (dx as number)} cy={cy + (dy as number)} r={3} fill={col as string} />
          ))}
        </G>
      );
    case 'bench':
      return (
        <G>
          <Polygon
            points={pts([
              [cx - 12, cy - 4],
              [cx + 2, cy + 3],
              [cx + 2, cy - 1],
              [cx - 12, cy - 8],
            ])}
            fill="#a0662f"
          />
          <Polygon
            points={pts([
              [cx - 12, cy - 8],
              [cx + 2, cy - 1],
              [cx + 2, cy - 7],
              [cx - 12, cy - 14],
            ])}
            fill="#8a5524"
          />
        </G>
      );
    case 'lamp':
      return (
        <G>
          {night ? <Circle cx={cx} cy={cy - 26} r={12} fill="#ffe28a" opacity={0.35} /> : null}
          <Rect x={cx - 1.2} y={cy - 26} width={2.4} height={26} fill="#3a3f47" />
          <Circle cx={cx} cy={cy - 27} r={4} fill={night ? '#fff3b0' : '#e8e2c4'} />
        </G>
      );
    case 'pond':
      return (
        <G>
          <Ellipse cx={cx} cy={cy} rx={22} ry={10} fill="#3aa0e0" />
          <Ellipse cx={cx - 5} cy={cy - 2} rx={9} ry={3} fill="#8fd3ff" opacity={0.7} />
          <Circle cx={cx + 8} cy={cy - 1} r={3} fill="#ffd23f" />
        </G>
      );
    case 'fountain':
      return (
        <G>
          <Ellipse cx={cx} cy={cy} rx={18} ry={8} fill="#9aa3ad" />
          <Ellipse cx={cx} cy={cy - 2} rx={14} ry={6} fill="#4db8ff" />
          <Rect x={cx - 2} y={cy - 18} width={4} height={16} fill="#c2c9d0" />
          <Path
            d={`M${cx} ${cy - 18}q-10 -6 -12 6M${cx} ${cy - 18}q10 -6 12 6`}
            stroke="#bfe8ff"
            strokeWidth={2}
            fill="none"
          />
        </G>
      );
    case 'neon':
      return (
        <G>
          <Rect x={cx - 1.5} y={cy - 22} width={3} height={22} fill="#333" />
          <Rect
            x={cx - 14}
            y={cy - 40}
            width={28}
            height={18}
            rx={3}
            fill="#1a1036"
            stroke={night ? '#ff4dd2' : '#c13fa0'}
            strokeWidth={2}
          />
          <SvgText
            x={cx}
            y={cy - 27}
            fontSize={10}
            fontWeight="bold"
            fill={night ? '#5ff' : '#2bb'}
            textAnchor="middle"
          >
            GG
          </SvgText>
        </G>
      );
    case 'arcade': {
      const g = box(cx, cy, 8, 4, 22);
      return (
        <G>
          <Polygon points={pts(g.left)} fill="#6a2fd6" />
          <Polygon points={pts(g.right)} fill="#4b1fa0" />
          <Polygon points={pts(g.top)} fill="#8a55ff" />
          <Polygon
            points={pts([
              [g.L[0] + 2, g.L[1] - 18],
              [g.B[0] - 1, g.B[1] - 15],
              [g.B[0] - 1, g.B[1] - 8],
              [g.L[0] + 2, g.L[1] - 11],
            ])}
            fill={night ? '#5fffd0' : '#2fd1a0'}
          />
        </G>
      );
    }
    case 'statue':
      return (
        <G>
          {(() => {
            const g = box(cx, cy, 10, 5, 8);
            return (
              <>
                <Polygon points={pts(g.left)} fill="#8d939b" />
                <Polygon points={pts(g.right)} fill="#6f757d" />
                <Polygon points={pts(g.top)} fill="#b5bbc3" />
              </>
            );
          })()}
          <Rect x={cx - 4} y={cy - 30} width={8} height={18} rx={3} fill="#e0b13a" />
          <Circle cx={cx} cy={cy - 34} r={5} fill="#f2c94c" />
          <Path d={`M${cx + 4} ${cy - 26}l7 -10`} stroke="#e0b13a" strokeWidth={3} />
        </G>
      );
    case 'monument': {
      const g = box(cx, cy, 9, 4.5, 42);
      return (
        <G>
          <Polygon points={pts(g.left)} fill="#d8d2c4" />
          <Polygon points={pts(g.right)} fill="#b9b2a2" />
          <Polygon points={pts(g.top)} fill="#efe9db" />
          <Path d={`M${cx - 7} ${cy - 56}h14l-3 8h-8z`} fill="#ffd700" />
          <Rect x={cx - 1.5} y={cy - 48} width={3} height={4} fill="#ffd700" />
        </G>
      );
    }
    default:
      return null;
  }
}

const Scene = memo(function Scene({
  city,
  buildings,
  selected,
  placing,
}: {
  city: CityState;
  buildings: Building[];
  selected: { x: number; y: number } | null;
  placing: boolean;
}) {
  const { W, H, origin, center } = geometry(city.size);
  const night = SKIES[city.sky ?? 'day']?.night ?? false;
  const occupied = new Set([...buildings.map((b) => `${b.x},${b.y}`), ...city.items.map((i) => `${i.x},${i.y}`)]);
  // Suelo: casillas en tablero de hierba (y libres resaltadas al colocar).
  let grassA = '';
  let grassB = '';
  let pave = '';
  let free = '';
  for (let x = 0; x < city.size; x++)
    for (let y = 0; y < city.size; y++) {
      const [px, py] = origin(x, y);
      const d = `M${px} ${py}L${px + TW / 2} ${py + TH / 2}L${px} ${py + TH}L${px - TW / 2} ${py + TH / 2}Z`;
      const key = `${x},${y}`;
      if (buildings.some((b) => b.x === x && b.y === y)) pave += d;
      else if (placing && !occupied.has(key)) free += d;
      else if ((x + y) % 2) grassA += d;
      else grassB += d;
    }
  // Borde del terreno (grosor de la isla).
  const [lx, ly] = origin(0, city.size);
  const [bx, by] = origin(city.size, city.size);
  const [rx, ry] = origin(city.size, 0);
  const drawables = [
    ...buildings.map((b) => ({ order: b.x + b.y, key: `b${b.game.game.id}`, b })),
    ...city.items.map((i) => ({ order: i.x + i.y, key: `i${i.id}`, i })),
  ].sort((a, b) => a.order - b.order);
  return (
    <Svg width={W} height={H}>
      <Polygon
        points={pts([
          [lx, ly],
          [bx, by],
          [bx, by + 14],
          [lx, ly + 14],
        ])}
        fill={night ? '#3b2a1e' : '#8b5a2b'}
      />
      <Polygon
        points={pts([
          [bx, by],
          [rx, ry],
          [rx, ry + 14],
          [bx, by + 14],
        ])}
        fill={night ? '#2c1f16' : '#6e4520'}
      />
      <Path d={grassA} fill={night ? '#24503a' : '#6cc46a'} />
      <Path d={grassB} fill={night ? '#2a5c43' : '#7bd27a'} />
      <Path d={pave} fill={night ? '#3d4450' : '#b9c0c9'} />
      {free ? <Path d={free} fill="#ffe066" stroke="#f5a524" strokeWidth={1} /> : null}
      {selected
        ? (() => {
            const [px, py] = origin(selected.x, selected.y);
            return (
              <Polygon
                points={pts([
                  [px, py],
                  [px + TW / 2, py + TH / 2],
                  [px, py + TH],
                  [px - TW / 2, py + TH / 2],
                ])}
                fill="none"
                stroke="#fff"
                strokeWidth={2.5}
              />
            );
          })()
        : null}
      {drawables.map((d) => {
        if ('b' in d && d.b) {
          const [cx, cy] = center(d.b.x, d.b.y);
          return (
            <BuildingShape
              key={d.key}
              b={d.b}
              cx={cx}
              cy={cy}
              night={night}
              selected={selected?.x === d.b.x && selected?.y === d.b.y}
            />
          );
        }
        const it = (d as { i: CityItem }).i;
        const [cx, cy] = center(it.x, it.y);
        return <Decor key={d.key} kind={it.kind as DecorKind} cx={cx} cy={cy} night={night} />;
      })}
    </Svg>
  );
});

// Estrellas fijas para los cielos de noche.
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  top: `${(i * 29) % 55}%`,
  size: 1 + (i % 3),
}));

export const IsoCity = forwardRef<IsoCityHandle, Props>(function IsoCity(
  { city, buildings, placing, selected, onTapTile, onTapBuilding, onTapItem },
  ref,
) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const { W, H, origin, center } = useMemo(() => geometry(city.size), [city.size]);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const sky = SKIES[city.sky ?? 'day'] ?? SKIES.day;

  const fit = (w: number) => Math.max(0.35, Math.min(1.2, (w - 20) / W));
  useImperativeHandle(ref, () => ({
    zoom: (f) => scale.set(withTiming(Math.max(0.3, Math.min(3, scale.get() * f)), { duration: 180 })),
    center: () => {
      tx.set(withTiming(0, { duration: 220 }));
      ty.set(withTiming(0, { duration: 220 }));
      scale.set(withTiming(fit(box.w), { duration: 220 }));
    },
  }));

  // Al colocar decoración se acerca un poco para que las casillas se puedan tocar bien.
  useEffect(() => {
    if (placing && scale.get() < 0.9) scale.set(withTiming(0.9, { duration: 220 }));
  }, [placing, scale]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box.w) scale.set(fit(width));
    setBox({ w: width, h: height });
  };

  // Del toque en pantalla a la casilla (o el edificio) que hay debajo.
  const tap = (sx: number, sy: number) => {
    const s = scale.get();
    const px = (sx - box.w / 2 - tx.get()) / s + W / 2;
    const py = (sy - box.h / 2 - ty.get()) / s + H / 2;
    if (!placing) {
      const hw = (TW / 2) * 0.72;
      const hh = (TH / 2) * 0.72;
      const front = [...buildings].sort((a, b) => b.x + b.y - (a.x + a.y));
      for (const b of front) {
        const [cx, cy] = center(b.x, b.y);
        const top = cy - hh - b.floors * FLOOR - 10;
        if (px >= cx - hw && px <= cx + hw && py >= top && py <= cy + hh) return onTapBuilding(b);
      }
    }
    const u = (px - W / 2) / (TW / 2);
    const v = (py - TOP) / (TH / 2);
    const x = Math.floor((u + v) / 2);
    const y = Math.floor((v - u) / 2);
    if (x < 0 || y < 0 || x >= city.size || y >= city.size) return;
    const item = city.items.find((i) => i.x === x && i.y === y);
    if (item && !placing) return onTapItem(item);
    const b = buildings.find((bb) => bb.x === x && bb.y === y);
    if (b && !placing) return onTapBuilding(b);
    onTapTile(x, y);
  };
  void origin;

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      startX.set(tx.get());
      startY.set(ty.get());
    })
    .onUpdate((e) => {
      tx.set(startX.get() + e.translationX);
      ty.set(startY.get() + e.translationY);
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get());
    })
    .onUpdate((e) => {
      scale.set(Math.max(0.3, Math.min(3, startScale.get() * e.scale)));
    });
  const tapG = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e, ok) => {
      if (ok) runOnJS(tap)(e.x, e.y);
    });
  const gesture = Gesture.Race(tapG, Gesture.Simultaneous(pan, pinch));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <View style={styles.root} onLayout={onLayout} accessibilityLabel="Mapa de tu ciudad">
      <LinearGradient colors={sky.colors} style={StyleSheet.absoluteFill} />
      {sky.night
        ? STARS.map((s, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: s.left as `${number}%`,
                top: s.top as `${number}%`,
                width: s.size,
                height: s.size,
                borderRadius: s.size,
                backgroundColor: '#fff',
                opacity: 0.8,
              }}
            />
          ))
        : null}
      {city.sky === 'synth' ? <View style={styles.sun} /> : null}
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          {box.w ? (
            <Animated.View
              style={[
                { position: 'absolute', width: W, height: H, left: (box.w - W) / 2, top: (box.h - H) / 2 },
                style,
              ]}
            >
              <Scene city={city} buildings={buildings} selected={selected} placing={placing} />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', borderRadius: 18 },
  sun: {
    position: 'absolute',
    alignSelf: 'center',
    top: '8%',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffb86b',
    opacity: 0.85,
  },
});
