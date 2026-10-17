import { useStore } from '@/store/useStore';

import { SKINS } from './skins';

export function useSkin() {
  const skinId = useStore((s) => s.skin);
  return SKINS[skinId];
}
