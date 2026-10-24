import type { SkinId } from '@/types';

import type { Skin } from './skins';

// Decoración de cada estética: dibujos de fondo minimalistas y el marco de las portadas.
// Son formas sencillas inspiradas en el ambiente de cada juego (hojas, estrellas, cristales...),
// nunca logos ni personajes.

export type Motif =
  | 'leaf'
  | 'star'
  | 'sparkle'
  | 'triangle'
  | 'ring'
  | 'hex'
  | 'crystal'
  | 'cloud'
  | 'wave'
  | 'pixel'
  | 'bubble'
  | 'splat'
  | 'flame'
  | 'bolt'
  | 'moon'
  | 'gear'
  | 'note'
  | 'flower'
  | 'mushroom'
  | 'heart'
  | 'snow'
  | 'rune'
  | 'circuit'
  | 'tetro'
  | 'dot'
  | 'feather'
  | 'sword'
  | 'diamond'
  | 'block'
  | 'grass'
  | 'drop'
  | 'shield'
  | 'peak'
  | 'sun'
  | 'ember'
  | 'shard'
  | 'butterfly'
  | 'halo';

export type Frame = 'thin' | 'double' | 'glow' | 'pixel' | 'offset' | 'corners' | 'rounded' | 'notch' | 'hud';

export type Pattern = 'grid' | 'scanlines' | 'dots' | 'diagonal' | 'halftone' | null;

export type Decor = {
  motifs: Motif[];
  colors: ('accent' | 'accent2' | 'text' | 'muted' | string)[];
  count: number;
  size: [number, number];
  opacity: number;
  big?: {
    motif: Motif;
    size: number;
    corner: 'tr' | 'tl' | 'br' | 'bl';
    outline?: boolean;
    color?: string;
    opacity?: number;
  };
  pattern?: Pattern;
  rotate?: boolean;
  outline?: boolean; // dibujos de solo contorno
  frame: Frame;
  frameColor?: 'accent' | 'accent2' | 'line' | 'text' | string;
};

const D = (d: Decor) => d;

