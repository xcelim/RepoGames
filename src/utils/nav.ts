import { router } from 'expo-router';

// Volver atrás; si no hay a dónde (por ejemplo, en la web tras recargar o abrir un enlace), al inicio.
export function goBack(fallback: '/' | '/lists' | '/profile' | '/social' = '/'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
