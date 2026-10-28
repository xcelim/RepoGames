// Edificios a píxeles. Cada receta dibuja en una base de 32×32 (una casilla) y se escala según el
// tamaño del edificio (2×2, 3×3…). El nivel cambia materiales, tejados y adornos.
import { Canvas, OUTLINE, Painter, SHADOW } from './canvas';

type Wall = 'stone' | 'plank' | 'plaster' | 'brick';
type Roof = 'thatch' | 'tile' | 'slate' | 'wood';

// [base, luz, sombra, línea]
const WALL: Record<Wall, [string, string, string, string]> = {
  stone: ['#8f95a3', '#c4c9d4', '#5b6070', '#41454f'],
  plank: ['#9c6634', '#c08a57', '#6a4224', '#43291a'],
  plaster: ['#e6d8ba', '#fbf5e4', '#b3a180', '#6b4226'],
  brick: ['#a9552e', '#cf7a45', '#7a3a1f', '#5a2412'],
};
// [base, luz, sombra]
const ROOF: Record<Roof, [string, string, string]> = {
  thatch: ['#b8912f', '#e0bd5e', '#7d5d1c'],
  tile: ['#a8362a', '#d4634a', '#6e1f16'],
  slate: ['#3f5275', '#5f7aa6', '#25324d'],
  wood: ['#7a4a24', '#a06a3a', '#43291a'],
};
const GLASS = '#5fa6c9';
const GLASS_HI = '#c5ecff';
const GOLD = '#f2c230';
const GOLD_DK = '#b98a12';
const IRON = '#7b818e';
const IRON_DK = '#4b4f5c';
const CLOTH_BLUE = '#2f5fb8';
const CLOTH_RED = '#b82f2f';
const WHITE = '#f6f1e4';
const FLAME = '#ff7a1f';
const FLAME_HI = '#ffd23f';

// Sombra bajo el edificio.
function ground(p: Painter, w = 12, h = 2.4, y = 29.3): void {
  p.ellipse(16, y, w, h, SHADOW);
}

// Cuerpo de un edificio con textura según el material.
function body(p: Painter, x: number, y: number, w: number, h: number, wall: Wall): void {
  const [base, light, dark, line] = WALL[wall];
  p.rect(x, y, w, h, base);
  p.rect(x + w - 2, y, 2, h, dark); // sombra derecha
  p.rect(x, y + h - 1, w, 1, dark); // sombra abajo
  p.rect(x, y, 1, h, light); // luz izquierda
  if (wall === 'plank') {
    for (let j = y + 3; j < y + h - 1; j += 3) p.rect(x + 1, j, w - 3, 1, line);
  } else if (wall === 'stone') {
    for (let j = y + 4; j < y + h - 1; j += 4) {
      p.rect(x + 1, j, w - 3, 1, line);
      const off = (Math.floor((j - y) / 4) % 2) * 3;
      for (let i = x + 2 + off; i < x + w - 2; i += 6) p.rect(i, j - 3, 1, 3, line);
    }
  } else if (wall === 'brick') {
    for (let j = y + 3; j < y + h - 1; j += 3) {
      p.rect(x + 1, j, w - 3, 1, line);
      const off = (Math.floor((j - y) / 3) % 2) * 2;
      for (let i = x + 1 + off; i < x + w - 2; i += 4) p.rect(i, j - 2, 1, 2, line);
    }
  } else if (wall === 'plaster') {
    // entramado de vigas
    p.rect(x + 1, y + Math.floor(h / 2), w - 3, 1, line);
    p.rect(x + Math.floor(w / 3), y + 1, 1, h - 2, line);
    p.rect(x + Math.floor((2 * w) / 3), y + 1, 1, h - 2, line);
  }
}

// Tejado a dos aguas (gable) con tejas, paja o pizarra.
function gable(p: Painter, x: number, y: number, w: number, h: number, roof: Roof, hash = 0): void {
  const [base, light, dark] = ROOF[roof];
  for (let r = 0; r < h; r++) {
    const inset = Math.floor(((h - 1 - r) * (w / 2 - 1)) / Math.max(1, h - 1));
    const x0 = x + inset;
    const x1 = x + w - 1 - inset;
    p.rect(x0, y + r, x1 - x0 + 1, 1, base);
    if (roof === 'thatch') {
      for (let i = x0; i <= x1; i++) if (((i * 7 + r * 5 + hash) % 5) === 0) p.set(i, y + r, light);
      if (r % 3 === 2) p.rect(x0, y + r, x1 - x0 + 1, 1, dark);
    } else if (r % 3 === 2) {
      p.rect(x0 + 1, y + r, x1 - x0 - 1, 1, dark); // hiladas de tejas
    }
    p.set(x0, y + r, light);
    p.set(x1, y + r, dark);
  }
  p.rect(x, y + h - 1, w, 1, dark); // alero
}

