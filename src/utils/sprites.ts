// Sprites pixel art del pueblo: cada uno es una rejilla de 16×16 con una letra por color ('.' = transparente).
// Se convierten una vez en trazos SVG (un trazo por color, con las filas contiguas unidas).

export const PALETTE: Record<string, string> = {
  k: '#2a1d14', // contorno
  d: '#4d4d59', // piedra oscura
  g: '#84848f', // piedra
  l: '#bdbdc8', // piedra clara
  w: '#5e3a20', // madera oscura
  b: '#9a6232', // madera
  t: '#c99256', // madera clara
  r: '#a8362a', // teja roja
  R: '#d9583f', // teja roja clara
  y: '#d8b04a', // paja
  Y: '#a9832c', // paja oscura
  n: '#34466e', // pizarra azul
  N: '#56688f', // pizarra clara
  G: '#2f6b28', // hierba oscura
  h: '#4f8f3a', // hierba
  H: '#72b555', // hierba clara
  f: '#24582a', // copa del árbol oscura
  F: '#367d31', // copa del árbol
  e: '#5fae4a', // copa del árbol clara
  c: '#f2c230', // oro
  C: '#b98a12', // oro oscuro
  x: '#3a7bd5', // azul
  X: '#9fdcff', // azul claro
  p: '#7e3f9e', // morado
  P: '#e8548c', // rosa
  W: '#ffffff', // blanco
  s: '#f3c69a', // piel
  S: '#d6996a', // piel oscura
  O: '#ff7a1f', // llama
  o: '#ffd23f', // llama clara
  q: '#c23a3a', // rojo
};

export type SpriteName =
  | 'tree'
  | 'hut1'
  | 'hut2'
  | 'hut3'
  | 'hall'
  | 'sawmill'
  | 'mine'
  | 'jeweler'
  | 'castle'
  | 'villager'
  | 'coin'
  | 'log'
  | 'gem'
  | 'flowers'
  | 'torch'
  | 'well'
  | 'banner';

