// Acceso a los sprites a píxeles, con caché: cada dibujo se genera una sola vez.
import type { Canvas, Stroke } from './canvas';
import { BUILDING_ART_KINDS, drawBuilding } from './buildings';
import { type IconKind, decorCanvas, grassCanvas, iconCanvas, treeCanvas, villagerCanvas } from './terrain';

export type { Stroke, IconKind };

const cache = new Map<string, { w: number; h: number; strokes: Stroke[] }>();

function get(key: string, make: () => Canvas): { w: number; h: number; strokes: Stroke[] } {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = make();
  const out = { w: cv.w, h: cv.h, strokes: cv.strokes() };
  cache.set(key, out);
  return out;
}

export const buildingArt = (kind: string, level: number, size: number) =>
  get(`b:${kind}:${level}:${size}`, () => drawBuilding(kind, level, size));
export const treeArt = (variant: number) => get(`t:${variant % 2}`, () => treeCanvas(variant));
export const decorArt = (kind: string) => get(`d:${kind}`, () => decorCanvas(kind));
export const villagerArt = (tunic: string) => get(`v:${tunic}`, () => villagerCanvas(tunic));
export const iconArt = (kind: IconKind) => get(`i:${kind}`, () => iconCanvas(kind));
export const grassArt = () => get('grass', grassCanvas);

export { BUILDING_ART_KINDS };