// Tejado plano con almenas (castillo y torres).
function merlons(p: Painter, x: number, y: number, w: number, color: string): void {
  for (let i = x; i < x + w; i += 4) p.rect(i, y, 2, 2, color);
}

function window3(p: Painter, x: number, y: number, lit = false): void {
  p.rect(x, y, 4, 4, '#3a2a1c');
  p.rect(x + 1, y + 1, 2, 2, lit ? FLAME_HI : GLASS);
  p.set(x + 1, y + 1, lit ? WHITE : GLASS_HI);
  p.rect(x + 2, y + 1, 1, 2, '#3a2a1c');
}

function door(p: Painter, x: number, y: number, w: number, h: number, color = '#5a3a20'): void {
  p.rect(x - 1, y - 1, w + 2, h + 1, '#3a2a1c');
  p.rect(x, y, w, h, color);
  for (let j = y + 2; j < y + h; j += 2) p.rect(x, j, w, 1, '#3f2814');
  p.set(x + w - 2, y + Math.floor(h / 2), GOLD);
}

function chimney(p: Painter, x: number, y: number, h: number, wall: Wall = 'stone'): void {
  const [base, , dark] = WALL[wall];
  p.rect(x, y, 3, h, base);
  p.rect(x + 2, y, 1, h, dark);
  p.rect(x - 1, y, 5, 1, dark);
}

function flag(p: Painter, x: number, y: number, h: number, cloth: string): void {
  p.rect(x, y, 1, h, '#3a2a1c');
  p.rect(x + 1, y, 4, 2, cloth);
  p.set(x + 2, y, GOLD);
}

// Estructura estándar: tejado arriba, cuerpo abajo, puerta y dos ventanas.
function house(p: Painter, wall: Wall, roof: Roof, opts: { w?: number; body?: number; hash?: number } = {}): void {
  const w = opts.w ?? 22;
  const x = 16 - Math.floor(w / 2);
  ground(p);
  gable(p, x - 2, 4, w + 4, 11, roof, opts.hash ?? 0);
  body(p, x, 14, w, 14, wall);
  window3(p, x + 3, 18);
  window3(p, x + w - 7, 18);
  door(p, 14, 22, 4, 6);
}

// --- Recetas ---------------------------------------------------------------

