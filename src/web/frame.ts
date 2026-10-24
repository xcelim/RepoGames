// Versión web: en pantallas anchas (PC) la app se muestra como una columna centrada,
// igual que en el móvil. Se limita el ancho que ven los componentes y se encaja el <body>.
import { Dimensions, Platform } from 'react-native';

export const WEB_MAX_WIDTH = 560;

type Dims = { width: number; height: number; scale: number; fontScale: number };

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const clamp = <T extends Dims>(d: T): T => (d && d.width > WEB_MAX_WIDTH ? { ...d, width: WEB_MAX_WIDTH } : d);
  const D = Dimensions as unknown as {
    get: (k: 'window' | 'screen') => Dims;
    addEventListener: (t: 'change', h: (e: { window: Dims; screen: Dims }) => void) => { remove: () => void };
  };
  const get = D.get.bind(Dimensions);
  D.get = (k) => clamp(get(k));
  const add = D.addEventListener.bind(Dimensions);
  D.addEventListener = (t, h) => add(t, (e) => h({ window: clamp(e.window), screen: clamp(e.screen) }));

  const style = document.createElement('style');
  style.textContent = `
    html { background: #050507; }
    html, body { height: 100%; }
    body {
      max-width: ${WEB_MAX_WIDTH}px; margin: 0 auto; position: relative; overflow: hidden;
      transform: translateZ(0); /* las ventanas emergentes se quedan dentro de la columna */
    }
    @media (min-width: ${WEB_MAX_WIDTH + 1}px) {
      body { box-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 0 80px rgba(0,0,0,.6); }
    }
    #root { display: flex; height: 100%; }
    * { -webkit-tap-highlight-color: transparent; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: rgba(127,127,127,.35); border-radius: 8px; }
  `;
  document.head.appendChild(style);
}
