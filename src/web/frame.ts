// Versión web: en el móvil se ve igual que la app; en el PC, como una web de escritorio
// (barra lateral a la izquierda y el contenido a lo ancho, con un máximo para que se lea bien).
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Platform } from 'react-native';

export const SIDEBAR_W = 248;
export const DESKTOP_MIN = 1000; // a partir de este ancho, formato PC
export const CONTENT_MAX = 1180;

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';

export function isDesktopWeb(): boolean {
  return isWeb && window.innerWidth >= DESKTOP_MIN;
}

export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(isDesktopWeb);
  useEffect(() => {
    if (!isWeb) return;
    const on = () => setDesktop(isDesktopWeb());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return desktop;
}

// Ancho de la zona de contenido en el PC (sin la barra lateral).
function contentWidth(full: number): number {
  return full >= DESKTOP_MIN ? Math.min(full - SIDEBAR_W, CONTENT_MAX) : full;
}

type Dims = { width: number; height: number; scale: number; fontScale: number };

if (isWeb) {
  // Las pantallas calculan tamaños con el ancho de la ventana: en el PC se les da el del contenido.
  const clamp = <T extends Dims>(d: T): T => (d ? { ...d, width: contentWidth(d.width) } : d);
  const D = Dimensions as unknown as {
    get: (k: 'window' | 'screen') => Dims;
    addEventListener: (t: 'change', h: (e: { window: Dims; screen: Dims }) => void) => { remove: () => void };
  };
  const get = D.get.bind(Dimensions);
  D.get = (k) => clamp(get(k));
  const add = D.addEventListener.bind(Dimensions);
  D.addEventListener = (t, h) => add(t, (e) => h({ window: clamp(e.window), screen: clamp(e.screen) }));

  // En la web, Alert.alert de React Native no hace nada: se usan los diálogos del navegador.
  type Btn = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
  (Alert as unknown as { alert: (t: string, m?: string, b?: Btn[]) => void }).alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = buttons ?? [];
    if (list.length <= 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    const cancel = list.find((b) => b.style === 'cancel');
    const action = [...list].reverse().find((b) => b.style !== 'cancel') ?? list[list.length - 1];
    if (window.confirm(text)) action.onPress?.();
    else cancel?.onPress?.();
  };

  const style = document.createElement('style');
  style.textContent = `
    html, body { height: 100%; }
    body { margin: 0; overflow: hidden; }
    #root { display: flex; height: 100%; }
    body.desktop #root {
      position: absolute; top: 0; bottom: 0;
      left: max(${SIDEBAR_W}px, calc(${SIDEBAR_W}px + (100vw - ${SIDEBAR_W}px - ${CONTENT_MAX}px) / 2));
      width: min(${CONTENT_MAX}px, calc(100vw - ${SIDEBAR_W}px));
    }
    * { -webkit-tap-highlight-color: transparent; }
    [tabindex="0"] { cursor: pointer; }
    [tabindex="0"]:focus-visible { outline: 2px solid rgba(127,127,255,.6); outline-offset: 2px; }
    input, textarea { cursor: text; }
    @keyframes sq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes sq-spin-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
    @keyframes sq-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
    @keyframes sq-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @keyframes sq-sweep { 0% { left: -70%; } 53% { left: 170%; } 100% { left: 170%; } }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: rgba(127,127,127,.35); border-radius: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
  const mark = () => document.body.classList.toggle('desktop', isDesktopWeb());
  mark();
  window.addEventListener('resize', mark);
}

// El fondo de la página (a los lados del contenido) con el color de la estética.
export function setPageBackground(color: string): void {
  if (isWeb) document.documentElement.style.background = color;
}
