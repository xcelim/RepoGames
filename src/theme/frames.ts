// Los 30 marcos de la foto de perfil. Se desbloquea uno cada 3 niveles.

export type Ornament = 'dots' | 'gems' | 'stars' | 'spikes' | 'notches' | 'leaves' | 'flames';

export type FrameSpec = {
  name: string;
  level: number;
  stops: string[]; // colores del aro (degradado)
  width: number; // grosor del aro (proporción del tamaño de la foto)
  segments?: boolean; // degradado alrededor de todo el aro (arcoíris, aurora...)
  double?: boolean; // aro doble
  inner?: string; // color del aro interior si es doble
  orn?: { type: Ornament; count: number; color: string; color2?: string; size?: number };
  crown?: string; // corona arriba (color)
  glow?: string; // halo de color
  anim?: 'spin' | 'shimmer' | 'pulse' | 'spin+shimmer';
};

const F = (f: FrameSpec) => f;

export const FRAMES: FrameSpec[] = [
  F({ name: 'Bronce', level: 3, stops: ['#7a4a20', '#e0a46a', '#8c5a2b'], width: 0.06 }),
  F({ name: 'Plata', level: 6, stops: ['#7d8794', '#f4f7fb', '#8e99a6'], width: 0.065 }),
  F({
    name: 'Oro',
    level: 9,
    stops: ['#a87300', '#ffe08a', '#b8860b'],
    width: 0.07,
    orn: { type: 'dots', count: 12, color: '#ffe08a' },
  }),
  F({ name: 'Platino', level: 12, stops: ['#7f93b2', '#ffffff', '#9fb2c9'], width: 0.07, anim: 'shimmer' }),
  F({
    name: 'Esmeralda',
    level: 15,
    stops: ['#0a5a40', '#4be3a5', '#0b6e4f'],
    width: 0.07,
    orn: { type: 'gems', count: 4, color: '#b9ffe3', color2: '#0b6e4f' },
  }),
  F({
    name: 'Zafiro',
    level: 18,
    stops: ['#0b1f66', '#5aa9ff', '#0d2c8c'],
    width: 0.07,
    orn: { type: 'gems', count: 4, color: '#cfe6ff', color2: '#0d2c8c' },
    anim: 'shimmer',
  }),
  F({
    name: 'Rubí',
    level: 21,
    stops: ['#5c0010', '#ff4d6d', '#7a0016'],
    width: 0.075,
    orn: { type: 'gems', count: 6, color: '#ffc2cf', color2: '#7a0016' },
    glow: '#ff4d6d',
  }),
  F({
    name: 'Amatista',
    level: 24,
    stops: ['#38115e', '#c387ff', '#4b1a7a'],
    width: 0.07,
    double: true,
    inner: '#e6ccff',
    orn: { type: 'gems', count: 6, color: '#efdcff', color2: '#4b1a7a' },
  }),
  F({
    name: 'Ámbar',
    level: 27,
    stops: ['#8a4600', '#ffc94d', '#a85b00'],
    width: 0.075,
    orn: { type: 'notches', count: 24, color: '#ffe7a6' },
    anim: 'shimmer',
  }),
  F({
    name: 'Jade',
    level: 30,
    stops: ['#155b41', '#9be7c4', '#1f6b4f'],
    width: 0.075,
    orn: { type: 'leaves', count: 8, color: '#9be7c4', color2: '#155b41' },
  }),
  F({
    name: 'Coral',
    level: 33,
    stops: ['#a33a58', '#ffb3a7', '#c94b6d'],
    width: 0.075,
    double: true,
    inner: '#ffe0da',
    orn: { type: 'dots', count: 16, color: '#ffd1c9' },
  }),
  F({
    name: 'Hielo',
    level: 36,
    stops: ['#6fc3e8', '#ffffff', '#bfefff'],
    width: 0.075,
    orn: { type: 'spikes', count: 12, color: '#dff6ff', color2: '#6fc3e8' },
    glow: '#9ad7ff',
    anim: 'shimmer',
  }),
  F({
    name: 'Fuego',
    level: 39,
    stops: ['#c62828', '#ffd54d', '#ff3d00'],
    width: 0.08,
    orn: { type: 'flames', count: 10, color: '#ff9100', color2: '#ffd54d' },
    glow: '#ff6d00',
    anim: 'pulse',
  }),
  F({
    name: 'Tormenta',
    level: 42,
    stops: ['#1a1d45', '#8ea2ff', '#2b2f6b'],
    width: 0.075,
    double: true,
    inner: '#c9d3ff',
    orn: { type: 'spikes', count: 8, color: '#fff3a0', color2: '#8ea2ff' },
    glow: '#8ea2ff',
    anim: 'pulse',
  }),
  F({
    name: 'Bosque',
    level: 45,
    stops: ['#244a24', '#a3d977', '#2e5d2e'],
    width: 0.08,
    orn: { type: 'leaves', count: 12, color: '#a3d977', color2: '#244a24' },
  }),
  F({
    name: 'Obsidiana',
    level: 48,
    stops: ['#000000', '#5a5a6e', '#0b0b0f'],
    width: 0.085,
    orn: { type: 'gems', count: 8, color: '#d9b3ff', color2: '#6b2fb3' },
    glow: '#b467ff',
    anim: 'shimmer',
  }),
  F({
    name: 'Perla',
    level: 51,
    stops: ['#d8cbbd', '#ffffff', '#efe6dc'],
    width: 0.075,
    orn: { type: 'dots', count: 20, color: '#ffffff', size: 1.3 },
    anim: 'shimmer',
  }),
  F({
    name: 'Noche estrellada',
    level: 54,
    stops: ['#070c2b', '#3b4bb5', '#0b1440'],
    width: 0.085,
    orn: { type: 'stars', count: 10, color: '#fff2a8' },
    glow: '#3b4bb5',
    anim: 'spin',
  }),
  F({
    name: 'Aurora',
    level: 57,
    stops: ['#2ef2a0', '#2ec5ff', '#b467ff', '#2ef2a0'],
    width: 0.085,
    segments: true,
    glow: '#2ec5ff',
    anim: 'spin',
  }),
  F({
    name: 'Lava',
    level: 60,
    stops: ['#2b0a00', '#ff5a1f', '#ffcf4d', '#ff5a1f', '#2b0a00'],
    width: 0.09,
    segments: true,
    orn: { type: 'flames', count: 8, color: '#ff5a1f', color2: '#ffcf4d' },
    glow: '#ff5a1f',
    anim: 'pulse',
  }),
  F({
    name: 'Neón',
    level: 63,
    stops: ['#ff2a6d', '#05d9e8', '#ff2a6d'],
    width: 0.07,
    segments: true,
    double: true,
    inner: '#05d9e8',
    glow: '#ff2a6d',
    anim: 'spin',
  }),
  F({
    name: 'Cobalto real',
    level: 66,
    stops: ['#002a70', '#3d7bff', '#003e9e'],
    width: 0.085,
    double: true,
    inner: '#ffd34d',
    orn: { type: 'dots', count: 12, color: '#ffd34d' },
    crown: '#ffd34d',
  }),
  F({
    name: 'Holográfico',
    level: 69,
    stops: ['#ffd6f6', '#c9f0ff', '#d9ffd6', '#fff6c9', '#e6d6ff', '#ffd6f6'],
    width: 0.09,
    segments: true,
    anim: 'spin+shimmer',
  }),
  F({
    name: 'Iridiscente',
    level: 72,
    stops: ['#ff9ad5', '#9ad7ff', '#b6ffa8', '#fff2a8', '#c9a8ff', '#ff9ad5'],
    width: 0.095,
    segments: true,
    glow: '#c9a8ff',
    orn: { type: 'dots', count: 18, color: '#ffffff' },
    anim: 'spin+shimmer',
  }),
  F({
    name: 'Galaxia',
    level: 75,
    stops: ['#1b0033', '#6a00f4', '#ff4ecd', '#00c2ff', '#1b0033'],
    width: 0.095,
    segments: true,
    orn: { type: 'stars', count: 14, color: '#ffffff' },
    glow: '#6a00f4',
    anim: 'spin',
  }),
  F({
    name: 'Prisma',
    level: 78,
    stops: ['#ff3b3b', '#ffb03b', '#fff23b', '#3bff6e', '#3bc4ff', '#8f3bff', '#ff3b3b'],
    width: 0.09,
    segments: true,
    orn: { type: 'spikes', count: 16, color: '#ffffff', color2: '#c9d6ff' },
    anim: 'spin+shimmer',
  }),
  F({
    name: 'Dorado real',
    level: 81,
    stops: ['#8a6400', '#fff1a8', '#b8860b', '#fff1a8', '#8a6400'],
    width: 0.1,
    double: true,
    inner: '#fff1a8',
    orn: { type: 'gems', count: 8, color: '#ff8a9a', color2: '#9e0020' },
    crown: '#ffd34d',
    glow: '#ffd34d',
    anim: 'shimmer',
  }),
  F({
    name: 'Dragón',
    level: 84,
    stops: ['#3b0008', '#ff4d4d', '#ffd34d', '#ff4d4d', '#3b0008'],
    width: 0.1,
    segments: true,
    orn: { type: 'flames', count: 14, color: '#ff4d4d', color2: '#ffd34d' },
    glow: '#ff3d00',
    anim: 'pulse',
  }),
  F({
    name: 'Celestial',
    level: 87,
    stops: ['#ffffff', '#fff2a8', '#9ad7ff', '#ffffff'],
    width: 0.095,
    segments: true,
    double: true,
    inner: '#ffffff',
    orn: { type: 'stars', count: 18, color: '#fff7cc' },
    crown: '#ffffff',
    glow: '#ffffff',
    anim: 'spin+shimmer',
  }),
  F({
    name: 'Leyenda',
    level: 90,
    stops: ['#ff3b3b', '#ffd34d', '#3bff9e', '#3bc4ff', '#b467ff', '#ff3bd1', '#ff3b3b'],
    width: 0.11,
    segments: true,
    double: true,
    inner: '#ffd34d',
    orn: { type: 'stars', count: 12, color: '#ffd34d' },
    crown: '#ffd34d',
    glow: '#ffd34d',
    anim: 'spin+shimmer',
  }),
];

export const frameIndexForLevel = (level: number) => {
  let best = -1;
  FRAMES.forEach((f, i) => {
    if (level >= f.level) best = i;
  });
  return best;
};
