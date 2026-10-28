// Lienzo de píxeles mínimo: se dibuja con primitivas y se convierte en trazos SVG (un trazo por color).
export type Stroke = { fill: string; d: string };

export const OUTLINE = '#1c1410';
export const SHADOW = 'rgba(12,22,12,0.38)';

export class Canvas {
  readonly w: number;
  readonly h: number;
  private px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  set(x: number, y: number, c: string | null): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  // Marco de 1 px (sin relleno).
  frame(x: number, y: number, w: number, h: number, c: string): void {
    for (let i = 0; i < w; i++) {
      this.set(x + i, y, c);
      this.set(x + i, y + h - 1, c);
    }
    for (let j = 0; j < h; j++) {
      this.set(x, y + j, c);
      this.set(x + w - 1, y + j, c);
    }
  }

  // Círculo o elipse rellenos.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }

  // Contorno oscuro alrededor de todo lo sólido (las sombras no cuentan como sólidas).
  outline(c: string = OUTLINE): void {
    const solid = (x: number, y: number) => {
      const v = this.get(x, y);
      return v !== null && !v.startsWith('rgba');
    };
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
  }

  // Trazos SVG: las filas de píxeles iguales se unen en un solo rectángulo.
  strokes(): Stroke[] {
    const byColor = new Map<string, string[]>();
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.get(x, y);
        if (c === null) {
          x++;
          continue;
        }
        let end = x;
        while (end < this.w && this.get(end, y) === c) end++;
        const list = byColor.get(c) ?? [];
        list.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
        byColor.set(c, list);
        x = end;
      }
    }
    return [...byColor.entries()].map(([fill, parts]) => ({ fill, d: parts.join('') }));
  }
}

// Pinta en coordenadas base de 32 px: S es la escala (1 = casilla, 2 = 2×2, 3 = 3×3).
export class Painter {
  constructor(
    readonly cv: Canvas,
    readonly S: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.cv.rect(x * this.S, y * this.S, w * this.S, h * this.S, c);
  }
  frame(x: number, y: number, w: number, h: number, c: string): void {
    this.cv.frame(x * this.S, y * this.S, w * this.S, h * this.S, c);
  }
  set(x: number, y: number, c: string): void {
    this.cv.rect(x * this.S, y * this.S, this.S, this.S, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    this.cv.ellipse(cx * this.S, cy * this.S, rx * this.S, ry * this.S, c);
  }
  // Un punto (ocupa S×S) en la base.
  get W(): number {
    return this.cv.w / this.S;
  }
  get H(): number {
    return this.cv.h / this.S;
  }
}
