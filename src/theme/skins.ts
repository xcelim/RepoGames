import type { SkinId } from '@/types';

export type Skin = {
  id: SkinId;
  name: string;
  subtitle: string;
  dark: boolean;
  colors: {
    bg: string;
    panel: string;
    panel2: string;
    line: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
    onAccent: string;
  };
  fonts: {
    display: string;
    body: string;
    bodyBold: string;
  };
  radius: number;
  borderWidth: number;
  upper: boolean;
  displayScale: number;
};

export const SKINS: Record<SkinId, Skin> = {
  neon: {
    id: 'neon',
    name: 'Neón',
    subtitle: 'Cyberpunk · Persona',
    dark: true,
    colors: {
      bg: '#0b0a12',
      panel: '#15131f',
      panel2: '#1e1b2c',
      line: '#2f2b42',
      text: '#f2eef8',
      muted: '#9d97b3',
      accent: '#ff2a4d',
      accent2: '#2ef2ff',
      onAccent: '#0b0a12',
    },
    fonts: {
      display: 'ChakraPetch_700Bold_Italic',
      body: 'ChakraPetch_400Regular',
      bodyBold: 'ChakraPetch_700Bold',
    },
    radius: 0,
    borderWidth: 0,
    upper: true,
    displayScale: 1,
  },
  cozy: {
    id: 'cozy',
    name: 'Cozy',
    subtitle: 'Granja · isla tranquila',
    dark: false,
    colors: {
      bg: '#f4ecdc',
      panel: '#fffaf0',
      panel2: '#f0e4cc',
      line: '#e0cfae',
      text: '#4b3a29',
      muted: '#8a755c',
      accent: '#5e9e5f',
      accent2: '#e98f5c',
      onAccent: '#fffaf0',
    },
    fonts: { display: 'Fredoka_600SemiBold', body: 'Nunito_400Regular', bodyBold: 'Nunito_700Bold' },
    radius: 22,
    borderWidth: 2,
    upper: false,
    displayScale: 0.95,
  },
  gameboy: {
    id: 'gameboy',
    name: 'Game Boy',
    subtitle: 'Retro 8-bit',
    dark: false,
    colors: {
      bg: '#9bbc0f',
      panel: '#8bac0f',
      panel2: '#7d9c0d',
      line: '#0f380f',
      text: '#0f380f',
      muted: '#306230',
      accent: '#0f380f',
      accent2: '#306230',
      onAccent: '#9bbc0f',
    },
    fonts: { display: 'PressStart2P_400Regular', body: 'VT323_400Regular', bodyBold: 'VT323_400Regular' },
    radius: 0,
    borderWidth: 4,
    upper: true,
    displayScale: 0.55,
  },
  teyvat: {
    id: 'teyvat',
    name: 'Teyvat',
    subtitle: 'Fantasía · oro y cielo',
    dark: true,
    colors: {
      bg: '#0d1630',
      panel: '#151f3d',
      panel2: '#1c294d',
      line: '#8a7440',
      text: '#f4ebd7',
      muted: '#a8b0c8',
      accent: '#e9c46b',
      accent2: '#8fd3ff',
      onAccent: '#0d1630',
    },
    fonts: { display: 'Cinzel_700Bold', body: 'Lato_400Regular', bodyBold: 'Lato_700Bold' },
    radius: 10,
    borderWidth: 1,
    upper: true,
    displayScale: 0.85,
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    subtitle: 'Atardecer arcade',
    dark: true,
    colors: {
      bg: '#190a2c',
      panel: '#22103c',
      panel2: '#2d164f',
      line: '#4c2a7a',
      text: '#ffe8fa',
      muted: '#c3a5da',
      accent: '#ff4fd8',
      accent2: '#ffb547',
      onAccent: '#190a2c',
    },
    fonts: { display: 'Audiowide_400Regular', body: 'Rajdhani_500Medium', bodyBold: 'Rajdhani_700Bold' },
    radius: 6,
    borderWidth: 1,
    upper: true,
    displayScale: 0.8,
  },
  hud: {
    id: 'hud',
    name: 'Visor HUD',
    subtitle: 'Sci-fi · escáner',
    dark: true,
    colors: {
      bg: '#041016',
      panel: '#071c24',
      panel2: '#0b2731',
      line: '#15495a',
      text: '#d9fbff',
      muted: '#6fa7b4',
      accent: '#3ff0ff',
      accent2: '#ffb03f',
      onAccent: '#041016',
    },
    fonts: { display: 'Orbitron_700Bold', body: 'Rajdhani_500Medium', bodyBold: 'Rajdhani_700Bold' },
    radius: 2,
    borderWidth: 1,
    upper: true,
    displayScale: 0.75,
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    subtitle: 'Kawaii · caramelo',
    dark: false,
    colors: {
      bg: '#fff0f6',
      panel: '#ffffff',
      panel2: '#ffe4f0',
      line: '#ffc8de',
      text: '#5a3a5e',
      muted: '#a07ba3',
      accent: '#ff5c9d',
      accent2: '#5ccfbe',
      onAccent: '#ffffff',
    },
    fonts: { display: 'Baloo2_700Bold', body: 'Nunito_400Regular', bodyBold: 'Nunito_700Bold' },
    radius: 28,
    borderWidth: 2,
    upper: false,
    displayScale: 0.95,
  },
};

export const SKIN_LIST = Object.values(SKINS);
