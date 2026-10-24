// "Desliza hacia abajo para actualizar": trae lo último de todo (tus datos, amigos, mensajes, comunidad).
import { syncNow } from './engine';
import { refreshSocial } from './social';
import { fetchCommunity } from './sync';

let running: Promise<void> | null = null;

export function refreshEverything(): Promise<void> {
  if (running) return running;
  running = Promise.allSettled([syncNow(), refreshSocial(true), fetchCommunity()])
    .then(() => undefined)
    .finally(() => {
      running = null;
    });
  return running;
}
