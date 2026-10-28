// El pueblo dibujado a píxeles: hierba, árboles, edificios, decoración y la barra de producción.
// Todo va en un único SVG (rápido) y encima hay casillas tocables.
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

import type { CityBuilding, CityState } from '@/types';
import { BUILDINGS, buildingAt, decorAt, hasTree, hash01, inside, placeError } from '@/utils/world';
import { type SpriteName, spriteStrokes } from '@/utils/sprites';

export type Mode = { kind: 'idle' } | { kind: 'build'; building: string } | { kind: 'decor'; item: string };
export type Cell = { x: number; y: number };

const PX = 16; // unidades de sprite por casilla
const GRASS = '#4f8f3a';

// Qué sprite dibujar para cada edificio (la choza cambia con el nivel).
export function spriteOf(b: CityBuilding): SpriteName {
  if (b.kind === 'hut') return b.level >= 3 ? 'hut3' : b.level === 2 ? 'hut2' : 'hut1';
  return b.kind as SpriteName;
}

// Hierba con matitas y alguna flor, fija para cada mapa (seed).
function groundPaths(size: number, seed: number) {
  let dark = '';
  let light = '';
  let flowers = '';
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      const ox = x * PX;
      const oy = y * PX;
      for (let k = 0; k < 5; k++) {
        const r = hash01(seed + k * 17, x, y);
        const px = ox + Math.floor(hash01(seed + k * 31, y, x) * 15);
        const py = oy + Math.floor(r * 15);
        if (k % 2 === 0) dark += `M${px} ${py}h1v1h-1z`;
        else light += `M${px} ${py}h1v1h-1z`;
      }
      if (hash01(seed + 991, x, y) < 0.08) {
        const fx = ox + 3 + Math.floor(hash01(seed + 7, x, y) * 9);
        const fy = oy + 3 + Math.floor(hash01(seed + 11, x, y) * 9);
        flowers += `M${fx} ${fy}h2v2h-2z`;
      }
    }
  return { dark, light, flowers };
}

type MapProps = {
  st: CityState;
  width: number;
  mode: Mode;
  selected: Cell | null;
  onCell: (x: number, y: number) => void;
};

// Solo cambia cuando cambia lo que se ve (no con cada segundo de producción).
export const WorldMap = memo(function WorldMap({ st, width, mode, selected, onCell }: MapProps) {
  const size = st.size;
  const cell = width / size;
  const ground = useMemo(() => groundPaths(size, st.seed), [size, st.seed]);

  const trees = useMemo(() => {
    const out: Cell[] = [];
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) if (hasTree(st, x, y)) out.push({ x, y });
    return out;
  }, [st, size]);

  // Casillas donde cabe lo que estás colocando.
  const valid = useMemo(() => {
    if (mode.kind === 'idle') return null;
    const out: Cell[] = [];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        const ok =
          mode.kind === 'build'
            ? placeError(st, mode.building, x, y) === null
            : inside(st, x, y) && !buildingAt(st, x, y) && !decorAt(st, x, y) && !hasTree(st, x, y);
        if (ok) out.push({ x, y });
      }
    return out;
  }, [st, mode, size]);

  return (
    <View style={{ width, height: width }}>
      <Svg width={width} height={width} viewBox={`0 0 ${size * PX} ${size * PX}`}>
        <Rect x={0} y={0} width={size * PX} height={size * PX} fill={GRASS} />
        <Path d={ground.dark} fill="#2f6b28" />
        <Path d={ground.light} fill="#72b555" />
        <Path d={ground.flowers} fill="#e8548c" />
        {valid?.map((c) => (
          <Rect
            key={`v${c.x},${c.y}`}
            x={c.x * PX}
            y={c.y * PX}
            width={PX}
            height={PX}
            fill="#9dff8a"
            fillOpacity={0.28}
          />
        ))}
        {trees.map((c) => (
          <Sprite key={`t${c.x},${c.y}`} name="tree" x={c.x} y={c.y} />
        ))}
        {st.buildings.map((b) => (
          <Sprite key={b.id} name={spriteOf(b)} x={b.x} y={b.y} />
        ))}
        {st.items.map((i) => (
          <Sprite key={i.id} name={i.kind as SpriteName} x={i.x} y={i.y} />
        ))}
        {/* Aldeanos trabajando, de pie delante de su edificio. */}
        {st.buildings.flatMap((b) =>
          Array.from({ length: b.workers }, (_, i) => (
            <Sprite key={`w${b.id}${i}`} name="villager" x={b.x} y={b.y} dx={2 + i * 5} dy={9} />
          )),
        )}
      </Svg>

      {/* Casillas tocables encima del dibujo. */}
      {Array.from({ length: size * size }, (_, n) => {
        const x = n % size;
        const y = Math.floor(n / size);
        const isSel = selected?.x === x && selected?.y === y;
        return (
          <Pressable
            key={`c${x},${y}`}
            onPress={() => onCell(x, y)}
            style={[
              styles.cell,
              { left: x * cell, top: y * cell, width: cell, height: cell },
              isSel && styles.selected,
            ]}
            accessibilityLabel={`Casilla ${x + 1}, ${y + 1}`}
          />
        );
      })}
    </View>
  );
});

// Un sprite de 16×16 colocado en una casilla (dx, dy: desplazamiento en unidades).
const Sprite = memo(function Sprite({ name, x, y, dx = 0, dy = 0 }: { name: SpriteName; x: number; y: number; dx?: number; dy?: number }) {
  const strokes = spriteStrokes(name);
  return (
    <G x={x * PX + dx} y={y * PX + dy}>
      {strokes.map((s, i) => (
        <Path key={i} fill={s.fill} d={s.d} />
      ))}
    </G>
  );
});

// Barras de producción (van por fuera del SVG para que se muevan cada segundo).
export function ProductionBars({ st, width }: { st: CityState; width: number }) {
  const cell = width / st.size;
  return (
    <>
      {st.buildings.map((b) => {
        const prod = BUILDINGS[b.kind]?.produce;
        if (!prod || b.workers <= 0) return null;
        const pct = Math.min(1, b.progress / prod.every);
        return (
          <View
            key={b.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: b.x * cell + cell * 0.12,
              top: b.y * cell + cell * 0.9,
              width: cell * 0.76,
              height: Math.max(3, cell * 0.08),
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${pct * 100}%`,
                height: '100%',
                backgroundColor: prod.res === 'gold' ? '#f2c230' : prod.res === 'wood' ? '#c99256' : '#8fd3ff',
              }}
            />
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  cell: { position: 'absolute' },
  selected: { borderWidth: 2, borderColor: '#f2c230', borderRadius: 2 },
});