export const SPRITES: Record<SpriteName, string[]> = {
  tree: [
    '................',
    '.....FFFF.......',
    '...FFeeeFF......',
    '..FFeeFFeeF.....',
    '.FeeFFFFFeFF....',
    '.FeFFeeFFFeFF...',
    'FeeFFeFFFFFeF...',
    'FFeFFFFeeFFFFF..',
    'FFFFFFFFFFeFFF..',
    '.FFFfFFFFFFFf...',
    '..ffFFFFFFFf....',
    '....kwwbwk......',
    '....kwtbwk......',
    '....kwwbwk......',
    '...kkkkkkkk.....',
    '................',
  ],
  hut1: [
    '................',
    '................',
    '.......kk.......',
    '......kyyk......',
    '.....kyYyyk.....',
    '....kyyYyyYk....',
    '...kYyyyYyyyk...',
    '..kyyYyyyyYyyk..',
    '.kkkkkkkkkkkkkk.',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbXXbbbbbbbk..',
    '..kbXXbbbbwbbk..',
    '..kbbbbbbbwwbk..',
    '..kwwwwwwwwwwk..',
    '.kkkkkkkkkkkkkk.',
  ],
  hut2: [
    '................',
    '.......kk.......',
    '......kRRk......',
    '.....kRRRRk.....',
    '....kRrRRRRk....',
    '...kRrRRRRrRk...',
    '..kRrRRRRRRrRk..',
    '.kRRRRRRRRRRRRk.',
    'kkkkkkkkkkkkkkkk',
    '.kllllllllllllk.',
    '.kwllwllwllwllk.',
    '.kllXllwllllXlk.',
    '.kllXlllwlllXlk.',
    '.kwwwwwwwwwwwwk.',
    '.kllllwwwwllllk.',
    'kkkkkkkkkkkkkkkk',
  ],
  hut3: [
    '.......kk.......',
    '......kNNk......',
    '.....kNNNNk.....',
    '....kNnNNnNk....',
    '...kNnNNnNNnk...',
    '..kNnNNnNNnNNk..',
    '.kNnNNnNNnNNnNk.',
    'kkkkkkkkkkkkkkkk',
    '.kggggggggggggk.',
    '.kgllgggggggglk.',
    '.kgXXgggggXXgk..',
    '.kgXXgggggXXgk..',
    '.kggggwwwggggk..',
    '.kgggwwwwwgggk..',
    '.kggggwwwwgggk..',
    'kkkkkkkkkkkkkkkk',
  ],
  hall: [
    '........kk......',
    '........kqqk....',
    '........kqqqk...',
    '........kqqk....',
    '...kkkkkkkkk....',
    '..kgggggggggk...',
    '.kgggggggggggk..',
    '.kllllllllllgk..',
    'kkkkkkkkkkkkkkkk',
    '.kgglgggggglgk..',
    '.kgggggggggggk..',
    '.kgXXgggkkgXXgk.',
    '.kgXXgggkkgXXgk.',
    '.kggggggkkgggggk',
    '.kgggggggggggggk',
    'kkkkkkkkkkkkkkkk',
  ],
  sawmill: [
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    'kRRRRRRRRRRRRRRk',
    'kkwwwwwwwwwwwwkk',
    '.kbbbbbbbbbbbbk.',
    '.kwwwwwwwlllwwk.',
    '.kbbbbbblllllbk.',
    '.kwwwwwwllkllwk.',
    '.kbbbbbblllllbk.',
    '.kttttttwlllwwk.',
    '.kttttttbbbbbbk.',
    '.kttttttbbbbbbk.',
    '.kwwwwwwkkkkkkk.',
  ],
  mine: [
    '................',
    '................',
    '......kkkkk.....',
    '....kkggggkk....',
    '...kggglggggk...',
    '..kgglgggggggk..',
    '.kgggkkkkkgggk..',
    '.kggkwwwwwkggk..',
    'kkgkwkkkkkwkgkk.',
    'kggkwkkkkkkwkggk',
    'kgggwkkkkkkwggdk',
    'kggggwwwwwwgggdk',
    'kggcggggggggdggk',
    'kkkkkkkkkkkkkkkk',
    '.kCc..kkkkk.cCk.',
    '................',
  ],
  jeweler: [
    '................',
    '.......kk.......',
    '......kXXk......',
    '.....kXPXXk.....',
    '....kkkkkkkk....',
    '....kggggggk....',
    '...kgggggggk....',
    '..kgggggggggk...',
    'kkkkkkkkkkkkkkkk',
    '.kgllgggggllgk..',
    '.kgggggggggggk..',
    '.kgkkkkgkkkkgk..',
    '.kgkoOOkgkoOkgk.',
    '.kgkOoOkgkOoOkgk',
    '.kggkkkkggkkkggk',
    'kkkkkkkkkkkkkkkk',
  ],
  castle: [
    'n..n....n..n....',
    'Nk.k.kk.k.kN....',
    'kkkkkkkkkkkkkk..',
    '.kggkgggggkggk..',
    '.kggkgggggkggk..',
    '.kgggkkkkkgggk..',
    '.kgggkWWWkgggk..',
    '.kgggkWWWkgggk..',
    'kkgggkkkkkgggkk.',
    'kgggggggggggggk.',
    'kgglgggggggglgk.',
    'kgggkkkkkkkgggk.',
    'kgggkWWWWWkgggk.',
    'kgggkWWWWWkgggk.',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  villager: [
    '................',
    '................',
    '................',
    '................',
    '.....kkkk.......',
    '.....kssk.......',
    '.....ksSk.......',
    '....kxxxxk......',
    '....kxxxxk......',
    '....kxxxxk......',
    '....kkkkkk......',
    '.....kk.kk......',
    '.....k...k......',
    '....kk...kk.....',
    '................',
    '................',
  ],
  coin: [
    '......kkkk......',
    '...kkkkcckkkk...',
    '..kkcccccccckk..',
    '.kkccCCCCCCcckk.',
    '.kccCCccccCCcck.',
    '.kcCCWWccccCCck.',
    'kkcCWWccccccCckk',
    'kccCccccccccCcck',
    'kccCccccccccCcck',
    'kkcCccccccccCckk',
    '.kcCCccccccCCck.',
    '.kccCCccccCCcck.',
    '.kkccCCCCCCcckk.',
    '..kkcccccccckk..',
    '...kkkkcckkkk...',
    '......kkkk......',
  ],
  log: [
    '................',
    '................',
    '................',
    '..kkkkk.........',
    '.kktttkkkkkkkkkk',
    'kkttbtttttttttbk',
    'kttbbbttbbbbbbbk',
    'ktbbwbbtbbbbbbbk',
    'kttbbbttbwbwbbbk',
    'kkttbttbbbbbbbbk',
    '.kktttbbbbbbbbbk',
    '..kkkkkkkkkkkkkk',
    '................',
    '................',
    '................',
    '................',
  ],
  gem: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kXWXXXXXXk...',
    '..kXWXXxxxXXXk..',
    '..kXXxxxxxxXXk..',
    'kkkkkkkkkkkkkkkk',
    'kXXXxxxxxxxxXXXk',
    '.kXXxxxxxxxxxXk.',
    '..kXxxxxxxxxXk..',
    '...kxxxxxxxxk...',
    '....kxxxxxxk....',
    '.....kxxxxk.....',
    '......kxxk......',
    '.......kk.......',
    '................',
  ],
  flowers: [
    '................',
    '................',
    '..P.....P.......',
    '.PPP...PPP..y...',
    '..P.....P..yyy..',
    '..k..W..k...y...',
    '.kkk.WWW.kkk....',
    '..k..W.W..k.....',
    '.........k......',
    '...P....kk......',
    '..PPP...k.......',
    '...P....k.......',
    '....kk.......kk.',
    '................',
    '................',
    '................',
  ],
  torch: [
    '.......OO.......',
    '......OoOO......',
    '......OoOO......',
    '.......OO.......',
    '......kkkk......',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
    '.....kkkkkk.....',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  well: [
    '................',
    '....kkkkkkkk....',
    '...kRRRRRRRRk...',
    '..kRrRRRRRRrRk..',
    'kkkkkkkkkkkkkkkk',
    '..kwk......kwk..',
    '..kwk......kwk..',
    '..kkkkkkkkkkkk..',
    '..kgggggggggggk.',
    '.kgggggggggggggk',
    '.kgXXXXXXXXXXXgk',
    '.kgXdddddddddXgk',
    '.kgggggggggggggk',
    '.kkkkkkkkkkkkkkk',
    '................',
    '................',
  ],
  banner: [
    '......kcck......',
    '......kcck......',
    '..kkkkkcckkkkk..',
    '..kqqqqqqqqqqk..',
    '..kqqqqccqqqqk..',
    '..kqqqqccqqqqk..',
    '..kqqccccccqqk..',
    '..kqqccccccqqk..',
    '..kqqqqccqqqqk..',
    '..kqqqqccqqqqk..',
    '..kqqqqqqqqqqk..',
    '..kqqqqqqqqqqk..',
    '..kkkkkwwkkkkk..',
    '......kwwk......',
    '......kwwk......',
    '......kwwk......',
  ],
};

// Trazos SVG por color: una lista de rectángulos unidos por filas.
export type Stroke = { fill: string; d: string };
const cache = new Map<SpriteName, Stroke[]>();

export function spriteStrokes(name: SpriteName): Stroke[] {
  const hit = cache.get(name);
  if (hit) return hit;
  const rows = SPRITES[name];
  const byColor = new Map<string, string[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !PALETTE[ch]) {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      const list = byColor.get(ch) ?? [];
      list.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      byColor.set(ch, list);
      x = end;
    }
  });
  const out = [...byColor.entries()].map(([ch, parts]) => ({ fill: PALETTE[ch], d: parts.join('') }));
  cache.set(name, out);
  return out;
}

// Un SVG de un sprite (para verlo fuera de la app).
export function spriteSvg(name: SpriteName, scale = 16): string {
  const paths = spriteStrokes(name)
    .map((s) => `<path fill="${s.fill}" d="${s.d}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${16 * scale}" height="${16 * scale}" viewBox="0 0 16 16" shape-rendering="crispEdges">${paths}</svg>`;
}
