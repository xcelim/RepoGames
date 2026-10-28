// Terreno, árboles, decoración, aldeanos e iconos de recursos a píxeles.
import { Canvas, OUTLINE, Painter, SHADOW } from './canvas';

// Un número estable (0..1) por píxel del patrón: el mismo dibujo siempre.
function noise(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Patrón de hierba de 64×64 que se repite por todo el mapa (una sola capa SVG).
export function grassCanvas(): Canvas {
  const cv = new Canvas(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const r = noise(x, y, 1);
      cv.set(x, y, r < 0.2 ? '#3d7a2f' : r > 0.93 ? '#66ad49' : '#4f8f3a');
    }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(noise(i, 3, 5) * 62) + 1;
    const y = Math.floor(noise(i, 9, 7) * 62) + 1;
    const light = noise(i, 11, 9) > 0.5;
    const c = light ? '#7bc15a' : '#2f6b28';
    cv.set(x, y, c);
    cv.set(x - 1, y - 1, c);
    cv.set(x + 1, y - 1, c);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(noise(i, 21, 4) * 58) + 3;
    const y = Math.floor(noise(i, 33, 8) * 58) + 3;
    cv.set(x, y, '#f6f1e4');
    cv.set(x + 1, y, '#e8548c');
    cv.set(x, y + 1, '#e8548c');
    cv.set(x + 1, y + 1, '#e8548c');
  }
  return cv;
}

// Árbol de 32×32 (copa redonda con luz y sombra, tronco y contorno).
export function treeCanvas(variant: number): Canvas {
  const cv = new Canvas(32, 32);
  const p = new Painter(cv, 1);
  const dark = variant % 2 ? '#24582a' : '#1f5024';
  const mid = variant % 2 ? '#367d31' : '#3a8434';
  const lite = '#5fae4a';
  p.ellipse(16, 28, 9, 2.5, SHADOW);
  p.rect(14, 20, 4, 9, '#6b4226');
  p.rect(15, 20, 1, 9, '#9c6634');
  p.ellipse(16, 13, 13, 12, dark);
  p.ellipse(15, 12, 11, 10, mid);
  p.ellipse(12, 9, 5, 4, lite);
  p.ellipse(10, 7, 2, 2, '#8fd06a');
  cv.outline(OUTLINE);
  return cv;
}

// Decoración de 32×32.
export function decorCanvas(kind: string): Canvas {
  const cv = new Canvas(32, 32);
  const p = new Painter(cv, 1);
  p.ellipse(16, 29, 9, 2.2, SHADOW);
  switch (kind) {
    case 'flowers':
      for (const [x, y, c] of [
        [8, 20, '#e8548c'],
        [14, 16, '#f6f1e4'],
        [22, 22, '#e8548c'],
        [18, 26, '#ffd23f'],
        [26, 14, '#f6f1e4'],
        [6, 27, '#ffd23f'],
      ] as [number, number, string][]) {
        p.rect(x - 1, y - 1, 3, 3, c);
        p.rect(x, y + 1, 1, 3, '#2f6b28');
      }
      break;
    case 'torch':
      p.rect(14, 12, 4, 17, '#6b4226');
      p.rect(15, 12, 1, 17, '#9c6634');
      p.rect(12, 9, 8, 4, '#43291a');
      p.ellipse(16, 8, 4, 4, '#ff7a1f');
      p.ellipse(16, 9, 2, 3, '#ffd23f');
      break;
    case 'well':
      p.ellipse(16, 22, 11, 6, '#8f95a3');
      p.ellipse(16, 21, 9, 4.5, '#5fa6c9');
      p.rect(7, 12, 2, 12, '#6b4226');
      p.rect(23, 12, 2, 12, '#6b4226');
      p.rect(6, 9, 20, 3, '#9c6634');
      p.ellipse(16, 8, 9, 3, '#a8362a');
      break;
    case 'banner':
      p.rect(15, 2, 2, 27, '#3a2a1c');
      p.rect(16, 4, 10, 14, '#2f5fb8');
      p.rect(16, 4, 10, 1, '#5f8fe0');
      p.rect(20, 8, 2, 6, '#f2c230');
      p.rect(19, 10, 4, 2, '#f2c230');
      p.set(15, 2, '#f2c230');
      break;
    case 'statue':
      p.rect(9, 24, 14, 4, '#b7bcc8');
      p.rect(11, 17, 10, 7, '#c4c9d4');
      p.ellipse(16, 13, 3, 3.5, '#d6dbe4');
      p.rect(13, 19, 6, 2, '#9ca1ad');
      p.rect(14, 5, 1, 2, '#f2c230');
      break;
    case 'fountain':
      p.ellipse(16, 22, 12, 6, '#9ca1ad');
      p.ellipse(16, 21, 10, 4.5, '#5fa6c9');
      p.ellipse(16, 21, 4, 2, '#a6e1ff');
      p.rect(15, 9, 2, 12, '#c4c9d4');
      p.ellipse(16, 8, 3, 2, '#a6e1ff');
      break;
    case 'bench':
      p.rect(7, 18, 18, 3, '#9c6634');
      p.rect(7, 16, 18, 2, '#c08a57');
      p.rect(8, 21, 2, 6, '#43291a');
      p.rect(22, 21, 2, 6, '#43291a');
      break;
    case 'bush':
      p.ellipse(16, 20, 10, 7, '#1f5024');
      p.ellipse(14, 18, 7, 5, '#3a8434');
      p.ellipse(11, 16, 3, 2, '#5fae4a');
      p.set(20, 22, '#e8548c');
      p.set(9, 22, '#e8548c');
      break;
    default:
      break;
  }
  cv.outline(OUTLINE);
  return cv;
}

