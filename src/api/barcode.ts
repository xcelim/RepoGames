// Código de barras (EAN/UPC) → nombre del juego.
// Se usa la base de datos pública de UPCitemdb (sin clave, con límite diario) y, si no lo
// conoce, Open Food Facts/Open Products Facts. Con el nombre se busca el juego en IGDB.

const PLATFORM_WORDS = [
  'nintendo switch 2',
  'nintendo switch',
  'switch',
  'nintendo 3ds',
  '3ds',
  'nintendo ds',
  'wii u',
  'wii',
  'playstation 5',
  'playstation 4',
  'playstation 3',
  'ps5',
  'ps4',
  'ps3',
  'ps vita',
  'xbox series x',
  'xbox one',
  'xbox 360',
  'xbox',
  'pc dvd',
  'pc',
  'game boy advance',
  'gamecube',
];

const NOISE = [
  'standard edition',
  'edición estándar',
  'edicion estandar',
  'day one edition',
  'day one',
  'deluxe edition',
  'launch edition',
  'video game',
  'videojuego',
  'juego',
  'game',
  'import',
  'uk',
  'eu',
  'esp',
  'pal',
  'multi-language',
  'multilanguage',
];

// "Super Mario Odyssey (Nintendo Switch) - Standard Edition" → "Super Mario Odyssey"
export function cleanProductTitle(raw: string): string {
  let t = raw.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
  for (const w of [...PLATFORM_WORDS, ...NOISE]) {
    t = t.replace(new RegExp(`(^|[\\s\\-–—:|,/])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s\\-–—:|,/])`, 'gi'), ' ');
  }
  return t
    .replace(/(\s*[-–—|,/]\s*)+$/g, '')
    .replace(/^(\s*[-–—|,/:]\s*)+/g, '')
    .replace(/(\s*[-–—|]\s*){2,}/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\s*[-–—|,/]$/, '')
    .trim();
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupBarcode(code: string): Promise<string | null> {
  const digits = code.replace(/\D/g, '');
  if (!digits) return null;
  const upc = (await getJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${digits}`)) as {
    items?: { title?: string }[];
  } | null;
  const t1 = upc?.items?.find((i) => i.title)?.title;
  if (t1) return cleanProductTitle(t1) || t1;
  for (const host of ['world.openproductsfacts.org', 'world.openfoodfacts.org']) {
    const off = (await getJson(`https://${host}/api/v2/product/${digits}.json?fields=product_name`)) as {
      product?: { product_name?: string };
    } | null;
    const t2 = off?.product?.product_name;
    if (t2) return cleanProductTitle(t2) || t2;
  }
  return null;
}