const RECIPES: Record<string, (p: Painter, lvl: number) => void> = {
  hall(p, lvl) {
    ground(p, 14, 2.6);
    gable(p, 3, 7, 26, 9, 'slate');
    body(p, 4, 15, 24, 13, 'stone');
    for (const wx of [7, 20]) {
      window3(p, wx, 18, lvl >= 2);
    }
    door(p, 13, 22, 6, 6, '#4a2e1a');
    // torre central
    body(p, 13, 1, 6, 9, 'stone');
    gable(p, 12, -1, 8, 4, 'slate');
    p.rect(15, 0, 2, 1, WHITE);
    if (lvl >= 2) p.rect(4, 14, 24, 1, GOLD_DK);
    if (lvl >= 3) {
      flag(p, 7, 1, 6, CLOTH_RED);
      flag(p, 23, 1, 6, CLOTH_RED);
    }
    if (lvl >= 4) p.rect(4, 6, 24, 1, GOLD);
  },

  house(p, lvl) {
    if (lvl <= 1) {
      house(p, 'plaster', 'thatch', { hash: 3 });
    } else if (lvl === 2) {
      house(p, 'plaster', 'tile');
    } else if (lvl === 3) {
      house(p, 'stone', 'slate');
      chimney(p, 22, 3, 5);
    } else {
      house(p, 'stone', 'slate', { w: 24 });
      chimney(p, 23, 3, 5);
      p.rect(3, 4, 26, 1, GOLD);
      flag(p, 7, 0, 3, CLOTH_BLUE);
    }
  },

  castle(p, lvl) {
    ground(p, 15, 2.8, 30);
    // muralla y torres
    body(p, 4, 17, 24, 13, 'stone');
    merlons(p, 4, 15, 24, '#8f95a3');
    body(p, 1, 9, 7, 21, 'stone');
    body(p, 24, 9, 7, 21, 'stone');
    merlons(p, 1, 7, 7, '#8f95a3');
    merlons(p, 24, 7, 7, '#8f95a3');
    // torre del homenaje
    body(p, 11, 3, 10, 14, 'stone');
    gable(p, 10, 0, 12, 4, 'slate');
    p.rect(11, 3, 10, 1, GOLD_DK);
    door(p, 14, 22, 4, 8, '#3d2a18');
    window3(p, 5, 21, lvl >= 2);
    window3(p, 23, 21, lvl >= 2);
    flag(p, 2, 0, 6, CLOTH_BLUE);
    flag(p, 27, 0, 6, CLOTH_BLUE);
    if (lvl >= 2) p.rect(4, 17, 24, 1, GOLD_DK);
    if (lvl >= 3) {
      flag(p, 15, 0, 3, CLOTH_RED);
      p.rect(0, 25, 1, 5, GOLD);
    }
  },

  church(p, lvl) {
    ground(p, 13, 2.6);
    body(p, 5, 15, 22, 13, 'stone');
    gable(p, 4, 6, 24, 10, 'slate');
    // espadaña con cruz
    body(p, 14, 0, 4, 8, 'stone');
    p.rect(15, 0, 2, 1, WHITE);
    p.set(14, 1, WHITE);
    p.set(17, 1, WHITE);
    // vidriera
    p.rect(14, 18, 4, 6, CLOTH_BLUE);
    p.rect(15, 18, 2, 6, '#8fb8ef');
    door(p, 14, 23, 4, 5, '#4a2e1a');
    if (lvl >= 2) p.rect(5, 16, 22, 1, GOLD);
    if (lvl >= 3) {
      p.set(15, 0, GOLD);
      p.set(16, 0, GOLD);
    }
  },

  tavern(p, lvl) {
    ground(p, 13, 2.4);
    gable(p, 3, 6, 26, 10, lvl >= 2 ? 'tile' : 'wood');
    body(p, 4, 15, 22, 13, 'plank');
    window3(p, 7, 18, lvl >= 3);
    window3(p, 18, 18, lvl >= 3);
    door(p, 13, 22, 4, 6);
    // cartel con jarra
    p.rect(26, 15, 1, 6, '#3a2a1c');
    p.rect(27, 16, 4, 5, '#8f5a32');
    p.rect(28, 17, 2, 3, GOLD);
    // barriles
    p.ellipse(4, 27, 2, 2, '#9c6634');
    p.ellipse(27, 28, 2, 2, '#9c6634');
    if (lvl >= 2) p.rect(4, 26, 22, 1, GOLD_DK);
  },

  market(p, lvl) {
    ground(p, 14, 2.6);
    // toldo a rayas
    for (let i = 2; i < 30; i += 4) {
      p.rect(i, 5, 2, 7, CLOTH_RED);
      p.rect(i + 2, 5, 2, 7, WHITE);
    }
    p.rect(2, 4, 28, 1, '#6a2020');
    // puestos
    p.rect(3, 13, 26, 2, '#8a5a30');
    p.rect(4, 15, 2, 13, '#5a3a20');
    p.rect(26, 15, 2, 13, '#5a3a20');
    p.rect(5, 19, 22, 2, '#a9733a');
    p.rect(5, 21, 22, 1, '#6a4224');
    // mercancía
    for (let i = 6; i < 26; i += 4) {
      p.set(i, 17, '#e0523a');
      p.set(i + 1, 18, '#e0523a');
    }
    p.rect(6, 24, 20, 4, '#9c6634');
    p.rect(6, 24, 20, 1, '#c08a57');
    p.rect(8, 25, 3, 2, GOLD);
    p.rect(14, 25, 3, 2, '#d8a03a');
    p.rect(20, 25, 3, 2, '#f08a3a');
    if (lvl >= 2) flag(p, 15, 0, 4, CLOTH_BLUE);
    if (lvl >= 3) p.rect(2, 3, 28, 1, GOLD);
  },

  watchtower(p, lvl) {
    ground(p, 9, 2.2);
    body(p, 11, 6, 10, 24, lvl >= 2 ? 'stone' : 'plank');
    gable(p, 9, 1, 14, 6, 'wood');
    p.rect(15, 14, 2, 4, '#25180f');
    p.rect(15, 22, 2, 4, '#25180f');
    if (lvl >= 3) p.rect(11, 5, 10, 1, GOLD);
    flag(p, 16, 0, 3, CLOTH_BLUE);
  },

  sawmill(p, lvl) {
    ground(p, 14, 2.6);
    gable(p, 3, 7, 26, 9, 'wood');
    body(p, 4, 15, 22, 13, 'plank');
    // sierra circular
    p.ellipse(22, 20, 4, 4, IRON);
    p.ellipse(22, 20, 1.5, 1.5, IRON_DK);
    p.rect(21, 15, 2, 1, IRON_DK);
    door(p, 9, 21, 4, 7);
    // troncos
    for (let i = 0; i < 3; i++) {
      p.ellipse(7 + i * 4, 27, 2, 2, '#c99256');
      p.ellipse(7 + i * 4, 27, 0.8, 0.8, '#6b4226');
    }
    if (lvl >= 2) p.rect(3, 7, 26, 1, GOLD_DK);
    if (lvl >= 3) p.rect(4, 14, 22, 1, GOLD);
  },

  lumberhut(p, lvl) {
    house(p, 'plank', 'wood', { w: 20 });
    // hacha cruzada
    p.rect(22, 16, 1, 6, '#3a2a1c');
    p.rect(21, 16, 3, 2, IRON);
    p.rect(23, 16, 2, 2, IRON_DK);
    // leños apilados
    for (let i = 0; i < 3; i++) p.ellipse(5 + i * 3, 27, 1.5, 1.5, '#c99256');
    if (lvl >= 2) p.rect(7, 13, 18, 1, GOLD_DK);
  },

  stable(p, lvl) {
    ground(p, 13, 2.6);
    gable(p, 3, 6, 26, 10, 'wood');
    body(p, 4, 15, 24, 13, 'plank');
    // puerta abierta con caballo asomando
    p.rect(9, 17, 14, 11, '#2a1c12');
    p.ellipse(16, 22, 3, 2, '#7a4a24');
    p.rect(13, 19, 2, 3, '#7a4a24');
    p.rect(14, 18, 2, 1, '#4a2e1a');
    p.rect(1, 25, 4, 1, '#c99256');
    p.rect(1, 22, 1, 4, '#6b4226');
    if (lvl >= 2) p.rect(4, 14, 24, 1, GOLD_DK);
    if (lvl >= 3) flag(p, 27, 2, 5, '#2f8a4a');
  },

  goldmine(p, lvl) {
    ground(p, 13, 2.6);
    p.ellipse(16, 20, 13, 11, '#8f95a3');
    p.ellipse(15, 19, 11, 9, '#a9aebb');
    // entrada con vigas
    p.ellipse(16, 25, 4, 4, '#1c1410');
    p.rect(11, 22, 1, 7, '#6b4226');
    p.rect(20, 22, 1, 7, '#6b4226');
    p.rect(11, 21, 10, 1, '#9c6634');
    // pepitas de oro
    for (const [gx, gy] of [[7, 14], [22, 12], [26, 19], [6, 22], [24, 27], [13, 12]]) {
      p.set(gx, gy, GOLD);
      p.set(gx + 1, gy, GOLD_DK);
    }
    // vagoneta
    p.rect(21, 26, 8, 3, IRON_DK);
    p.rect(22, 25, 6, 1, GOLD);
    p.rect(22, 29, 2, 1, '#2a1c12');
    p.rect(27, 29, 2, 1, '#2a1c12');
    if (lvl >= 2) p.set(5, 9, GOLD);
    if (lvl >= 3) p.rect(4, 17, 3, 3, GOLD);
  },

  ironmine(p, lvl) {
    ground(p, 13, 2.6);
    p.ellipse(16, 20, 13, 11, '#5f6470');
    p.ellipse(15, 19, 11, 9, '#7b818e');
    p.ellipse(16, 25, 4, 4, '#1c1410');
    p.rect(11, 22, 1, 7, '#6b4226');
    p.rect(20, 22, 1, 7, '#6b4226');
    p.rect(11, 21, 10, 1, '#9c6634');
    for (const [gx, gy] of [[7, 14], [22, 12], [26, 19], [6, 22], [24, 27]]) {
      p.set(gx, gy, '#b7bcc8');
      p.set(gx + 1, gy, '#5b6070');
    }
    p.rect(21, 26, 8, 3, IRON_DK);
    p.rect(22, 25, 6, 1, '#b7bcc8');
    p.rect(22, 29, 2, 1, '#2a1c12');
    p.rect(27, 29, 2, 1, '#2a1c12');
    if (lvl >= 3) p.rect(4, 17, 3, 3, '#b7bcc8');
  },

  quarry(p, lvl) {
    ground(p, 14, 2.6);
    // terrazas de roca
    p.rect(2, 16, 28, 12, '#8f95a3');
    p.rect(4, 12, 24, 4, '#a9aebb');
    p.rect(2, 16, 28, 1, '#c4c9d4');
    p.rect(2, 27, 28, 1, '#5b6070');
    // grúa de madera
    p.rect(7, 3, 2, 14, '#6b4226');
    p.rect(23, 3, 2, 14, '#6b4226');
    p.rect(7, 3, 18, 2, '#9c6634');
    p.rect(15, 5, 2, 7, '#43291a');
    p.ellipse(16, 13, 1.5, 1.5, IRON);
    // bloques de piedra
    for (let i = 0; i < 3; i++) {
      p.rect(5 + i * 5, 24, 4, 3, '#c4c9d4');
      p.rect(5 + i * 5, 26, 4, 1, '#5b6070');
    }
    if (lvl >= 3) p.rect(2, 16, 28, 1, GOLD_DK);
  },

  farm(p, lvl) {
    ground(p, 14, 2.6);
    // campos
    p.rect(1, 18, 30, 12, '#6f5a2a');
    for (let j = 19; j < 30; j += 3) p.rect(1, j, 30, 1, lvl >= 2 ? '#8fbf4a' : '#7aa83a');
    // granero
    gable(p, 4, 4, 14, 8, 'tile');
    body(p, 5, 11, 12, 9, 'plank');
    door(p, 9, 14, 4, 6, '#4a2e1a');
    // pacas de heno
    p.ellipse(24, 15, 3, 3, '#e8c24a');
    p.ellipse(24, 15, 1.2, 1.2, '#b98a12');
    p.ellipse(27, 25, 3, 3, '#e8c24a');
    p.ellipse(27, 25, 1.2, 1.2, '#b98a12');
    if (lvl >= 3) p.rect(2, 17, 28, 1, GOLD_DK);
  },

  granary(p, lvl) {
    ground(p, 11, 2.4);
    body(p, 5, 13, 12, 15, 'plank');
    gable(p, 4, 7, 14, 7, 'wood');
    // silo cilíndrico
    p.rect(19, 9, 9, 19, '#c9cbd3');
    p.rect(26, 9, 2, 19, '#8f95a3');
    p.ellipse(23.5, 9, 4.5, 2.5, '#e3e5ec');
    p.rect(19, 16, 9, 1, '#8f95a3');
    p.rect(19, 22, 9, 1, '#8f95a3');
    // trigo
    for (let i = 0; i < 4; i++) p.set(6 + i * 2, 11 + (i % 2), '#e8c24a');
    door(p, 9, 21, 4, 7);
    if (lvl >= 2) p.rect(5, 12, 12, 1, GOLD_DK);
    if (lvl >= 3) p.rect(19, 9, 9, 1, GOLD);
  },

  cattle(p, lvl) {
    ground(p, 14, 2.6);
    // corral con valla
    p.rect(2, 13, 28, 16, '#7aa83a');
    p.rect(2, 13, 28, 1, '#9c6634');
    p.rect(2, 28, 28, 1, '#9c6634');
    p.rect(2, 13, 1, 16, '#9c6634');
    p.rect(29, 13, 1, 16, '#9c6634');
    for (let i = 4; i < 28; i += 6) {
      p.rect(i, 13, 1, 16, '#6a4224');
    }
    p.rect(2, 18, 28, 1, '#6a4224');
    p.rect(2, 24, 28, 1, '#6a4224');
    // vacas
    for (const [cx, cy] of [[10, 21], [22, 22]]) {
      p.ellipse(cx, cy, 3.5, 2.2, WHITE);
      p.rect(cx - 2, cy - 1, 2, 1, '#2a1c12');
      p.rect(cx + 1, cy, 2, 1, '#2a1c12');
      p.set(cx + 3, cy - 2, '#2a1c12');
    }
    // abrevadero
    p.rect(24, 9, 6, 3, '#6b4226');
    p.rect(25, 10, 4, 1, '#5fa6c9');
    if (lvl >= 3) p.rect(2, 13, 28, 1, GOLD_DK);
  },

  carpentry(p, lvl) {
    house(p, 'plank', 'wood', { w: 22 });
    // caballete de serrar
    p.rect(6, 22, 1, 6, '#6b4226');
    p.rect(12, 22, 1, 6, '#6b4226');
    p.rect(4, 24, 10, 1, '#9c6634');
    // tablones apilados
    for (let i = 0; i < 3; i++) p.rect(20, 24 - i * 2, 7, 2, '#d9a774');
    p.rect(20, 24, 7, 1, '#c08a57');
    if (lvl >= 2) p.rect(4, 13, 24, 1, GOLD_DK);
  },

  forge(p, lvl) {
    ground(p, 13, 2.6);
    chimney(p, 21, 2, 12, 'stone');
    // humo
    p.ellipse(22, 2, 2.5, 1.6, '#c4c9d4');
    p.ellipse(24, 0, 1.8, 1.2, '#e3e5ec');
    body(p, 4, 14, 22, 14, 'stone');
    gable(p, 3, 7, 24, 8, 'slate');
    // horno con brasas
    p.rect(7, 18, 9, 8, '#2a1c12');
    p.ellipse(11.5, 22, 3.5, 3, FLAME);
    p.ellipse(11.5, 22.5, 1.8, 1.6, FLAME_HI);
    // yunque
    p.rect(18, 24, 6, 2, IRON);
    p.rect(17, 26, 8, 2, IRON_DK);
    p.rect(19, 23, 4, 1, IRON);
    if (lvl >= 2) p.rect(4, 14, 22, 1, GOLD_DK);
    if (lvl >= 3) p.rect(3, 7, 24, 1, GOLD);
  },

  jeweler(p, lvl) {
    house(p, 'stone', 'slate', { w: 20 });
    // cartel con diamante
    p.rect(26, 13, 1, 8, '#3a2a1c');
    const d: [number, number, number][] = [
      [27, 15, 3],
      [26, 16, 5],
      [27, 17, 3],
    ];
    for (const [x, y, w] of d) p.rect(x, y, w, 1, '#5fa6c9');
    p.set(28, 16, '#dff3ff');
    // horno pequeño
    p.rect(19, 24, 6, 4, '#2a1c12');
    p.set(20, 25, FLAME);
    p.set(21, 25, FLAME_HI);
    if (lvl >= 2) p.rect(3, 13, 26, 1, GOLD_DK);
    if (lvl >= 3) p.set(14, 2, '#ff8fc0');
  },

  library(p, lvl) {
    ground(p, 12, 2.4);
    gable(p, 6, 2, 20, 9, 'slate');
    body(p, 7, 11, 18, 17, 'plaster');
    // ventanas altas
    for (const wx of [10, 19]) {
      p.rect(wx, 14, 3, 7, '#3a2a1c');
      p.rect(wx + 1, 15, 1, 5, lvl >= 2 ? GLASS_HI : GLASS);
    }
    door(p, 14, 22, 4, 6, '#4a2e1a');
    // libro del cartel
    p.rect(3, 15, 3, 5, CLOTH_BLUE);
    p.rect(3, 17, 3, 1, GOLD);
    if (lvl >= 2) p.rect(7, 10, 18, 1, GOLD);
    if (lvl >= 3) flag(p, 14, 0, 4, CLOTH_BLUE);
  },
};

// Dibuja un edificio. size: lado en casillas (1, 2 o 3); lvl: nivel 1…5.
export function drawBuilding(kind: string, lvl: number, size: number): Canvas {
  const cv = new Canvas(32 * size, 32 * size);
  const recipe = RECIPES[kind];
  if (recipe) recipe(new Painter(cv, size), lvl);
  cv.outline(OUTLINE);
  return cv;
}

export const BUILDING_ART_KINDS = Object.keys(RECIPES);