// Aldeano de 16×16 con túnica del color indicado.
export function villagerCanvas(tunic: string): Canvas {
  const cv = new Canvas(16, 16);
  const p = new Painter(cv, 1);
  p.ellipse(8, 15, 4, 1.2, 'rgba(12,22,12,0.4)');
  p.rect(6, 3, 4, 4, '#f1c69b'); // cabeza
  p.rect(6, 2, 4, 1, '#5a3a22'); // pelo
  p.rect(5, 7, 6, 5, tunic); // torso
  p.rect(5, 11, 2, 4, '#3a2a1c'); // piernas
  p.rect(9, 11, 2, 4, '#3a2a1c');
  p.rect(4, 7, 1, 4, '#f1c69b'); // brazos
  p.rect(11, 7, 1, 4, '#f1c69b');
  cv.outline(OUTLINE);
  return cv;
}

// Iconos de 16×16 para las barras de recursos.
export type IconKind = 'gold' | 'wood' | 'stone' | 'food' | 'iron' | 'tools' | 'furniture' | 'diamonds' | 'villager';

export function iconCanvas(kind: IconKind): Canvas {
  const cv = new Canvas(16, 16);
  const p = new Painter(cv, 1);
  switch (kind) {
    case 'gold':
      p.ellipse(8, 8, 6, 6, '#f2c230');
      p.ellipse(8, 8, 3.5, 3.5, '#b98a12');
      p.rect(6, 4, 2, 2, '#fff1a6');
      break;
    case 'wood':
      p.ellipse(8, 8, 6, 5, '#c99256');
      p.ellipse(8, 8, 2.5, 2, '#9c6634');
      p.ellipse(8, 8, 1, 1, '#6b4226');
      break;
    case 'stone':
      p.rect(2, 6, 12, 7, '#9ca1ad');
      p.rect(2, 6, 12, 1, '#c4c9d4');
      p.rect(2, 12, 12, 1, '#5b6070');
      p.rect(7, 6, 1, 7, '#5b6070');
      break;
    case 'food':
      p.rect(7, 3, 2, 10, '#c9a24a');
      p.rect(4, 3, 2, 3, '#e8c24a');
      p.rect(10, 3, 2, 3, '#e8c24a');
      p.rect(4, 8, 2, 3, '#e8c24a');
      p.rect(10, 8, 2, 3, '#e8c24a');
      break;
    case 'iron':
      p.rect(2, 8, 12, 5, '#7b818e');
      p.rect(2, 8, 12, 1, '#b7bcc8');
      p.rect(4, 6, 8, 2, '#858b98');
      break;
    case 'tools':
      p.rect(7, 6, 2, 9, '#6b4226');
      p.rect(3, 3, 10, 4, '#858b98');
      p.rect(3, 3, 10, 1, '#c4c9d4');
      break;
    case 'furniture':
      p.rect(4, 6, 8, 2, '#c08a57');
      p.rect(4, 8, 2, 6, '#6b4226');
      p.rect(10, 8, 2, 6, '#6b4226');
      p.rect(4, 3, 2, 3, '#9c6634');
      break;
    case 'diamonds':
      p.rect(3, 6, 10, 2, '#5fa6c9');
      p.rect(2, 8, 12, 1, '#2f5fb8');
      p.rect(5, 9, 6, 2, '#5fa6c9');
      p.rect(7, 11, 2, 2, '#2f5fb8');
      p.set(5, 6, '#dff3ff');
      break;
    case 'villager':
      p.rect(6, 2, 4, 4, '#f1c69b');
      p.rect(5, 7, 6, 6, '#2f5fb8');
      p.rect(5, 13, 2, 2, '#3a2a1c');
      p.rect(9, 13, 2, 2, '#3a2a1c');
      break;
  }
  cv.outline(OUTLINE);
  return cv;
}