export const DECOR: Record<SkinId, Decor> = {
  // ----- Originales -----
  neon: D({
    motifs: ['sparkle', 'bolt'],
    colors: ['accent', 'accent2'],
    count: 9,
    size: [10, 20],
    opacity: 0.16,
    pattern: 'grid',
    big: { motif: 'shard', size: 260, corner: 'tr', outline: true },
    frame: 'glow',
    frameColor: 'accent',
  }),
  cozy: D({
    motifs: ['leaf', 'flower'],
    colors: ['accent', 'accent2'],
    count: 10,
    size: [14, 24],
    opacity: 0.14,
    rotate: true,
    big: { motif: 'leaf', size: 240, corner: 'br', outline: true },
    frame: 'rounded',
    frameColor: 'accent',
  }),
  gameboy: D({
    motifs: ['pixel', 'heart'],
    colors: ['accent', 'text'],
    count: 10,
    size: [10, 18],
    opacity: 0.14,
    pattern: 'dots',
    frame: 'pixel',
    frameColor: 'text',
  }),
  teyvat: D({
    motifs: ['sparkle', 'crystal', 'feather'],
    colors: ['accent', 'accent2'],
    count: 10,
    size: [12, 22],
    opacity: 0.15,
    rotate: true,
    big: { motif: 'star', size: 280, corner: 'tr', outline: true },
    frame: 'corners',
    frameColor: 'accent',
  }),
  synthwave: D({
    motifs: ['sparkle', 'triangle'],
    colors: ['accent', 'accent2'],
    count: 8,
    size: [10, 18],
    opacity: 0.18,
    pattern: 'grid',
    big: { motif: 'sun', size: 230, corner: 'tr' },
    frame: 'glow',
    frameColor: 'accent2',
  }),
  hud: D({
    motifs: ['circuit', 'hex'],
    colors: ['accent'],
    count: 9,
    size: [16, 28],
    opacity: 0.14,
    pattern: 'scanlines',
    big: { motif: 'hex', size: 260, corner: 'tr', outline: true },
    frame: 'hud',
    frameColor: 'accent',
  }),
  pastel: D({
    motifs: ['bubble', 'flower', 'star'],
    colors: ['accent', 'accent2'],
    count: 12,
    size: [12, 22],
    opacity: 0.18,
    rotate: true,
    frame: 'rounded',
    frameColor: 'accent2',
  }),

  // ----- Inspiradas en videojuegos -----
  hyrule: D({
    motifs: ['triangle', 'leaf', 'sparkle'],
    colors: ['accent', 'accent2'],
    count: 11,
    size: [10, 20],
    opacity: 0.13,
    rotate: true,
    outline: true,
    big: { motif: 'triangle', size: 300, corner: 'tr', outline: true },
    frame: 'corners',
    frameColor: 'accent',
  }),
  sheikah: D({
    motifs: ['rune', 'circuit', 'hex'],
    colors: ['accent'],
    count: 10,
    size: [16, 30],
    opacity: 0.16,
    big: { motif: 'ring', size: 300, corner: 'tr', outline: true },
    frame: 'glow',
    frameColor: 'accent',
  }),
  dreamland: D({
    motifs: ['star', 'sparkle', 'cloud'],
    colors: ['accent', 'accent2'],
    count: 13,
    size: [12, 26],
    opacity: 0.2,
    rotate: true,
    big: { motif: 'star', size: 260, corner: 'tr', opacity: 0.12 },
    frame: 'rounded',
    frameColor: 'accent',
  }),
  mushroom: D({
    motifs: ['mushroom', 'cloud', 'ring'],
    colors: ['accent', 'accent2'],
    count: 10,
    size: [16, 28],
    opacity: 0.16,
    big: { motif: 'cloud', size: 260, corner: 'tr', color: '#ffffff', opacity: 0.7 },
    frame: 'offset',
    frameColor: 'accent',
  }),
  metaverse: D({
    motifs: ['star', 'shard'],
    colors: ['accent', 'text'],
    count: 10,
    size: [14, 30],
    opacity: 0.14,
    rotate: true,
    pattern: 'halftone',
    big: { motif: 'shard', size: 300, corner: 'tr' },
    frame: 'offset',
    frameColor: 'accent',
  }),
  velvet: D({
    motifs: ['butterfly', 'sparkle'],
    colors: ['accent', 'accent2'],
    count: 9,
    size: [14, 24],
    opacity: 0.16,
    rotate: true,
    big: { motif: 'moon', size: 240, corner: 'tr', outline: true },
    frame: 'thin',
    frameColor: 'accent',
  }),
  fodlan: D({
    motifs: ['sword', 'diamond', 'sparkle'],
    colors: ['accent'],
    count: 9,
    size: [14, 24],
    opacity: 0.13,
    rotate: true,
    big: { motif: 'shield', size: 280, corner: 'tr', outline: true },
    frame: 'corners',
    frameColor: 'accent',
  }),
  crystal: D({
    motifs: ['crystal', 'sparkle'],
    colors: ['accent', 'accent2'],
    count: 11,
    size: [12, 26],
    opacity: 0.16,
    rotate: true,
    big: { motif: 'crystal', size: 300, corner: 'tr', outline: true },
    frame: 'glow',
    frameColor: 'accent',
  }),
  midgar: D({
    motifs: ['gear', 'bolt'],
    colors: ['accent', 'accent2'],
    count: 8,
    size: [16, 28],
    opacity: 0.13,
    pattern: 'diagonal',
    big: { motif: 'gear', size: 280, corner: 'tr', outline: true },
    frame: 'notch',
    frameColor: 'accent',
  }),
  alrest: D({
    motifs: ['cloud', 'hex', 'sparkle'],
    colors: ['accent', 'accent2'],
    count: 10,
    size: [14, 28],
    opacity: 0.14,
    big: { motif: 'cloud', size: 300, corner: 'bl', outline: true },
    frame: 'rounded',
    frameColor: 'accent2',
  }),
  zebes: D({
    motifs: ['bubble', 'hex', 'dot'],
    colors: ['accent', 'accent2'],
    count: 11,
    size: [10, 22],
    opacity: 0.15,
    pattern: 'scanlines',
    big: { motif: 'ring', size: 260, corner: 'tr', outline: true },
    frame: 'hud',
    frameColor: 'accent',
  }),
  hallownest: D({
    motifs: ['drop', 'dot', 'sparkle'],
    colors: ['text', 'accent2'],
    count: 14,
    size: [6, 14],
    opacity: 0.16,
    big: { motif: 'moon', size: 260, corner: 'tr', outline: true },
    frame: 'thin',
    frameColor: 'text',
  }),
  summit: D({
    motifs: ['snow', 'feather', 'sparkle'],
    colors: ['accent', 'accent2', 'text'],
    count: 12,
    size: [10, 20],
    opacity: 0.18,
    rotate: true,
    big: { motif: 'peak', size: 320, corner: 'bl' },
    frame: 'pixel',
    frameColor: 'accent',
  }),
  pelican: D({
    motifs: ['leaf', 'grass', 'flower'],
    colors: ['accent', 'accent2'],
    count: 11,
    size: [14, 24],
    opacity: 0.16,
    rotate: true,
    big: { motif: 'sun', size: 220, corner: 'tr', opacity: 0.12 },
    frame: 'rounded',
    frameColor: 'accent2',
  }),
  island: D({
    motifs: ['leaf', 'leaf', 'flower'],
    colors: ['accent', 'accent2'],
    count: 14,
    size: [14, 26],
    opacity: 0.2,
    rotate: true,
    big: { motif: 'leaf', size: 260, corner: 'br', opacity: 0.1 },
    frame: 'rounded',
    frameColor: 'accent',
  }),
  blocks: D({
    motifs: ['block', 'pixel'],
    colors: ['accent', 'accent2'],
    count: 10,
    size: [16, 28],
    opacity: 0.14,
    pattern: 'dots',
    frame: 'pixel',
    frameColor: 'accent',
  }),
  kanto: D({
    motifs: ['flame', 'drop', 'leaf', 'bolt'],
    colors: ['#e3350d', '#3b8bff', '#3fae49', '#f5b800'],
    count: 12,
    size: [14, 22],
    opacity: 0.18,
    rotate: true,
    frame: 'rounded',
    frameColor: 'accent',
  }),
  inkopolis: D({
    motifs: ['splat', 'drop'],
    colors: ['accent', 'accent2'],
    count: 10,
    size: [18, 40],
    opacity: 0.2,
    rotate: true,
    big: { motif: 'splat', size: 300, corner: 'tr', opacity: 0.16 },
    frame: 'offset',
    frameColor: 'accent2',
  }),
  greenhill: D({
    motifs: ['ring', 'sparkle'],
    colors: ['accent'],
    count: 11,
    size: [12, 22],
    opacity: 0.2,
    outline: true,
    big: { motif: 'ring', size: 280, corner: 'tr', outline: true },
    frame: 'thin',
    frameColor: 'accent',
  }),
  ring: D({
    motifs: ['hex', 'sparkle'],
    colors: ['accent', 'accent2'],
    count: 8,
    size: [14, 24],
    opacity: 0.13,
    pattern: 'scanlines',
    big: { motif: 'halo', size: 420, corner: 'tr', outline: true },
    frame: 'hud',
    frameColor: 'accent',
  }),
  inferno: D({
    motifs: ['flame', 'ember'],
    colors: ['accent', 'accent2'],
    count: 11,
    size: [10, 24],
    opacity: 0.16,
    big: { motif: 'flame', size: 300, corner: 'br', opacity: 0.1 },
    frame: 'notch',
    frameColor: 'accent',
  }),
  lordran: D({
    motifs: ['ember', 'sword'],
    colors: ['accent', 'muted'],
    count: 12,
    size: [6, 18],
    opacity: 0.18,
    rotate: true,
    big: { motif: 'flame', size: 240, corner: 'bl', outline: true },
    frame: 'corners',
    frameColor: 'accent',
  }),
  underground: D({
    motifs: ['heart', 'star'],
    colors: ['accent', 'accent2'],
    count: 7,
    size: [10, 16],
    opacity: 0.2,
    frame: 'pixel',
    frameColor: 'text',
  }),
  falling: D({
    motifs: ['tetro'],
    colors: ['#00e0e0', '#f0a000', '#a000f0', '#00d000', '#f00000', '#f0f000'],
    count: 10,
    size: [20, 32],
    opacity: 0.18,
    rotate: true,
    frame: 'pixel',
    frameColor: 'line',
  }),
  maze: D({
    motifs: ['dot'],
    colors: ['accent', 'accent2'],
    count: 18,
    size: [5, 12],
    opacity: 0.3,
    big: { motif: 'dot', size: 140, corner: 'tr', opacity: 0.08 },
    frame: 'double',
    frameColor: '#2121de',
  }),
};

export function decorColor(skin: Skin, key: string): string {
  if (key === 'accent') return skin.colors.accent;
  if (key === 'accent2') return skin.colors.accent2;
  if (key === 'text') return skin.colors.text;
  if (key === 'muted') return skin.colors.muted;
  if (key === 'line') return skin.colors.line;
  return key;
}
