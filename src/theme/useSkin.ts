import { useStore } from '@/store/useStore';

import { SKINS } from './skins';

export function useSkin() {
  const skinId = useStore((s) => s.skin);
  // Una estética que no existe en esta versión (por ejemplo, de otro móvil más nuevo) → Neón.
  return SKINS[skinId] ?? SKINS.neon;
}
